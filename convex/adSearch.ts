import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ADs are published as FAA final rules in the Federal Register, whose API is
// public and keyless (the FAA DRS itself has no public API). We search FAA
// rules by make/model and let the pilot review applicability before import.
const FR_API = "https://www.federalregister.gov/api/v1/documents.json";

export type FrResult = {
  title: string;
  publicationDate: string;
  documentNumber: string;
  htmlUrl: string;
  rawTextUrl: string;
  abstract: string | null;
};

export const search = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<FrResult[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    const params = new URLSearchParams({
      "conditions[term]": `"airworthiness directives" ${query}`,
      "conditions[type][]": "RULE",
      per_page: "20",
      order: "newest",
    });
    params.append("conditions[agencies][]", "federal-aviation-administration");
    for (const field of [
      "title",
      "publication_date",
      "abstract",
      "document_number",
      "html_url",
      "raw_text_url",
    ]) {
      params.append("fields[]", field);
    }

    const response = await fetch(`${FR_API}?${params}`);
    if (!response.ok) {
      throw new Error(`Federal Register search failed (${response.status})`);
    }
    const data = (await response.json()) as {
      results?: Array<{
        title: string;
        publication_date: string;
        abstract: string | null;
        document_number: string;
        html_url: string;
        raw_text_url: string;
      }>;
    };

    return (data.results ?? [])
      .filter((r) => r.title.toLowerCase().startsWith("airworthiness directives"))
      .map((r) => ({
        title: r.title,
        publicationDate: r.publication_date,
        documentNumber: r.document_number,
        htmlUrl: r.html_url,
        rawTextUrl: r.raw_text_url,
        abstract: r.abstract,
      }));
  },
});

export const importFromFederalRegister = action({
  args: {
    aircraftId: v.id("aircraft"),
    title: v.string(),
    publicationDate: v.string(),
    documentNumber: v.string(),
    htmlUrl: v.string(),
    rawTextUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ adNumber: string; id: Id<"airworthinessDirectives"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in");

    // Pull the rule's full text to find the actual AD number (e.g. "2024-05-11") —
    // the Federal Register document number is a different identifier.
    let adNumber: string | null = null;
    try {
      const textResponse = await fetch(args.rawTextUrl);
      if (textResponse.ok) {
        const text = await textResponse.text();
        const match =
          text.match(/\bAD\s+(\d{4}-\d{2}-\d{2})\b/) ??
          text.match(/\b(\d{4}-\d{2}-\d{2})\s*[,:]?\s+Amendment\b/i);
        adNumber = match?.[1] ?? null;
      }
    } catch {
      // fall through to FR document number
    }

    // Strip the boilerplate prefix from the FR title for a readable AD title
    const cleanTitle = args.title.replace(/^Airworthiness Directives;?\s*/i, "").trim();

    const id: Id<"airworthinessDirectives"> = await ctx.runMutation(api.ads.create, {
      aircraftId: args.aircraftId,
      adNumber: adNumber ?? `FR ${args.documentNumber}`,
      title: cleanTitle || args.title,
      status: "open",
      notes: `Imported from Federal Register (published ${args.publicationDate}). Review applicability by serial number and compliance method: ${args.htmlUrl}`,
    });
    return { adNumber: adNumber ?? args.documentNumber, id };
  },
});
