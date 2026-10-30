import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { memberRole } from "./schema";
import { requireAircraft, requireUser, roleFor } from "./helpers";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// No 0/O/1/I/L — codes get read aloud and typed in on a hangar floor
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const listMembers = query({
  args: { aircraftId: v.id("aircraft") },
  handler: async (ctx, { aircraftId }) => {
    const aircraft = await requireAircraft(ctx, aircraftId, "read");
    const members = await ctx.db
      .query("aircraftMembers")
      .withIndex("by_aircraftId", (q) => q.eq("aircraftId", aircraftId))
      .collect();
    return members.map((m) => ({ ...m, isMe: m.userId === aircraft.callerId }));
  },
});

export const createInvite = mutation({
  args: { aircraftId: v.id("aircraft"), role: memberRole },
  handler: async (ctx, { aircraftId, role }) => {
    const aircraft = await requireAircraft(ctx, aircraftId, "owner");
    let code = randomCode();
    while (
      await ctx.db
        .query("aircraftInvites")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique()
    ) {
      code = randomCode();
    }
    const expiresAt = Date.now() + INVITE_TTL_MS;
    await ctx.db.insert("aircraftInvites", {
      aircraftId,
      code,
      role,
      createdBy: aircraft.callerId,
      expiresAt,
    });
    return { code, expiresAt };
  },
});

export const joinWithCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const code = normalizeCode(args.code);
    const invite = await ctx.db
      .query("aircraftInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite || invite.usedBy !== undefined || invite.expiresAt < Date.now()) {
      throw new ConvexError("That invite code is invalid or has expired.");
    }
    const aircraft = await ctx.db.get(invite.aircraftId);
    if (!aircraft) throw new ConvexError("That aircraft no longer exists.");
    if (await roleFor(ctx, aircraft, user._id)) {
      throw new ConvexError(`You already have access to ${aircraft.tailNumber}.`);
    }
    await ctx.db.insert("aircraftMembers", {
      aircraftId: aircraft._id,
      userId: user._id,
      role: invite.role,
      displayName: user.name || user.email || "Member",
    });
    await ctx.db.patch(invite._id, { usedBy: user._id });
    return { aircraftId: aircraft._id, tailNumber: aircraft.tailNumber, role: invite.role };
  },
});

// Owner removes someone, or a member leaves on their own
export const removeMember = mutation({
  args: { memberId: v.id("aircraftMembers") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    if (!member) return;
    const aircraft = await requireAircraft(ctx, member.aircraftId, "read");
    if (aircraft.role !== "owner" && member.userId !== aircraft.callerId) {
      throw new ConvexError("Only the aircraft owner can remove other members.");
    }
    await ctx.db.delete(memberId);
  },
});
