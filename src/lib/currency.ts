import type { Doc } from "../../convex/_generated/dataModel";

export type DueStatus = "ok" | "due_soon" | "overdue" | "no_record" | "untracked";

export type DueInfo = {
  status: DueStatus;
  dueDate?: number; // ms epoch
  dueTach?: number;
  daysRemaining?: number;
  hoursRemaining?: number;
};

const DAY_MS = 86_400_000;
const SOON_DAYS = 30;
const SOON_HOURS = 10;

// Calendar-month rule (91.409 etc.): due at the end of the Nth month after
// the month the work was done.
export function endOfCalendarMonths(fromDate: number, months: number): number {
  const d = new Date(fromDate);
  return new Date(d.getFullYear(), d.getMonth() + months + 1, 0, 23, 59, 59).getTime();
}

function combine(
  dueDate: number | undefined,
  dueTach: number | undefined,
  currentTach: number,
  now: number,
): DueInfo {
  const daysRemaining = dueDate !== undefined ? Math.floor((dueDate - now) / DAY_MS) : undefined;
  const hoursRemaining = dueTach !== undefined ? +(dueTach - currentTach).toFixed(1) : undefined;

  let status: DueStatus = "ok";
  if ((daysRemaining !== undefined && daysRemaining < 0) || (hoursRemaining !== undefined && hoursRemaining < 0)) {
    status = "overdue";
  } else if (
    (daysRemaining !== undefined && daysRemaining <= SOON_DAYS) ||
    (hoursRemaining !== undefined && hoursRemaining <= SOON_HOURS)
  ) {
    status = "due_soon";
  }
  return { status, dueDate, dueTach, daysRemaining, hoursRemaining };
}

export function inspectionDue(
  inspection: Doc<"inspections">,
  currentTach: number,
  now: number = Date.now(),
): DueInfo {
  if (!inspection.tracked) return { status: "untracked" };
  if (inspection.lastDoneDate === undefined && inspection.lastDoneTach === undefined) {
    return { status: "no_record" };
  }

  let dueDate: number | undefined;
  if (inspection.lastDoneDate !== undefined) {
    const candidates: number[] = [];
    if (inspection.intervalCalendarMonths !== undefined) {
      candidates.push(endOfCalendarMonths(inspection.lastDoneDate, inspection.intervalCalendarMonths));
    }
    if (inspection.intervalDays !== undefined) {
      candidates.push(inspection.lastDoneDate + inspection.intervalDays * DAY_MS);
    }
    if (candidates.length > 0) dueDate = Math.min(...candidates);
  }

  const dueTach =
    inspection.lastDoneTach !== undefined && inspection.intervalHours !== undefined
      ? inspection.lastDoneTach + inspection.intervalHours
      : undefined;

  return combine(dueDate, dueTach, currentTach, now);
}

export function adDue(
  ad: Doc<"airworthinessDirectives">,
  currentTach: number,
  now: number = Date.now(),
): DueInfo {
  if (ad.status === "not_applicable" || ad.status === "complied") return { status: "ok" };
  if (ad.status === "open") return { status: "overdue" };
  // recurring
  if (ad.complianceDate === undefined && ad.complianceTach === undefined) {
    return { status: "no_record" };
  }
  const dueDate =
    ad.complianceDate !== undefined && ad.recurringIntervalMonths !== undefined
      ? endOfCalendarMonths(ad.complianceDate, ad.recurringIntervalMonths)
      : undefined;
  const dueTach =
    ad.complianceTach !== undefined && ad.recurringIntervalHours !== undefined
      ? ad.complianceTach + ad.recurringIntervalHours
      : undefined;
  return combine(dueDate, dueTach, currentTach, now);
}

export function formatDate(ms?: number): string {
  if (ms === undefined) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dueLabel(info: DueInfo): string {
  switch (info.status) {
    case "untracked":
      return "Not tracked";
    case "no_record":
      return "No record on file";
    case "overdue": {
      const parts: string[] = [];
      if (info.daysRemaining !== undefined && info.daysRemaining < 0)
        parts.push(`${Math.abs(info.daysRemaining)}d overdue`);
      if (info.hoursRemaining !== undefined && info.hoursRemaining < 0)
        parts.push(`${Math.abs(info.hoursRemaining)}h over`);
      return parts.join(" · ") || "Overdue";
    }
    default: {
      const parts: string[] = [];
      if (info.dueDate !== undefined) parts.push(`due ${formatDate(info.dueDate)}`);
      if (info.hoursRemaining !== undefined) parts.push(`${info.hoursRemaining}h left`);
      return parts.join(" · ") || "OK";
    }
  }
}
