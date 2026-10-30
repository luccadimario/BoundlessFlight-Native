import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAircraft, requireUserId } from "./helpers";

const documentKind = v.union(
  v.literal("airworthiness_certificate"),
  v.literal("registration"),
  v.literal("weight_and_balance"),
  v.literal("poh_afm"),
  v.literal("logbook_scan"),
  v.literal("insurance"),
  v.literal("stc_337"),
  v.literal("other"),
);

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listByAircraft = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    await requireAircraft(ctx, aircraftId, "read");
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_aircraft", (q) => q.eq("aircraftId", aircraftId))
      .order("desc")
      .collect();
    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      })),
    );
  },
});

export const create = mutation({
  args: {
    aircraftId: v.id("aircraft"),
    kind: documentKind,
    title: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.optional(v.string()),
    expiresOn: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAircraft(ctx, args.aircraftId, "write");
    return await ctx.db.insert("documents", args);
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await requireAircraft(ctx, doc.aircraftId, "owner");
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(id);
  },
});
