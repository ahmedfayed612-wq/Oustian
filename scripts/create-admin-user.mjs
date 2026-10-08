/**
 * One-shot provisioning of an admin account — run with:
 *
 *   SUPABASE_ACCESS_TOKEN=… node scripts/create-admin-user.mjs
 *
 * (or with the CLI token stored in the macOS keychain, same as the e2e tests).
 *
 * It performs exactly the two steps the M1 migration documents as the official
 * bootstrap path (`supabase/migrations/20260924120000_profiles_and_invite_codes.sql`
 * §7): sign the user up through the real signup endpoint (so `handle_new_user()`
 * creates the profile and consumes an invite code), then promote the row with
 * the `postgres` role, which — unlike any app session — bypasses
 * `protect_profile_columns`.
 *
 * Everything secret arrives through the environment; nothing is hard-coded.
 *
 * Required env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME, ADMIN_FULL_NAME
 * Optional env: INVITE_CODE (default ADMIN-BOOTSTRAP-2026)
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const envVal = (key) =>
  readFileSync(".env.local", "utf8").match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();

const SUPA_URL = envVal("NEXT_PUBLIC_SUPABASE_URL");
const PUBLISHABLE_KEY = envVal("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const REF = readFileSync("supabase/.temp/project-ref", "utf8").trim();
const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ??
  execSync("security find-generic-password -s 'Supabase CLI' -w").toString().trim();

const API = `https://api.supabase.com/v1/projects/${REF}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const EMAIL = required("ADMIN_EMAIL");
const PASSWORD = required("ADMIN_PASSWORD");
const USERNAME = required("ADMIN_USERNAME").toLowerCase();
const FULL_NAME = required("ADMIN_FULL_NAME");
const INVITE_CODE = (process.env.INVITE_CODE ?? "ADMIN-BOOTSTRAP-2026").toUpperCase();

function required(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`missing env ${key}`);
    process.exit(1);
  }
  return value;
}

/** Management-API SQL. Values are single-quote escaped — never string-interpolated raw. */
async function sql(query) {
  const res = await fetch(`${API}/database/query`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`sql failed: ${JSON.stringify(data)}`);
  return data;
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function main() {
  if (!/^[a-z0-9_]{3,24}$/.test(USERNAME)) throw new Error("username must match ^[a-z0-9_]{3,24}$");
  if (PASSWORD.length < 8) throw new Error("password must be at least 8 characters (app rule)");

  const taken = await sql(
    `SELECT username FROM public.profiles WHERE username = ${q(USERNAME)}`,
  );
  if (taken.length > 0) throw new Error(`username ${USERNAME} already exists`);

  // 1. Invite code (the trigger refuses any signup without a live one).
  await sql(
    `INSERT INTO public.invite_codes (code, label, max_uses)
     VALUES (${q(INVITE_CODE)}, 'admin bootstrap', 50)
     ON CONFLICT (code) DO NOTHING`,
  );
  console.log(`invite code ready: ${INVITE_CODE}`);

  // 2. Real signup path, so handle_new_user() builds the profile.
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      data: {
        username: USERNAME,
        full_name: FULL_NAME,
        invite_code: INVITE_CODE,
        language: "en",
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`signup failed: ${JSON.stringify(body)}`);
  const id = body.user?.id;
  if (!id) throw new Error(`signup returned no user: ${JSON.stringify(body)}`);
  console.log(`auth user created: ${id}`);

  // 3. Promote — dashboard/postgres role bypasses the self-escalation trigger.
  await sql(
    `UPDATE public.profiles
        SET role = 'admin',
            status = 'approved',
            approved_at = now(),
            verification_method = 'manual'
      WHERE id = ${q(id)}`,
  );
  console.log("profile promoted to admin/approved");

  // 4. Verify: the account must actually log in and read back as an admin.
  const login = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const session = await login.json();
  if (!login.ok) {
    if (String(session.error_description ?? session.msg ?? "").includes("confirm")) {
      console.log("email confirmation required — confirming via management API…");
      const confirm = await fetch(`${API}/auth/admin/users/${id}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ email_confirm: true }),
      });
      if (!confirm.ok) throw new Error(`confirm failed: ${await confirm.text()}`);
    } else {
      throw new Error(`login failed: ${JSON.stringify(session)}`);
    }
    const retry = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const session2 = await retry.json();
    if (!retry.ok) throw new Error(`login failed after confirm: ${JSON.stringify(session2)}`);
  }

  const row = await sql(
    `SELECT username, full_name, status, role, verification_method
       FROM public.profiles WHERE id = ${q(id)}`,
  );
  const profile = row[0];
  if (profile?.role !== "admin" || profile?.status !== "approved") {
    throw new Error(`unexpected profile state: ${JSON.stringify(profile)}`);
  }

  console.log("\nadmin account ready:");
  console.table(profile);
  console.log(`email:     ${EMAIL}`);
  console.log(`password:  ${PASSWORD}`);
}

await main();
