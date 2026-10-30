import { ConvexError } from "convex/values";

// Convex redacts plain Error messages in production; user-facing ones are
// thrown as ConvexError and carry their message in `data`.
export function errorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err instanceof ConvexError) return String(err.data);
  return fallback;
}
