import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAircraft } from "./helpers";

export const listByAircraft = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    await requireAircraft(ctx, aircraftId, "read");
    return await ctx.db
      .query("squawks")
      .withIndex("by_aircraft", (q) => q.eq("aircraftId", aircraftId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    aircraftId: v.id("aircraft"),
    description: v.string(),
    severity: v.union(
      v.literal("grounding"),
      v.literal("monitor"),
      v.literal("note"),
    ),
  },
  handler: async (ctx, args) => {
    // Any pilot on the aircraft can report a problem; resolving takes write access
    await requireAircraft(ctx, args.aircraftId, "read");
    return await ctx.db.insert("squawks", { ...args, status: "open" });
  },
});

export const resolve = mutation({
  args: {
    id: v.id("squawks"),
    resolutionNotes: v.optional(v.string()),
  },
  handler: async (ctx, { id, resolutionNotes }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Squawk not found");
    await requireAircraft(ctx, doc.aircraftId, "write");
    await ctx.db.patch(id, {
      status: "resolved",
      resolvedAt: Date.now(),
      resolutionNotes,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("squawks") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await requireAircraft(ctx, doc.aircraftId, "owner");
    await ctx.db.delete(id);
  },
});
