/**
 * Integration tests for the Oustians interaction system — run against a real
 * project (`npm run test:e2e`). They create three throwaway approved members,
 * drive the real `react_to_post()` / `react_to_comment()` RPCs with real
 * session JWTs, then assert the stored rows, the aggregated notifications and
 * the RLS boundaries. Everything created here is deleted afterwards.
 *
 * Requirements (same as `npm run db:push`):
 *   - supabase/.temp/project-ref (linked project)
 *   - SUPABASE_ACCESS_TOKEN in the environment, or the Supabase CLI token in
 *     the macOS keychain
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const envVal = (key) =>
  readFileSync(".env.local", "utf8").match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();

const SUPA_URL = envVal("NEXT_PUBLIC_SUPABASE_URL");
const PUBLISHABLE_KEY = envVal("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const REF = readFileSync("supabase/.temp/project-ref", "utf8").trim();
const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ??
  execSync("security find-generic-password -s 'Supabase CLI' -w")
    .toString()
    .trim();

const API = `https://api.supabase.com/v1/projects/${REF}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const stamp = Date.now();
const PASSWORD = "E2eReact!2026";

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

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

async function rpc(token, fn, args) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

async function rest(token, path, init = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

const users = {};
const createdPosts = [];
const createdComments = [];
const inviteCode = `E2ER${stamp}`;

try {
  // ---- fixtures: an invite code and three approved members ----------------
  await sql(
    `INSERT INTO public.invite_codes (code, label, max_uses) VALUES ('${inviteCode}', 'e2e-reactions', 5)`,
  );

  async function makeMember(tag) {
    const email = `e2e-react-${tag}-${stamp}@alexu.edu.eg`;

    const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        data: {
          username: `e2ereact${tag}${String(stamp).slice(-7)}`,
          full_name: `E2E React ${tag}`,
          invite_code: inviteCode,
          language: "en",
        },
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`signup ${tag}: ${JSON.stringify(body)}`);

    const id = body.user.id;
    await sql(`UPDATE public.profiles SET status = 'approved' WHERE id = '${id}'`);

    const ssr = createServerClient(SUPA_URL, PUBLISHABLE_KEY, {
      cookies: { getAll: () => [], setAll: () => {} },
    });
    const { data, error } = await ssr.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (error || !data.session) throw new Error(`login ${tag}: ${error?.message}`);

    return { id, email, token: data.session.access_token };
  }

  users.author = await makeMember("a");
  users.reactor = await makeMember("b");
  users.third = await makeMember("c");

  const post = await rest(users.author.token, "posts", {
    method: "POST",
    body: JSON.stringify({
      author_id: users.author.id,
      body: `E2E reactions post ${stamp}`,
    }),
  });
  createdPosts.push(post.body[0].id);
  const postId = createdPosts[0];

  // ---- post reactions: create / change / remove ---------------------------
  let r = await rpc(users.reactor.token, "react_to_post", {
    p_post: postId,
    p_reaction: "same",
  });
  check(
    r.ok && r.body.user_reaction === "same" && r.body.same === 1 && r.body.total === 1,
    "post: create a reaction",
  );

  r = await rpc(users.reactor.token, "react_to_post", {
    p_post: postId,
    p_reaction: "insight",
  });
  check(
    r.ok &&
      r.body.user_reaction === "insight" &&
      r.body.insight === 1 &&
      r.body.same === 0 &&
      r.body.total === 1,
    "post: change a reaction (never two)",
  );

  const oneRow = await sql(
    `SELECT count(*) AS n FROM public.post_reactions WHERE post_id = '${postId}' AND user_id = '${users.reactor.id}'`,
  );
  check(oneRow[0].n === 1, "post: one row per member per post");

  r = await rpc(users.reactor.token, "react_to_post", {
    p_post: postId,
    p_reaction: "",
  });
  check(
    r.ok && r.body.user_reaction === null && r.body.total === 0,
    "post: remove by tapping the active reaction",
  );

  await rpc(users.reactor.token, "react_to_post", { p_post: postId, p_reaction: "talk" });
  await rpc(users.third.token, "react_to_post", { p_post: postId, p_reaction: "fire" });
  r = await rpc(users.author.token, "react_to_post", { p_post: postId, p_reaction: "fire" });
  check(
    r.ok && r.body.fire === 2 && r.body.talk === 1 && r.body.total === 3,
    "post: counts aggregate per reaction type",
  );

  // ---- notifications: aggregated, never one row per tap -------------------
  const notes = await sql(
    `SELECT actor_id, type, reaction_count FROM public.notifications
     WHERE recipient_id = '${users.author.id}' AND type LIKE 'post_%'`,
  );
  check(
    notes.length === 2 &&
      notes.some((n) => n.type === "post_reaction" && n.actor_id === users.third.id && n.reaction_count === 1) &&
      notes.some((n) => n.type === "post_talk" && n.actor_id === users.reactor.id),
    "notifications: one aggregated row per actor, talk gets its own type",
  );
  check(
    !notes.some((n) => n.actor_id === users.author.id),
    "notifications: reacting to your own post notifies nobody",
  );

  // A second post by the same author, reacted to by the same member, bumps the
  // existing row instead of adding another notification.
  const post2 = await rest(users.author.token, "posts", {
    method: "POST",
    body: JSON.stringify({ author_id: users.author.id, body: `E2E reactions post 2 ${stamp}` }),
  });
  createdPosts.push(post2.body[0].id);
  await rpc(users.third.token, "react_to_post", {
    p_post: createdPosts[1],
    p_reaction: "insight",
  });

  const bumped = await sql(
    `SELECT count(*) AS rows, max(reaction_count) AS max_count FROM public.notifications
     WHERE recipient_id = '${users.author.id}' AND actor_id = '${users.third.id}' AND type = 'post_reaction'`,
  );
  check(
    bumped[0].rows === 1 && bumped[0].max_count === 2,
    "notifications: a second reaction bumps the same row (no spam)",
  );

  // Removing the last reaction removes its notification.
  await rpc(users.third.token, "react_to_post", { p_post: createdPosts[1], p_reaction: "" });
  await rpc(users.third.token, "react_to_post", { p_post: postId, p_reaction: "" });
  const afterClear = await sql(
    `SELECT reaction_count FROM public.notifications
     WHERE recipient_id = '${users.author.id}' AND actor_id = '${users.third.id}' AND type = 'post_reaction'`,
  );
  check(afterClear.length === 0, "notifications: gone when the reaction is removed");

  // ---- comment reactions use the same language ---------------------------
  const comment = await rest(users.reactor.token, "post_comments", {
    method: "POST",
    body: JSON.stringify({
      post_id: postId,
      author_id: users.reactor.id,
      body: `E2E comment ${stamp}`,
    }),
  });
  createdComments.push(comment.body[0].id);
  const commentId = createdComments[0];

  r = await rpc(users.author.token, "react_to_comment", {
    p_comment: commentId,
    p_reaction: "same",
  });
  check(
    r.ok && r.body.user_reaction === "same" && r.body.same === 1,
    "comment: create a reaction",
  );

  r = await rpc(users.author.token, "react_to_comment", {
    p_comment: commentId,
    p_reaction: "talk",
  });
  check(
    r.ok && r.body.user_reaction === "talk" && r.body.talk === 1 && r.body.same === 0,
    "comment: change a reaction",
  );

  const commentNotes = await sql(
    `SELECT type FROM public.notifications WHERE recipient_id = '${users.reactor.id}'`,
  );
  check(
    commentNotes.length === 1 && commentNotes[0].type === "comment_talk",
    "comment: talk reaction lands as comment_talk for the comment author",
  );

  r = await rpc(users.author.token, "react_to_comment", { p_comment: commentId, p_reaction: "" });
  check(r.ok && r.body.total === 0, "comment: remove a reaction");

  // ---- security, validation and cascade ----------------------------------
  r = await rpc(users.reactor.token, "react_to_post", {
    p_post: postId,
    p_reaction: "clap",
  });
  check(!r.ok, "guard: unknown reaction rejected");

  r = await rpc(users.reactor.token, "react_to_post", {
    p_post: "00000000-0000-4000-8000-000000000000",
    p_reaction: "fire",
  });
  check(!r.ok, "guard: unknown post rejected");

  r = await rpc("", "react_to_post", { p_post: postId, p_reaction: "fire" });
  check(!r.ok, "guard: unauthenticated caller rejected");

  // A member who is not approved yet cannot react at all.
  const pending = await rest(users.third.token, "rpc/react_to_post", {
    method: "POST",
    body: JSON.stringify({ p_post: postId, p_reaction: "fire" }),
  });
  await sql(`UPDATE public.profiles SET status = 'pending' WHERE id = '${users.third.id}'`);
  r = await rpc(users.third.token, "react_to_post", { p_post: postId, p_reaction: "fire" });
  check(!r.ok, "guard: pending member rejected");
  await sql(`UPDATE public.profiles SET status = 'approved' WHERE id = '${users.third.id}'`);
  check(pending.ok, "sanity: approved member could react before the status flip");

  // Deleting content takes its reactions with it (no orphans).
  await rpc(users.reactor.token, "react_to_post", { p_post: createdPosts[1], p_reaction: "talk" });
  const beforeDelete = await sql(
    `SELECT count(*) AS n FROM public.post_reactions WHERE post_id = '${createdPosts[1]}'`,
  );
  await rest(users.author.token, `posts?id=eq.${createdPosts[1]}`, { method: "DELETE" });
  const afterDelete = await sql(
    `SELECT count(*) AS n FROM public.post_reactions WHERE post_id = '${createdPosts[1]}'`,
  );
  check(
    beforeDelete[0].n === 1 && afterDelete[0].n === 0,
    "cascade: deleting a post removes its reactions",
  );
} finally {
  for (const id of createdPosts) {
    await sql(`DELETE FROM public.posts WHERE id = '${id}'`).catch(() => {});
  }
  for (const member of Object.values(users)) {
    await sql(`DELETE FROM auth.users WHERE id = '${member.id}'`).catch(() => {});
  }
  await sql(
    `DELETE FROM public.invite_code_uses WHERE invite_code_id IN (SELECT id FROM public.invite_codes WHERE code = '${inviteCode}')`,
  ).catch(() => {});
  await sql(`DELETE FROM public.invite_codes WHERE code = '${inviteCode}'`).catch(() => {});
  console.log("cleanup done");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
