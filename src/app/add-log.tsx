import { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useAction, useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAircraft } from "@/lib/aircraft-context";
import { uploadToConvex } from "@/lib/upload";
import { errorMessage } from "@/lib/errors";
import { parseDateInput, todayInput } from "@/lib/currency";
import { Button, Card, ChipRow, Field, Screen } from "@/components/ui";

const CATEGORIES = ["airframe", "engine", "propeller", "avionics", "other"] as const;
const ENTRY_TYPES = ["maintenance", "inspection", "alteration", "preventive", "overhaul"] as const;
const CERT_TYPES = ["A&P", "IA", "repair_station", "owner", "other"] as const;

// Claude reads images at up to ~1568px on the long edge and rejects anything over
// 5MB or in HEIC (the iPhone library default), so normalize every scan to a
// right-sized JPEG before upload. Smaller images also mean fewer input tokens.
const MAX_SCAN_EDGE = 1568;

async function prepareScan(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SCAN_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SCAN_EDGE } : { height: MAX_SCAN_EDGE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return result.uri;
}

export default function AddLog() {
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  const { current } = useAircraft();

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const parseImage = useAction(api.ocr.parseLogbookImage);
  const createEntry = useMutation(api.logEntries.create);

  const [date, setDate] = useState(todayInput());
  const [tach, setTach] = useState(current?.currentTach.toString() ?? "");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("airframe");
  const [entryType, setEntryType] = useState<(typeof ENTRY_TYPES)[number]>("maintenance");
  const [description, setDescription] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [certType, setCertType] = useState<(typeof CERT_TYPES)[number]>("A&P");
  const [returnToService, setReturnToService] = useState(true);

  const [attachmentIds, setAttachmentIds] = useState<Id<"_storage">[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanPrompted = useRef(false);

  useEffect(() => {
    if (scan === "1" && !scanPrompted.current) {
      scanPrompted.current = true;
      void startScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan]);

  async function pickImage(fromCamera: boolean) {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
      return ImagePicker.launchCameraAsync({ quality: 0.8 });
    }
    return ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  }

  async function startScan() {
    Alert.alert("Scan logbook page", "Photograph a logbook entry and we'll transcribe it.", [
      { text: "Camera", onPress: () => void runScan(true) },
      { text: "Photo Library", onPress: () => void runScan(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function runScan(fromCamera: boolean) {
    try {
      const result = await pickImage(fromCamera);
      if (!result || result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setScanning(true);
      setOcrNote(null);
      setPreviewUri(asset.uri);

      const scanUri = await prepareScan(asset);
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadToConvex(uploadUrl, scanUri, "image/jpeg");
      setAttachmentIds((prev) => [...prev, storageId]);

      const parsed = await parseImage({ storageId });
      if (!parsed.ok) {
        setOcrNote(parsed.error);
        return;
      }
      const entry = parsed.entry;
      if (entry.date) setDate(entry.date);
      if (entry.tachTime !== null) setTach(String(entry.tachTime));
      setCategory(entry.category);
      setEntryType(entry.entryType);
      setDescription(entry.description);
      if (entry.performedBy) setPerformedBy(entry.performedBy);
      if (entry.certificateNumber) setCertNumber(entry.certificateNumber);
      if (entry.certificateType) setCertType(entry.certificateType);
      setReturnToService(entry.returnToService);
      setOcrNote(
        entry.confidence === "high"
          ? "Transcribed — review before saving."
          : `Transcribed with ${entry.confidence} confidence — double-check every field.`,
      );
    } catch (err) {
      setOcrNote(errorMessage(err, err instanceof Error ? err.message : "Scan failed."));
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    if (!current) return;
    const parsedDate = parseDateInput(date);
    if (parsedDate === null) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD format.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing description", "91.417 requires a description of the work performed.");
      return;
    }
    setSaving(true);
    try {
      await createEntry({
        aircraftId: current._id,
        category,
        entryType,
        date: parsedDate,
        tachTime: tach ? parseFloat(tach) : undefined,
        description: description.trim(),
        performedBy: performedBy.trim() || undefined,
        certificateNumber: certNumber.trim() || undefined,
        certificateType: certNumber.trim() ? certType : undefined,
        returnToService,
        attachmentIds,
        source: previewUri ? "ocr" : "manual",
      });
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save entry", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card className="gap-1">
        <Button
          label={scanning ? "Transcribing…" : "Scan a logbook page"}
          icon="camera-outline"
          variant="secondary"
          loading={scanning}
          onPress={() => void startScan()}
        />
        {previewUri && (
          <Image source={{ uri: previewUri }} className="mt-2 h-40 w-full rounded-xl" resizeMode="cover" />
        )}
        {ocrNote && <Text className="mt-2 text-xs text-caution">{ocrNote}</Text>}
      </Card>

      <Field label="Date completed (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
      <Field label="Tach / time in service" value={tach} onChangeText={setTach} keyboardType="decimal-pad" />

      <Text className="text-xs font-semibold uppercase tracking-wider text-flight-300">Record</Text>
      <ChipRow options={CATEGORIES} value={category} onChange={setCategory} />
      <ChipRow options={ENTRY_TYPES} value={entryType} onChange={setEntryType} />

      <Field
        label="Description of work performed"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        style={{ minHeight: 110, textAlignVertical: "top" }}
        placeholder="Drained oil, replaced with 7 qts Phillips 20W-50, replaced filter CH48110-1, cut open old filter — no metal found…"
      />

      <Field label="Performed / approved by" value={performedBy} onChangeText={setPerformedBy} />
      <Field
        label="Certificate number"
        value={certNumber}
        onChangeText={setCertNumber}
        autoCapitalize="characters"
      />
      {certNumber.trim() !== "" && <ChipRow options={CERT_TYPES} value={certType} onChange={setCertType} />}

      <View className="flex-row items-center justify-between rounded-xl bg-flight-800 px-3 py-3">
        <Text className="text-base text-white">Approved for return to service</Text>
        <Switch value={returnToService} onValueChange={setReturnToService} trackColor={{ true: "#0a84ff" }} />
      </View>

      <Button label="Save Entry" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}
