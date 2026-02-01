import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { C } from "~/helpers/constants.ts";
import { db } from "~/server/db/provider.ts";
import { usersTable } from "~/server/db/schema/auth-schema.ts";
import type { Role } from "~/server/permissions.ts";
import { updateUserSF } from "~/server/serverFunctions/serverFunctions.ts";

const { revokeUserSessionsSpy, sendEmailSpy, sendRoleChangedEmailSpy } = vi.hoisted(() => ({
  revokeUserSessionsSpy: vi.fn(),
  sendEmailSpy: vi.fn(),
  sendRoleChangedEmailSpy: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn() }));

vi.mock("~/server/auth.ts", () => ({
  auth: {
    api: {
      setRole: async ({ body: { userId, role } }: { body: { userId: string; role: Role } }) => {
        await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId));
      },
      revokeUserSessions: revokeUserSessionsSpy,
    },
  },
}));

vi.mock("~/server/email/mailer.ts", () => ({ sendEmail: sendEmailSpy, sendRoleChangedEmail: sendRoleChangedEmailSpy }));

describe("updateUserSF", () => {
  it("updates user's person ID", async () => {
    const notYetTakenPersonId = 5;
    const user = (await db.query.users.findFirst({ where: { username: "user" } }))!;
    expect(user.personId).toBe(3);

    const res = await updateUserSF({ id: user.id, personId: notYetTakenPersonId, role: user.role as Role });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(revokeUserSessionsSpy).toHaveBeenCalledOnce();
    expect(res.data!.person!.id).toBe(notYetTakenPersonId);
  });

  it("updates user's role to mod", async () => {
    const role = "mod";
    const user = (await db.query.users.findFirst({ where: { username: "user" } }))!;

    const res = await updateUserSF({ id: user.id, personId: user.personId, role });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(sendRoleChangedEmailSpy).toHaveBeenCalledWith(user.email, role, { canAccessModDashboard: true });
    expect(res.data!.user.role).toBe("mod");
  });

  it("updates user's role to admin", async () => {
    const role = "admin";
    const user = (await db.query.users.findFirst({ where: { username: "user" } }))!;
    const person = (await db.query.persons.findFirst({ where: { id: user.personId! } }))!;

    const res = await updateUserSF({ id: user.id, personId: user.personId, role });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(sendRoleChangedEmailSpy).toHaveBeenCalledWith(user.email, role, { canAccessModDashboard: true });
    expect(sendEmailSpy).toHaveBeenCalledWith(
      C.contactEmail,
      "Important: New admin user",
      `User ${user.username} (${person.name}) has been given the admin role.`,
    );
    expect(res.data!.user.role).toBe(role);
  });

  describe("server errors", () => {
    it("throws error for user not found", async () => {
      const res = await updateUserSF({ id: "INVALID", personId: 1, role: "user" });

      expect(res.validationErrors).toBeUndefined();
      expect(res.serverError?.message).toBe("User not found");
    });

    it("throws error for email not verified", async () => {
      const emailNotVerifiedUser = (await db.query.users.findFirst({ where: { emailVerified: false } }))!;
      const res = await updateUserSF({ id: emailNotVerifiedUser.id, role: emailNotVerifiedUser.role as Role });

      expect(res.validationErrors).toBeUndefined();
      expect(res.serverError?.message).toBe("This user hasn't verified their email address yet");
    });

    it("throws error for person ID not found", async () => {
      const user = (await db.query.users.findFirst({ where: { username: "user" } }))!;
      const res = await updateUserSF({ id: user.id, personId: 999999999, role: user.role as Role });

      expect(res.validationErrors).toBeUndefined();
      expect(res.serverError?.message).toBe("Person with ID 999999999 not found");
    });

    it("throws error for person already tied to another user", async () => {
      const user = (await db.query.users.findFirst({ where: { username: "user" } }))!;
      const mod = (await db.query.users.findFirst({ where: { username: "mod" } }))!;
      const res = await updateUserSF({ id: user.id, personId: mod.personId, role: user.role as Role });

      expect(res.validationErrors).toBeUndefined();
      expect(res.serverError?.message).toBe("The selected person is already tied to another user");
    });

    it("throws error for missing person ID for privileged user", async () => {
      const user = (await db.query.users.findFirst({ where: { username: "user" } }))!;
      const res = await updateUserSF({ id: user.id, role: "mod" });

      expect(res.validationErrors).toBeUndefined();
      expect(res.serverError?.message).toBe("Privileged users must have a person tied to their account");
    });
  });
});
