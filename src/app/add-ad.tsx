import { useState } from "react";
import { Alert, Text } from "react-native";
import { router } from "expo-router";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { parseDateInput } from "@/lib/currency";
import { Button, ChipRow, Field, Screen } from "@/components/ui";

const STATUSES = ["open", "complied", "recurring", "not_applicable"] as const;

export default function AddAd() {
  const { current } = useAircraft();
  const createAd = useMutation(api.ads.create);

  const [adNumber, setAdNumber] = useState("");
  const [title, setTitle] = useState("");
  const [appliesTo, setAppliesTo] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("open");
  const [moc, setMoc] = useState("");
  const [complianceDate, setComplianceDate] = useState("");
  const [complianceTach, setComplianceTach] = useState("");
  const [intervalHours, setIntervalHours] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!current) return;
    if (!adNumber.trim() || !title.trim()) {
      Alert.alert("Missing info", "AD number and title are required.");
      return;
    }
    const parsedDate = complianceDate.trim() ? parseDateInput(complianceDate) : undefined;
    if (complianceDate.trim() && parsedDate === null) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD for the compliance date.");
      return;
    }
    setSaving(true);
    try {
      await createAd({
        aircraftId: current._id,
        adNumber: adNumber.trim(),
        title: title.trim(),
        appliesTo: appliesTo.trim() || undefined,
        status,
        methodOfCompliance: moc.trim() || undefined,
        complianceDate: parsedDate ?? undefined,
        complianceTach: complianceTach.trim() ? parseFloat(complianceTach) : undefined,
        recurringIntervalHours: intervalHours.trim() ? parseFloat(intervalHours) : undefined,
        recurringIntervalMonths: intervalMonths.trim() ? parseFloat(intervalMonths) : undefined,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Field label="AD number *" value={adNumber} onChangeText={setAdNumber} placeholder="2024-05-11" autoCapitalize="none" />
      <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Fuel line inspection" />
      <Field label="Applies to" value={appliesTo} onChangeText={setAppliesTo} placeholder="Engine / Airframe / Prop / Appliance" />

      <Text className="text-xs font-semibold uppercase tracking-wider text-flight-300">Status</Text>
      <ChipRow options={STATUSES} value={status} onChange={setStatus} labels={{ not_applicable: "N/A" }} />

      {status !== "open" && status !== "not_applicable" && (
        <>
          <Field label="Method of compliance" value={moc} onChangeText={setMoc} placeholder="Replaced per SB 24-01" />
          <Field label="Compliance date (YYYY-MM-DD)" value={complianceDate} onChangeText={setComplianceDate} autoCapitalize="none" />
          <Field label="Compliance tach" value={complianceTach} onChangeText={setComplianceTach} keyboardType="decimal-pad" />
        </>
      )}
      {status === "recurring" && (
        <>
          <Field label="Repeat every (hours)" value={intervalHours} onChangeText={setIntervalHours} keyboardType="decimal-pad" placeholder="100" />
          <Field label="Repeat every (calendar months)" value={intervalMonths} onChangeText={setIntervalMonths} keyboardType="number-pad" placeholder="12" />
        </>
      )}

      <Button label="Save AD" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}
