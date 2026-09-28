import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVerifiedRoleMap,
  type VerifiedRoleRow,
} from "./queries.ts";

function row(overrides: Partial<VerifiedRoleRow> = {}): VerifiedRoleRow {
  return {
    id: "assignment-1",
    user_id: "user-1",
    university_role_id: "role-1",
    verification_status: "verified",
    verified_at: "2026-09-01T10:00:00.000Z",
    expires_at: null,
    role: {
      name_en: "Lecturer",
      name_ar: "مدرس دكتور",
      category: "teaching",
      display_priority: 60,
      is_active: true,
    },
    ...overrides,
  };
}

describe("buildVerifiedRoleMap", () => {
  it("returns an empty map for no rows", () => {
    assert.equal(buildVerifiedRoleMap([]).size, 0);
  });

  it("maps a verified row to the badge shape", () => {
    const map = buildVerifiedRoleMap([row()]);
    const roles = map.get("user-1");

    assert.ok(roles);
    assert.equal(roles.length, 1);
    assert.equal(roles[0].nameEn, "Lecturer");
    assert.equal(roles[0].nameAr, "مدرس دكتور");
    assert.equal(roles[0].category, "teaching");
    assert.equal(roles[0].verificationStatus, "verified");
    assert.equal(roles[0].expiresAt, null);
  });

  it("drops rows whose role definition was deactivated", () => {
    const map = buildVerifiedRoleMap([row({ role: { ...row().role!, is_active: false } })]);
    assert.equal(map.size, 0);
  });

  it("drops rows where the role definition join is missing", () => {
    const map = buildVerifiedRoleMap([row({ role: null })]);
    assert.equal(map.size, 0);
  });

  it("groups multiple users and sorts each by display priority desc", () => {
    const map = buildVerifiedRoleMap([
      row({
        id: "a1",
        user_id: "u1",
        role: { name_en: "Demonstrator", name_ar: "معيد", category: "teaching", display_priority: 50, is_active: true },
      }),
      row({
        id: "a2",
        user_id: "u1",
        university_role_id: "role-2",
        role: { name_en: "Dean", name_ar: "عميد", category: "leadership", display_priority: 90, is_active: true },
      }),
      row({
        id: "a3",
        user_id: "u2",
        role: { name_en: "IT Staff", name_ar: "فريق تكنولوجيا المعلومات", category: "support", display_priority: 30, is_active: true },
      }),
    ]);

    assert.equal(map.size, 2);
    assert.deepEqual(
      map.get("u1")?.map((role) => role.nameEn),
      ["Dean", "Demonstrator"],
    );
    assert.deepEqual(
      map.get("u2")?.map((role) => role.nameEn),
      ["IT Staff"],
    );
  });
});
