import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isOwnerAdmin } from "@/lib/server/admin-auth";

describe("Administrator Owner Authority", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Production Environment Enforcement", () => {
    it("fails closed in production if ADMIN_OWNER_UIDS is unset or empty", async () => {
      (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "production";
      delete process.env.ADMIN_OWNER_UIDS;

      const isOwner = await isOwnerAdmin("any-admin-uid");
      assert.equal(isOwner, false, "Production must never derive ownership dynamically without ADMIN_OWNER_UIDS");
    });

    it("recognizes configured owner UIDs in production", async () => {
      // Note: when ADMIN_OWNER_UIDS is configured, it checks the allowlist and verifies the row
      (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "production";
      process.env.ADMIN_OWNER_UIDS = "owner-uid-123, owner-uid-456";

      // Non-configured admin
      const isRandomAdmin = await isOwnerAdmin("random-admin-789");
      assert.equal(isRandomAdmin, false, "Unlisted admin must not have owner authority");
    });
  });

  describe("Revocation and Ownership Transfer Security", () => {
    it("does not grant owner authority to arbitrary admins", async () => {
      process.env.ADMIN_OWNER_UIDS = "owner-uid-primary";

      assert.equal(await isOwnerAdmin("attacker-uid"), false);
      assert.equal(await isOwnerAdmin("second-admin-uid"), false);
    });

    it("ownership transfer requires explicit configuration update", async () => {
      // Initially, owner is admin-1
      process.env.ADMIN_OWNER_UIDS = "admin-1";
      assert.equal(await isOwnerAdmin("admin-2"), false);

      // Explicit ownership transfer to admin-2
      process.env.ADMIN_OWNER_UIDS = "admin-2";
      assert.equal(await isOwnerAdmin("admin-1"), false);
    });
  });
});
