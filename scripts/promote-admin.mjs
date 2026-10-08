/**
 * Promote an EXISTING profile to admin — the mirror of `create-admin-user.mjs`
 * for accounts that already signed up through the normal invite flow.
 *
 *   node scripts/promote-admin.mjs <username>
 *
 * Uses the Supabase management API as the `postgres` role, the only role that
 * bypasses `protect_profile_columns` (M1 migration §7).
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REF = readFileSync("supabase/.temp/project-ref", "utf8").trim();
const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ??
  execSync("security find-generic-password -s 'Supabase CLI' -w").toString().trim();

const username = process.argv[2]?.toLowerCase();
if (!/^[a-z0-9_]{3,24}$/.test(username ?? "")) {
  console.error("usage: node scripts/promote-admin.mjs <username>");
  process.exit(1);
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`sql failed: ${JSON.stringify(data)}`);
  return data;
}

const existing = await sql(
  `SELECT id, status, role FROM public.profiles WHERE username = ${q(username)}`,
);
if (existing.length === 0) throw new Error(`no profile with username ${username}`);
console.log(`before: ${JSON.stringify(existing[0])}`);

await sql(
  `UPDATE public.profiles
      SET role = 'admin',
          status = 'approved',
          approved_at = coalesce(approved_at, now()),
          verification_method = 'manual'
    WHERE username = ${q(username)}`,
);

const after = await sql(
  `SELECT username, full_name, status, role, verification_method, approved_at
     FROM public.profiles WHERE username = ${q(username)}`,
);
console.log("after:");
console.table(after);
