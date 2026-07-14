import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const logCategory = v.union(
  v.literal("airframe"),
  v.literal("engine"),
  v.literal("propeller"),
  v.literal("avionics"),
  v.literal("other"),
);

export const logEntryType = v.union(
  v.literal("maintenance"),
  v.literal("inspection"),
  v.literal("alteration"),
  v.literal("preventive"),
  v.literal("overhaul"),
);

export const certificateType = v.union(
  v.literal("A&P"),
  v.literal("IA"),
  v.literal("repair_station"),
  v.literal("owner"),
  v.literal("other"),
);

// AV1ATE(S) + ownership items a GA pilot has to keep current
export const inspectionType = v.union(
  v.literal("annual"), // 91.409(a) — 12 calendar months
  v.literal("hundred_hour"), // 91.409(b) — for hire / instruction
  v.literal("transponder"), // 91.413 — 24 calendar months
  v.literal("pitot_static"), // 91.411 — 24 calendar months (IFR)
  v.literal("elt"), // 91.207(d) — 12 calendar months
  v.literal("elt_battery"), // 91.207(c)
  v.literal("vor"), // 91.171 — 30 days (IFR)
  v.literal("oil_change"),
  v.literal("registration"), // 7-year renewal
  v.literal("custom"),
);

export default defineSchema({
  aircraft: defineTable({
    userId: v.string(), // Better Auth user id — owner of this aircraft
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
    notes: v.optional(v.string()),
  })
    .index("by_tail", ["tailNumber"])
    .index("by_user", ["userId"]),

  // 91.417-compliant maintenance record entries
  logEntries: defineTable({
    aircraftId: v.id("aircraft"),
    category: logCategory,
    entryType: logEntryType,
    date: v.number(), // ms epoch, date work was completed
    tachTime: v.optional(v.number()),
    hobbsTime: v.optional(v.number()),
    totalTimeInService: v.optional(v.number()),
    description: v.string(), // description of work performed (91.417(a)(1)(i))
    performedBy: v.optional(v.string()), // name of person approving return to service
    certificateNumber: v.optional(v.string()),
    certificateType: v.optional(certificateType),
    returnToService: v.boolean(),
    attachmentIds: v.array(v.id("_storage")), // scanned pages / photos
    source: v.union(v.literal("manual"), v.literal("ocr")),
  })
    .index("by_aircraft", ["aircraftId"])
    .index("by_aircraft_date", ["aircraftId", "date"]),

  inspections: defineTable({
    aircraftId: v.id("aircraft"),
    type: inspectionType,
    name: v.string(),
    // interval — any combination; due is whichever comes first
    intervalCalendarMonths: v.optional(v.number()), // due end of Nth month
    intervalDays: v.optional(v.number()), // exact-day intervals (VOR 30-day)
    intervalHours: v.optional(v.number()), // tach-hour intervals
    lastDoneDate: v.optional(v.number()),
    lastDoneTach: v.optional(v.number()),
    notes: v.optional(v.string()),
    tracked: v.boolean(), // e.g. 100-hour off for private-only operations
  }).index("by_aircraft", ["aircraftId"]),

  airworthinessDirectives: defineTable({
    aircraftId: v.id("aircraft"),
    adNumber: v.string(), // e.g. 2024-05-11
    title: v.string(),
    appliesTo: v.optional(v.string()), // airframe / engine / prop / appliance
    status: v.union(
      v.literal("open"),
      v.literal("complied"),
      v.literal("recurring"),
      v.literal("not_applicable"),
    ),
    methodOfCompliance: v.optional(v.string()),
    complianceDate: v.optional(v.number()),
    complianceTach: v.optional(v.number()),
    recurringIntervalHours: v.optional(v.number()),
    recurringIntervalMonths: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_aircraft", ["aircraftId"]),

  // ARROW documents + scanned logbooks
  documents: defineTable({
    aircraftId: v.id("aircraft"),
    kind: v.union(
      v.literal("airworthiness_certificate"),
      v.literal("registration"),
      v.literal("weight_and_balance"),
      v.literal("poh_afm"),
      v.literal("logbook_scan"),
      v.literal("insurance"),
      v.literal("stc_337"),
      v.literal("other"),
    ),
    title: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.optional(v.string()),
    expiresOn: v.optional(v.number()), // registration / insurance expiry
    notes: v.optional(v.string()),
  }).index("by_aircraft", ["aircraftId"]),

  squawks: defineTable({
    aircraftId: v.id("aircraft"),
    description: v.string(),
    severity: v.union(
      v.literal("grounding"),
      v.literal("monitor"),
      v.literal("note"),
    ),
    status: v.union(v.literal("open"), v.literal("resolved")),
    resolvedAt: v.optional(v.number()),
    resolutionNotes: v.optional(v.string()),
  }).index("by_aircraft", ["aircraftId"]),
});
