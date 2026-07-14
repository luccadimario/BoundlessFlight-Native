import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAircraft } from "./helpers";

const adStatus = v.union(
  v.literal("open"),
  v.literal("complied"),
  v.literal("recurring"),
  v.literal("not_applicable"),
);

export const listByAircraft = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    await requireAircraft(ctx, aircraftId);
    return await ctx.db
      .query("airworthinessDirectives")
      .withIndex("by_aircraft", (q) => q.eq("aircraftId", aircraftId))
      .collect();
  },
});

export const create = mutation({
  args: {
    aircraftId: v.id("aircraft"),
    adNumber: v.string(),
    title: v.string(),
    appliesTo: v.optional(v.string()),
    status: adStatus,
    methodOfCompliance: v.optional(v.string()),
    complianceDate: v.optional(v.number()),
    complianceTach: v.optional(v.number()),
    recurringIntervalHours: v.optional(v.number()),
    recurringIntervalMonths: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAircraft(ctx, args.aircraftId);
    return await ctx.db.insert("airworthinessDirectives", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("airworthinessDirectives"),
    adNumber: v.optional(v.string()),
    title: v.optional(v.string()),
    appliesTo: v.optional(v.string()),
    status: v.optional(adStatus),
    methodOfCompliance: v.optional(v.string()),
    complianceDate: v.optional(v.number()),
    complianceTach: v.optional(v.number()),
    recurringIntervalHours: v.optional(v.number()),
    recurringIntervalMonths: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("AD not found");
    await requireAircraft(ctx, doc.aircraftId);
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("airworthinessDirectives") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await requireAircraft(ctx, doc.aircraftId);
    await ctx.db.delete(id);
  },
});
