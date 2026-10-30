import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

export type Role = "owner" | "mechanic" | "viewer";

// read: anyone on the aircraft. write: owner + mechanic (log entries, inspections,
// squawks, ADs, documents). owner: settings, deletes, sharing.
export type Access = "read" | "write" | "owner";

const ALLOWED: Record<Access, Role[]> = {
  read: ["owner", "mechanic", "viewer"],
  write: ["owner", "mechanic"],
  owner: ["owner"],
};

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new ConvexError("Not signed in");
  return user;
}

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  return (await requireUser(ctx))._id;
}

export async function roleFor(
  ctx: QueryCtx | MutationCtx,
  aircraft: Doc<"aircraft">,
  userId: string,
): Promise<Role | null> {
  if (aircraft.userId === userId) return "owner";
  const member = await ctx.db
    .query("aircraftMembers")
    .withIndex("by_aircraftId_and_userId", (q) =>
      q.eq("aircraftId", aircraft._id).eq("userId", userId),
    )
    .unique();
  return member?.role ?? null;
}

// Loads an aircraft and verifies the signed-in user has the needed access.
// Every child-table function goes through this so records can't cross accounts.
export async function requireAircraft(
  ctx: QueryCtx | MutationCtx,
  aircraftId: Id<"aircraft">,
  access: Access,
): Promise<Doc<"aircraft"> & { role: Role; callerId: string }> {
  const userId = await requireUserId(ctx);
  const aircraft = await ctx.db.get(aircraftId);
  const role = aircraft ? await roleFor(ctx, aircraft, userId) : null;
  if (!aircraft || !role) throw new ConvexError("Aircraft not found");
  if (!ALLOWED[access].includes(role)) {
    throw new ConvexError(
      role === "viewer"
        ? "You have view-only access to this aircraft."
        : "Only the aircraft owner can do that.",
    );
  }
  return { ...aircraft, role, callerId: userId };
}
