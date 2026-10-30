# BoundlessFlight ✈️

Maintenance tracking for general-aviation aircraft — logbooks, inspections, ADs, documents, and squawks in one place. Built with Expo (SDK 57), NativeWind v4, and Convex.

## What it does

- **Logbook** — 91.417-compliant maintenance entries (description of work, date, time in service, signature + certificate number, return to service) per airframe / engine / propeller / avionics, with photo attachments.
- **Scan & parse** — photograph a handwritten logbook page and it's transcribed into a structured entry (Claude Opus 4.8 vision via a Convex action).
- **Compliance (AV1ATE)** — Annual (12 cal-mo), 100-hour, transponder & pitot-static (24 cal-mo), ELT (12 cal-mo) + battery, VOR 30-day, oil changes, and 7-year registration renewal, each color-coded ok / due soon / overdue by calendar date and tach hours.
- **Airworthiness Directives** — one-time and recurring ADs with method of compliance and next-due by hours or calendar months.
- **Documents** — airworthiness certificate, registration, W&B, POH/AFM, insurance, STC/337s, and scanned logbooks (with an ARROW checklist).
- **Squawks** — grounding / monitor / note discrepancies with resolution tracking.
- **Dashboard** — at-a-glance airworthiness status per aircraft, fleet switcher, tach/Hobbs/SMOH tracking.

## Running it

Two terminals:

```bash
# 1. Backend (local anonymous Convex deployment)
npm run convex

# 2. App
npx expo start
```

Press `i` for the iOS simulator or `w` for web. The Convex URL is read from `.env.local` (`EXPO_PUBLIC_CONVEX_URL`).

> **Physical device note:** the anonymous local deployment listens on `127.0.0.1`, which a phone can't reach. For device testing, link a free cloud dev deployment with `npx convex login` then `npx convex dev` — `.env.local` updates automatically.

## OCR setup

Logbook scanning calls the Claude API from a Convex action. Set the key on the deployment:

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
```

Without the key everything else works; the scan button reports that OCR isn't configured.

## Project layout

- `convex/` — schema + functions (aircraft, logEntries, inspections, ads, documents, squawks, ocr)
- `src/app/` — expo-router routes: `(tabs)/` (Dashboard, Logbook, Compliance, Docs, Squawks) + modal forms
- `src/lib/currency.ts` — due-date/-hours math (calendar-month rule, hour intervals)
- `src/lib/aircraft-context.tsx` — selected-aircraft state
- `src/components/ui.tsx` — shared NativeWind UI kit

## Notes

- Styling is NativeWind v4 (stable), not v5 — v5 is still preview software and its `className` styles silently failed to apply at all in EAS release builds (worked fine under `expo start`, broke on-device). If `react-native-css-interop` ever ends up nested under `node_modules/nativewind/node_modules/` instead of hoisted to the top level (check with `npm ls react-native-css-interop`), production exports fail to resolve it — reinstall it explicitly (`npm install react-native-css-interop@<version nativewind expects>`) to force the hoist.
- Convex Node actions ("use node") need Node 18/20/22/24 installed; this machine runs Node 23, so the OCR action targets Convex's default V8 runtime using `fetch` directly.
- New aircraft are seeded with the standard inspection set automatically; intervals are editable and items can be untracked (e.g. 100-hour for private-only ops, VOR for VFR-only).
