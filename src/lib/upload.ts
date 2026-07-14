import type { Id } from "../../convex/_generated/dataModel";

// Upload a local file (image picker / document picker uri) to Convex storage.
export async function uploadToConvex(
  uploadUrl: string,
  localUri: string,
  mimeType: string,
): Promise<Id<"_storage">> {
  const file = await fetch(localUri);
  const blob = await file.blob();
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: blob,
  });
  if (!result.ok) {
    throw new Error(`Upload failed (${result.status})`);
  }
  const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
