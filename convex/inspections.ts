import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { inspectionType } from "./schema";
import { requireAircraft } from "./helpers";

export const listByAircraft = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    await requireAircraft(ctx, aircraftId, "read");
    return await ctx.db
      .query("inspections")
      .withIndex("by_aircraft", (q) => q.eq("aircraftId", aircraftId))
      .collect();
  },
});

export const create = mutation({
  args: {
    aircraftId: v.id("aircraft"),
    type: inspectionType,
    name: v.string(),
    intervalCalendarMonths: v.optional(v.number()),
    intervalDays: v.optional(v.number()),
    intervalHours: v.optional(v.number()),
    tracked: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAircraft(ctx, args.aircraftId, "owner");
    return await ctx.db.insert("inspections", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("inspections"),
    name: v.optional(v.string()),
    intervalCalendarMonths: v.optional(v.number()),
    intervalDays: v.optional(v.number()),
    intervalHours: v.optional(v.number()),
    tracked: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const doc = await ctx.db.get(id);
    if (!doc) throw new Error("Inspection not found");
    await requireAircraft(ctx, doc.aircraftId, "owner");
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(id, patch);
  },
});

// Record completion; optionally writes the matching 91.417 log entry
export const complete = mutation({
  args: {
    id: v.id("inspections"),
    date: v.number(),
    tach: v.optional(v.number()),
    createLogEntry: v.boolean(),
    performedBy: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inspection = await ctx.db.get(args.id);
    if (!inspection) throw new Error("Inspection not found");
    const aircraft = await requireAircraft(ctx, inspection.aircraftId, "write");
    await ctx.db.patch(args.id, {
      lastDoneDate: args.date,
      lastDoneTach: args.tach,
    });
    if (args.createLogEntry) {
      await ctx.db.insert("logEntries", {
        aircraftId: inspection.aircraftId,
        category: "airframe",
        entryType: "inspection",
        date: args.date,
        tachTime: args.tach,
        description: `${inspection.name} completed. Aircraft approved for return to service.`,
        performedBy: args.performedBy,
        certificateNumber: args.certificateNumber,
        certificateType: args.certificateNumber ? "IA" : undefined,
        returnToService: true,
        attachmentIds: [],
        source: "manual",
        createdBy: aircraft.callerId,
      });
    }
  },
});

export const remove = mutation({
  args: { id: v.id("inspections") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc) return;
    await requireAircraft(ctx, doc.aircraftId, "owner");
    await ctx.db.delete(id);
  },
});
