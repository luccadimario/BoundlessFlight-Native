/// <reference types="vite/client" />
import { vi } from "vitest";

// Better Auth's user lookup needs its component tables; in tests the signed-in
// user is just the identity convex-test attaches (subject = Better Auth user id).
vi.mock("./auth", () => ({
  authComponent: {
    getAuthUser: async (ctx: { auth: { getUserIdentity: () => Promise<any> } }) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      return { _id: identity.subject, name: identity.name, email: identity.email };
    },
  },
}));

export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
