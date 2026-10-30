import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { Doc } from "../../convex/_generated/dataModel";
import { formatDate } from "./currency";

type Entry = Doc<"logEntries">;

const CATEGORY_ORDER = ["airframe", "engine", "propeller", "avionics", "other"] as const;

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function entryRows(entries: Entry[]): string {
  return entries
    .map(
      (e) => `
      <tr>
        <td class="nowrap">${formatDate(e.date)}</td>
        <td class="nowrap">${e.tachTime !== undefined ? e.tachTime.toFixed(1) : "—"}</td>
        <td class="nowrap">${e.entryType}</td>
        <td>${
          e.voidedAt !== undefined
            ? `<s>${escapeHtml(e.description)}</s><br/><b>VOIDED ${formatDate(e.voidedAt)}:</b> ${escapeHtml(e.voidReason ?? "")}`
            : escapeHtml(e.description)
        }</td>
        <td class="nowrap">${
          [e.performedBy, e.certificateType, e.certificateNumber]
            .filter((part): part is string => Boolean(part))
            .map(escapeHtml)
            .join("<br/>") || "—"
        }</td>
        <td class="nowrap">${e.returnToService ? "Yes" : "No"}</td>
      </tr>`,
    )
    .join("");
}

export async function exportLogbookPdf(
  aircraft: Doc<"aircraft">,
  entries: Entry[],
): Promise<void> {
  const sections = CATEGORY_ORDER.map((category) => {
    const rows = entries
      .filter((e) => e.category === category)
      .sort((a, b) => a.date - b.date);
    if (rows.length === 0) return "";
    return `
      <h2>${category.charAt(0).toUpperCase() + category.slice(1)} Log</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Tach</th><th>Type</th>
            <th>Description of Work Performed</th>
            <th>Performed / Approved By</th><th>RTS</th>
          </tr>
        </thead>
        <tbody>${entryRows(rows)}</tbody>
      </table>`;
  }).join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 36px; }
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 11px; }
          h1 { font-size: 20px; margin-bottom: 2px; }
          .sub { color: #555; margin-bottom: 4px; }
          .meta { color: #555; font-size: 10px; margin-bottom: 16px; }
          h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 2px solid #1a3563; padding-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #eef2f8; text-align: left; padding: 5px 6px; border: 1px solid #c8d2e0; font-size: 10px; }
          td { padding: 5px 6px; border: 1px solid #c8d2e0; vertical-align: top; }
          .nowrap { white-space: nowrap; }
          .footer { margin-top: 24px; color: #777; font-size: 9px; }
        </style>
      </head>
      <body>
        <h1>Maintenance Record — ${escapeHtml(aircraft.tailNumber)}</h1>
        <div class="sub">${aircraft.year ?? ""} ${escapeHtml(aircraft.make)} ${escapeHtml(aircraft.model)}${
          aircraft.serial ? ` · S/N ${escapeHtml(aircraft.serial)}` : ""
        }</div>
        <div class="meta">
          ${aircraft.engineMake || aircraft.engineModel ? `Engine: ${escapeHtml([aircraft.engineMake, aircraft.engineModel].filter(Boolean).join(" "))} · ` : ""}
          Current tach ${aircraft.currentTach.toFixed(1)}
          ${aircraft.airframeTotalTime !== undefined ? ` · Airframe TT ${aircraft.airframeTotalTime.toFixed(1)}` : ""}
          ${aircraft.engineTimeSinceOverhaul !== undefined ? ` · SMOH ${aircraft.engineTimeSinceOverhaul.toFixed(1)}` : ""}
          · Exported ${formatDate(Date.now())} by BoundlessFlight
        </div>
        ${sections || "<p>No log entries recorded.</p>"}
        <div class="footer">
          Entries follow 14 CFR 91.417(a): description of work performed, date of completion,
          and signature and certificate number of the person approving return to service.
          This export is a convenience copy — the signed logbook remains the official record.
        </div>
      </body>
    </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `${aircraft.tailNumber} maintenance record`,
      UTI: "com.adobe.pdf",
    });
  }
}
