import { action } from "./_generated/server";
import { v } from "convex/values";

// Note: the Anthropic SDK needs Convex's Node runtime, which requires Node
// 18/20/22/24 installed locally (this machine runs 23). The default V8
// runtime supports fetch, so we call the Messages API over raw HTTP.

// Structured shape a parsed logbook entry comes back in — mirrors the
// 91.417 fields the pilot confirms before saving.
const ENTRY_SCHEMA = {
  type: "object",
  properties: {
    date: {
      type: ["string", "null"],
      description: "Date of the work in YYYY-MM-DD, null if unreadable",
    },
    tachTime: { type: ["number", "null"], description: "Tach or TIS hours" },
    category: {
      type: "string",
      enum: ["airframe", "engine", "propeller", "avionics", "other"],
    },
    entryType: {
      type: "string",
      enum: ["maintenance", "inspection", "alteration", "preventive", "overhaul"],
    },
    description: {
      type: "string",
      description: "Full transcription of the work performed",
    },
    performedBy: { type: ["string", "null"] },
    certificateNumber: { type: ["string", "null"] },
    certificateType: {
      type: ["string", "null"],
      enum: ["A&P", "IA", "repair_station", "owner", "other", null],
    },
    returnToService: {
      type: "boolean",
      description: "True if the entry approves the aircraft for return to service",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Overall transcription confidence",
    },
  },
  required: [
    "date",
    "tachTime",
    "category",
    "entryType",
    "description",
    "performedBy",
    "certificateNumber",
    "certificateType",
    "returnToService",
    "confidence",
  ],
  additionalProperties: false,
} as const;

export type ParsedLogEntry = {
  date: string | null;
  tachTime: number | null;
  category: "airframe" | "engine" | "propeller" | "avionics" | "other";
  entryType: "maintenance" | "inspection" | "alteration" | "preventive" | "overhaul";
  description: string;
  performedBy: string | null;
  certificateNumber: string | null;
  certificateType: "A&P" | "IA" | "repair_station" | "owner" | "other" | null;
  returnToService: boolean;
  confidence: "high" | "medium" | "low";
};

// Convex's default runtime has no Buffer; encode base64 by hand.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

export const parseLogbookImage = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<
    { ok: true; entry: ParsedLogEntry } | { ok: false; error: string }
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, error: "Not signed in." };
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        ok: false,
        error:
          "OCR is not configured. Set ANTHROPIC_API_KEY on the Convex deployment (npx convex env set ANTHROPIC_API_KEY sk-...) and try again.",
      };
    }

    const blob = await ctx.storage.get(storageId);
    if (!blob) return { ok: false, error: "Uploaded image not found." };

    const mediaType = (blob.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    const imageData = toBase64(await blob.arrayBuffer());

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: {
          format: {
            type: "json_schema",
            schema: ENTRY_SCHEMA,
          },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: imageData,
                },
              },
              {
                type: "text",
                text:
                  "This is a photo of a general-aviation aircraft maintenance logbook entry " +
                  "(often handwritten). Transcribe it into a structured maintenance record. " +
                  "Transcribe the description faithfully and completely, including part numbers " +
                  "and AD references. If a field is not present or unreadable, use null. " +
                  "Dates like '6/3/24' are US format (MM/DD/YY).",
              },
            ],
          },
        ],
      }),
    });

    if (!apiResponse.ok) {
      const detail = await apiResponse.text();
      return { ok: false, error: `OCR request failed (${apiResponse.status}): ${detail}` };
    }

    const response = (await apiResponse.json()) as {
      stop_reason: string;
      content: Array<{ type: string; text?: string }>;
    };

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The OCR model declined to process this image." };
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock?.text) {
      return { ok: false, error: "OCR returned no text." };
    }

    try {
      return { ok: true, entry: JSON.parse(textBlock.text) as ParsedLogEntry };
    } catch {
      return { ok: false, error: "Could not parse OCR output." };
    }
  },
});
