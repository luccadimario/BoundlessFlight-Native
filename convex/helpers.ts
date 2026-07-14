import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new Error("Not signed in");
  return user._id;
}

// Loads an aircraft and verifies it belongs to the signed-in user. Every
// child-table function goes through this so records can't cross accounts.
export async function requireAircraft(
  ctx: QueryCtx | MutationCtx,
  aircraftId: Id<"aircraft">,
): Promise<Doc<"aircraft">> {
  const userId = await requireUserId(ctx);
  const aircraft = await ctx.db.get(aircraftId);
  if (!aircraft || aircraft.userId !== userId) {
    throw new Error("Aircraft not found");
  }
  return aircraft;
}
