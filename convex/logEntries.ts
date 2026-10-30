import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { certificateType, logCategory, logEntryType } from "./schema";
import { requireAircraft } from "./helpers";

export const listByAircraft = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    await requireAircraft(ctx, aircraftId, "read");
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
    const aircraft = await requireAircraft(ctx, args.aircraftId, "write");
    const id = await ctx.db.insert("logEntries", { ...args, createdBy: aircraft.callerId });
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

// Entries are append-only: a mistake is voided (kept, struck through, with a
// reason) rather than deleted, so the record stays trustworthy for a buyer or
// inspector. Correct it by adding a new entry.
export const voidEntry = mutation({
  args: { id: v.id("logEntries"), reason: v.string() },
  handler: async (ctx, { id, reason }) => {
    const entry = await ctx.db.get(id);
    if (!entry) throw new ConvexError("Entry not found");
    const aircraft = await requireAircraft(ctx, entry.aircraftId, "write");
    if (entry.voidedAt !== undefined) return;
    if (!reason.trim()) throw new ConvexError("A reason is required to void an entry.");
    await ctx.db.patch(id, {
      voidedAt: Date.now(),
      voidedBy: aircraft.callerId,
      voidReason: reason.trim(),
    });
  },
});
