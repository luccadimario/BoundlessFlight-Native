import { useState } from "react";
import { Alert, Text } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { uploadToConvex } from "@/lib/upload";
import { parseDateInput } from "@/lib/currency";
import { Button, Card, ChipRow, Field, Screen } from "@/components/ui";

const KINDS = [
  "airworthiness_certificate",
  "registration",
  "weight_and_balance",
  "poh_afm",
  "logbook_scan",
  "insurance",
  "stc_337",
  "other",
] as const;

const KIND_LABELS: Partial<Record<(typeof KINDS)[number], string>> = {
  airworthiness_certificate: "Airworthiness cert",
  weight_and_balance: "Weight & balance",
  poh_afm: "POH / AFM",
  stc_337: "STC / Form 337",
};

type Picked = { uri: string; mimeType: string; name: string };

export default function AddDocument() {
  const { current } = useAircraft();
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDoc = useMutation(api.documents.create);

  const [kind, setKind] = useState<(typeof KINDS)[number]>("airworthiness_certificate");
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
      name: asset.name,
    });
    if (!title.trim()) setTitle(asset.name.replace(/\.[^.]+$/, ""));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      name: asset.fileName ?? "photo.jpg",
    });
  }

  async function save() {
    if (!current || !picked) return;
    if (!title.trim()) {
      Alert.alert("Missing title", "Give this document a name.");
      return;
    }
    const parsedExpiry = expires.trim() ? parseDateInput(expires) : undefined;
    if (expires.trim() && parsedExpiry === null) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD for the expiration date.");
      return;
    }
    setSaving(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToConvex(uploadUrl, picked.uri, picked.mimeType);
      await createDoc({
        aircraftId: current._id,
        kind,
        title: title.trim(),
        storageId,
        mimeType: picked.mimeType,
        expiresOn: parsedExpiry ?? undefined,
      });
      router.back();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text className="text-xs font-semibold uppercase tracking-wider text-flight-300">Document type</Text>
      <ChipRow options={KINDS} value={kind} onChange={setKind} labels={KIND_LABELS} />

      <Card className="gap-3">
        <Button label="Pick PDF / File" variant="secondary" onPress={() => void pickFile()} />
        <Button label="Pick Photo" variant="secondary" onPress={() => void pickPhoto()} />
        {picked && <Text className="text-sm text-instrument">Selected: {picked.name}</Text>}
      </Card>

      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Airworthiness Certificate" />
      <Field
        label="Expires (YYYY-MM-DD, optional)"
        value={expires}
        onChangeText={setExpires}
        autoCapitalize="none"
        placeholder="Registration / insurance expiry"
      />

      <Button label="Upload" onPress={() => void save()} loading={saving} disabled={!picked} />
    </Screen>
  );
}
