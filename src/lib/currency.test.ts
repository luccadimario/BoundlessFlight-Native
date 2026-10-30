import { describe, expect, test } from "vitest";
import type { Doc } from "../../convex/_generated/dataModel";
import { adDue, endOfCalendarMonths, inspectionDue, parseDateInput, todayInput } from "./currency";

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

function insp(fields: Partial<Doc<"inspections">>): Doc<"inspections"> {
  return {
    _id: "i" as any,
    _creationTime: 0,
    aircraftId: "a" as any,
    type: "annual",
    name: "Annual",
    tracked: true,
    ...fields,
  };
}

describe("date input", () => {
  test("parses as the local calendar day, not UTC", () => {
    const ms = parseDateInput("2024-07-01")!;
    const d = new Date(ms);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2024, 7, 1]);
  });
  test("rejects malformed and impossible dates", () => {
    expect(parseDateInput("07/01/2024")).toBeNull();
    expect(parseDateInput("2024-02-30")).toBeNull();
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput(" 2024-2-3 ")).not.toBeNull();
  });
  test("today is the local date even late in the evening", () => {
    expect(todayInput(new Date(2024, 11, 31, 23, 30))).toBe("2024-12-31");
  });
});

describe("calendar-month rule", () => {
  test("annual done on the 1st is due at the end of that month next year", () => {
    const due = new Date(endOfCalendarMonths(parseDateInput("2024-07-01")!, 12));
    expect([due.getFullYear(), due.getMonth() + 1, due.getDate()]).toEqual([2025, 7, 31]);
  });
  test("24-month transponder check from Feb 29", () => {
    const due = new Date(endOfCalendarMonths(local(2024, 2, 29), 24));
    expect([due.getFullYear(), due.getMonth() + 1, due.getDate()]).toEqual([2026, 2, 28]);
  });
});

describe("inspectionDue", () => {
  const now = local(2025, 6, 15);
  test("untracked and never-done", () => {
    expect(inspectionDue(insp({ tracked: false }), 100, now).status).toBe("untracked");
    expect(inspectionDue(insp({ intervalCalendarMonths: 12 }), 100, now).status).toBe("no_record");
  });
  test("annual ok / due soon / overdue", () => {
    const annual = (done: number) => insp({ intervalCalendarMonths: 12, lastDoneDate: done });
    expect(inspectionDue(annual(local(2025, 1, 10)), 0, now).status).toBe("ok");
    expect(inspectionDue(annual(local(2024, 6, 20)), 0, now).status).toBe("due_soon");
    expect(inspectionDue(annual(local(2024, 5, 20)), 0, now).status).toBe("overdue");
  });
  test("oil change by hours: whichever comes first", () => {
    const oil = insp({ type: "oil_change", intervalHours: 50, lastDoneTach: 1000, lastDoneDate: now });
    expect(inspectionDue(oil, 1030, now)).toMatchObject({ status: "ok", hoursRemaining: 20 });
    expect(inspectionDue(oil, 1045, now).status).toBe("due_soon");
    expect(inspectionDue(oil, 1050.1, now).status).toBe("overdue");
  });
  test("VOR 30-day exact-day interval", () => {
    const vor = insp({ type: "vor", intervalDays: 30, lastDoneDate: local(2025, 5, 10) });
    expect(inspectionDue(vor, 0, now).status).toBe("overdue");
  });
});

describe("adDue", () => {
  const base = {
    _id: "d" as any,
    _creationTime: 0,
    aircraftId: "a" as any,
    adNumber: "2020-01-01",
    title: "Test",
  };
  test("open AD is overdue; complied/NA are ok", () => {
    expect(adDue({ ...base, status: "open" }, 0).status).toBe("overdue");
    expect(adDue({ ...base, status: "complied" }, 0).status).toBe("ok");
    expect(adDue({ ...base, status: "not_applicable" }, 0).status).toBe("ok");
  });
  test("recurring AD by hours", () => {
    const ad = { ...base, status: "recurring" as const, complianceTach: 900, recurringIntervalHours: 100 };
    expect(adDue(ad, 950).status).toBe("ok");
    expect(adDue(ad, 1001).status).toBe("overdue");
  });
});
