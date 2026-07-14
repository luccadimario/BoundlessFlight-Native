import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAircraft, requireUserId } from "./helpers";

// Default inspection set seeded for every new aircraft (AV1ATE + ownership items)
const DEFAULT_INSPECTIONS: Array<{
  type:
    | "annual"
    | "hundred_hour"
    | "transponder"
    | "pitot_static"
    | "elt"
    | "elt_battery"
    | "vor"
    | "oil_change"
    | "registration";
  name: string;
  intervalCalendarMonths?: number;
  intervalDays?: number;
  intervalHours?: number;
  tracked: boolean;
}> = [
  { type: "annual", name: "Annual Inspection (91.409)", intervalCalendarMonths: 12, tracked: true },
  { type: "hundred_hour", name: "100-Hour Inspection (91.409b)", intervalHours: 100, tracked: false },
  { type: "transponder", name: "Transponder Check (91.413)", intervalCalendarMonths: 24, tracked: true },
  { type: "pitot_static", name: "Pitot-Static / Altimeter (91.411)", intervalCalendarMonths: 24, tracked: true },
  { type: "elt", name: "ELT Inspection (91.207d)", intervalCalendarMonths: 12, tracked: true },
  { type: "elt_battery", name: "ELT Battery Replacement", intervalCalendarMonths: 24, tracked: true },
  { type: "vor", name: "VOR Check (91.171, IFR)", intervalDays: 30, tracked: false },
  { type: "oil_change", name: "Oil Change", intervalHours: 50, tracked: true },
  { type: "registration", name: "Registration Renewal", intervalCalendarMonths: 84, tracked: true },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("aircraft")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("aircraft") },
  handler: async (ctx, { id }) => {
    return await requireAircraft(ctx, id);
  },
});

export const create = mutation({
  args: {
    tailNumber: v.string(),
    make: v.string(),
    model: v.string(),
    serial: v.optional(v.string()),
    year: v.optional(v.number()),
    engineMake: v.optional(v.string()),
    engineModel: v.optional(v.string()),
    propModel: v.optional(v.string()),
    currentTach: v.number(),
    currentHobbs: v.optional(v.number()),
    airframeTotalTime: v.optional(v.number()),
    engineTimeSinceOverhaul: v.optional(v.number()),
    engineTBO: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const id = await ctx.db.insert("aircraft", { ...args, userId });
    for (const insp of DEFAULT_INSPECTIONS) {
      await ctx.db.insert("inspections", { aircraftId: id, ...insp });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("aircraft"),
    tailNumber: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    serial: v.optional(v.string()),
    year: v.optional(v.number()),
    engineMake: v.optional(v.string()),
    engineModel: v.optional(v.string()),
    propModel: v.optional(v.string()),
    currentTach: v.optional(v.number()),
    currentHobbs: v.optional(v.number()),
    airframeTotalTime: v.optional(v.number()),
    engineTimeSinceOverhaul: v.optional(v.number()),
    engineTBO: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireAircraft(ctx, id);
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("aircraft") },
  handler: async (ctx, { id }) => {
    await requireAircraft(ctx, id);
    const tables = [
      "logEntries",
      "inspections",
      "airworthinessDirectives",
      "documents",
      "squawks",
    ] as const;
    for (const table of tables) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_aircraft", (q) => q.eq("aircraftId", id))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    await ctx.db.delete(id);
  },
});
