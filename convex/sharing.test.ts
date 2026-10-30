import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = { subject: "user_owner", name: "Olivia Owner" };
const MECH = { subject: "user_mech", name: "Manny Mechanic" };
const VIEWER = { subject: "user_viewer", name: "Vic Viewer" };
const STRANGER = { subject: "user_stranger", name: "Sam Stranger" };

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  const aircraftId = await owner.mutation(api.aircraft.create, {
    tailNumber: "N12345",
    make: "Cessna",
    model: "172S",
    currentTach: 1000,
  });
  return { t, owner, aircraftId };
}

async function invite(
  owner: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  aircraftId: any,
  role: "mechanic" | "viewer",
) {
  return (await owner.mutation(api.sharing.createInvite, { aircraftId, role })).code;
}

const entry = (aircraftId: any) => ({
  aircraftId,
  category: "engine" as const,
  entryType: "maintenance" as const,
  date: Date.now(),
  tachTime: 1012.4,
  description: "Changed oil and filter.",
  returnToService: true,
  attachmentIds: [],
  source: "manual" as const,
});

describe("sharing", () => {
  test("new aircraft is seeded with inspections and listed as owner", async () => {
    const { owner, aircraftId } = await setup();
    const fleet = await owner.query(api.aircraft.list, {});
    expect(fleet).toHaveLength(1);
    expect(fleet[0].role).toBe("owner");
    const inspections = await owner.query(api.inspections.listByAircraft, { aircraftId });
    expect(inspections.length).toBe(9);
  });

  test("strangers cannot see or touch an aircraft", async () => {
    const { t, aircraftId } = await setup();
    const stranger = t.withIdentity(STRANGER);
    await expect(stranger.query(api.aircraft.get, { id: aircraftId })).rejects.toThrow(/not found/);
    await expect(stranger.query(api.logEntries.listByAircraft, { aircraftId })).rejects.toThrow(/not found/);
    await expect(stranger.mutation(api.logEntries.create, entry(aircraftId))).rejects.toThrow(/not found/);
    expect(await stranger.query(api.aircraft.list, {})).toHaveLength(0);
  });

  test("mechanic joins with a code, can log work but not change settings", async () => {
    const { t, owner, aircraftId } = await setup();
    const code = await invite(owner, aircraftId, "mechanic");
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    const mech = t.withIdentity(MECH);
    // codes are forgiving about case and separators
    const joined = await mech.mutation(api.sharing.joinWithCode, {
      code: `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`,
    });
    expect(joined).toMatchObject({ tailNumber: "N12345", role: "mechanic" });

    const fleet = await mech.query(api.aircraft.list, {});
    expect(fleet.map((a) => [a.tailNumber, a.role])).toEqual([["N12345", "mechanic"]]);

    const entryId = await mech.mutation(api.logEntries.create, entry(aircraftId));
    const entries = await owner.query(api.logEntries.listByAircraft, { aircraftId });
    expect(entries[0]._id).toBe(entryId);
    expect(entries[0].createdBy).toBe(MECH.subject);
    // logging a later tach advances the aircraft
    expect((await owner.query(api.aircraft.get, { id: aircraftId })).currentTach).toBe(1012.4);

    const [annual] = (await mech.query(api.inspections.listByAircraft, { aircraftId })).filter(
      (i) => i.type === "annual",
    );
    await mech.mutation(api.inspections.complete, {
      id: annual._id,
      date: Date.now(),
      tach: 1012.4,
      createLogEntry: true,
      performedBy: "Manny Mechanic",
      certificateNumber: "IA 1234567",
    });

    await expect(mech.mutation(api.aircraft.update, { id: aircraftId, tailNumber: "N666" })).rejects.toThrow(
      /owner/,
    );
    await expect(mech.mutation(api.aircraft.remove, { id: aircraftId })).rejects.toThrow(/owner/);
    await expect(mech.mutation(api.inspections.update, { id: annual._id, tracked: false })).rejects.toThrow(
      /owner/,
    );
    await expect(mech.mutation(api.sharing.createInvite, { aircraftId, role: "viewer" })).rejects.toThrow(
      /owner/,
    );
  });

  test("viewer can read and report squawks only", async () => {
    const { t, owner, aircraftId } = await setup();
    const viewer = t.withIdentity(VIEWER);
    await viewer.mutation(api.sharing.joinWithCode, { code: await invite(owner, aircraftId, "viewer") });

    expect(await viewer.query(api.logEntries.listByAircraft, { aircraftId })).toEqual([]);
    const squawkId = await viewer.mutation(api.squawks.create, {
      aircraftId,
      description: "Left brake soft",
      severity: "monitor",
    });
    await expect(viewer.mutation(api.squawks.resolve, { id: squawkId })).rejects.toThrow(/view-only/);
    await expect(viewer.mutation(api.logEntries.create, entry(aircraftId))).rejects.toThrow(/view-only/);
  });

  test("invite codes are single use and can't re-add existing members", async () => {
    const { t, owner, aircraftId } = await setup();
    const code = await invite(owner, aircraftId, "mechanic");
    await t.withIdentity(MECH).mutation(api.sharing.joinWithCode, { code });
    await expect(t.withIdentity(VIEWER).mutation(api.sharing.joinWithCode, { code })).rejects.toThrow(
      /invalid or has expired/,
    );
    await expect(
      owner.mutation(api.sharing.joinWithCode, { code: await invite(owner, aircraftId, "viewer") }),
    ).rejects.toThrow(/already have access/);
    await expect(
      t.withIdentity(VIEWER).mutation(api.sharing.joinWithCode, { code: "ZZZZZZZZ" }),
    ).rejects.toThrow(/invalid/);
  });

  test("expired invite is rejected", async () => {
    const { t, owner, aircraftId } = await setup();
    const code = await invite(owner, aircraftId, "mechanic");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("aircraftInvites")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      await ctx.db.patch(row!._id, { expiresAt: Date.now() - 1 });
    });
    await expect(t.withIdentity(MECH).mutation(api.sharing.joinWithCode, { code })).rejects.toThrow(
      /expired/,
    );
  });

  test("members can leave; only the owner can remove others", async () => {
    const { t, owner, aircraftId } = await setup();
    const mech = t.withIdentity(MECH);
    const viewer = t.withIdentity(VIEWER);
    await mech.mutation(api.sharing.joinWithCode, { code: await invite(owner, aircraftId, "mechanic") });
    await viewer.mutation(api.sharing.joinWithCode, { code: await invite(owner, aircraftId, "viewer") });

    const members = await owner.query(api.sharing.listMembers, { aircraftId });
    const mechRow = members.find((m) => m.userId === MECH.subject)!;
    const viewerRow = members.find((m) => m.userId === VIEWER.subject)!;
    expect(mechRow.displayName).toBe("Manny Mechanic");

    await expect(viewer.mutation(api.sharing.removeMember, { memberId: mechRow._id })).rejects.toThrow(
      /owner/,
    );
    await viewer.mutation(api.sharing.removeMember, { memberId: viewerRow._id });
    expect(await viewer.query(api.aircraft.list, {})).toHaveLength(0);

    await owner.mutation(api.sharing.removeMember, { memberId: mechRow._id });
    await expect(mech.query(api.logEntries.listByAircraft, { aircraftId })).rejects.toThrow(/not found/);
  });

  test("deleting an aircraft removes memberships and invites", async () => {
    const { t, owner, aircraftId } = await setup();
    await t.withIdentity(MECH).mutation(api.sharing.joinWithCode, {
      code: await invite(owner, aircraftId, "mechanic"),
    });
    await invite(owner, aircraftId, "viewer");
    await owner.mutation(api.aircraft.remove, { id: aircraftId });
    const leftovers = await t.run(async (ctx) => ({
      members: await ctx.db.query("aircraftMembers").collect(),
      invites: await ctx.db.query("aircraftInvites").collect(),
    }));
    expect(leftovers).toEqual({ members: [], invites: [] });
    expect(await t.withIdentity(MECH).query(api.aircraft.list, {})).toEqual([]);
  });
});

