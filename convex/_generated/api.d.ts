/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adSearch from "../adSearch.js";
import type * as ads from "../ads.js";
import type * as aircraft from "../aircraft.js";
import type * as auth from "../auth.js";
import type * as documents from "../documents.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as inspections from "../inspections.js";
import type * as logEntries from "../logEntries.js";
import type * as ocr from "../ocr.js";
import type * as squawks from "../squawks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adSearch: typeof adSearch;
  ads: typeof ads;
  aircraft: typeof aircraft;
  auth: typeof auth;
  documents: typeof documents;
  helpers: typeof helpers;
  http: typeof http;
  inspections: typeof inspections;
  logEntries: typeof logEntries;
  ocr: typeof ocr;
  squawks: typeof squawks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
