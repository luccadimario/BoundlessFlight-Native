import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { certificateType, logCategory, logEntryType } from "./schema";
import { requireAircraft } from "./helpers";

export const listByAircraft = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    await requireAircraft(ctx, aircraftId);
    const entries = await ctx.db
      .query("logEntries")
      .withIndex("by_aircraft_date", (q) => q.eq("aircraftId", aircraftId))
      .order("desc")
      .collect();
    return await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        attachmentUrls: await Promise.all(
          entry.attachmentIds.map((id) => ctx.storage.getUrl(id)),
        ),
      })),
    );
  },
});

export const create = mutation({
  args: {
    aircraftId: v.id("aircraft"),
    category: logCategory,
    entryType: logEntryType,
    date: v.number(),
    tachTime: v.optional(v.number()),
    hobbsTime: v.optional(v.number()),
    totalTimeInService: v.optional(v.number()),
    description: v.string(),
    performedBy: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    certificateType: v.optional(certificateType),
    returnToService: v.boolean(),
    attachmentIds: v.array(v.id("_storage")),
    source: v.union(v.literal("manual"), v.literal("ocr")),
  },
  handler: async (ctx, args) => {
    await requireAircraft(ctx, args.aircraftId);
    const id = await ctx.db.insert("logEntries", args);
    // Keep the aircraft's running tach current if this entry is newer
    if (args.tachTime !== undefined) {
      const aircraft = await ctx.db.get(args.aircraftId);
      if (aircraft && args.tachTime > aircraft.currentTach) {
        await ctx.db.patch(args.aircraftId, { currentTach: args.tachTime });
      }
    }
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("logEntries") },
  handler: async (ctx, { id }) => {
    const entry = await ctx.db.get(id);
    if (!entry) return;
    await requireAircraft(ctx, entry.aircraftId);
    for (const storageId of entry.attachmentIds) {
      await ctx.storage.delete(storageId);
    }
    await ctx.db.delete(id);
  },
});