describe("append-only logbook", () => {
  test("voiding keeps the entry with who, when and why", async () => {
    const { t, owner, aircraftId } = await setup();
    const id = await owner.mutation(api.logEntries.create, entry(aircraftId));
    await owner.mutation(api.logEntries.voidEntry, { id, reason: "  Wrong aircraft  " });
    const [voided] = await owner.query(api.logEntries.listByAircraft, { aircraftId });
    expect(voided._id).toBe(id);
    expect(voided.description).toBe("Changed oil and filter.");
    expect(voided.voidReason).toBe("Wrong aircraft");
    expect(voided.voidedBy).toBe(OWNER.subject);
    expect(voided.voidedAt).toBeTypeOf("number");

    // voiding twice doesn't overwrite the original reason
    await owner.mutation(api.logEntries.voidEntry, { id, reason: "Something else" });
    const [again] = await owner.query(api.logEntries.listByAircraft, { aircraftId });
    expect(again.voidReason).toBe("Wrong aircraft");

    const viewer = t.withIdentity(VIEWER);
    await viewer.mutation(api.sharing.joinWithCode, { code: await invite(owner, aircraftId, "viewer") });
    const id2 = await owner.mutation(api.logEntries.create, entry(aircraftId));
    await expect(viewer.mutation(api.logEntries.voidEntry, { id: id2, reason: "x" })).rejects.toThrow(
      /view-only/,
    );
  });

  test("a reason is required", async () => {
    const { owner, aircraftId } = await setup();
    const id = await owner.mutation(api.logEntries.create, entry(aircraftId));
    await expect(owner.mutation(api.logEntries.voidEntry, { id, reason: "   " })).rejects.toThrow(/reason/);
  });
});
