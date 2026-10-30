import { useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAircraft } from "@/lib/aircraft-context";
import { parseDateInput, todayInput } from "@/lib/currency";
import { Button, Card, Field, LoadingScreen, Screen } from "@/components/ui";

export default function CompleteInspection() {
  const { inspectionId } = useLocalSearchParams<{ inspectionId: string }>();
  const { current } = useAircraft();
  const inspections = useQuery(
    api.inspections.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const complete = useMutation(api.inspections.complete);

  const inspection = inspections?.find((i) => i._id === inspectionId);

  const [date, setDate] = useState(todayInput());
  const [tach, setTach] = useState(current?.currentTach.toString() ?? "");
  const [createLogEntry, setCreateLogEntry] = useState(true);
  const [performedBy, setPerformedBy] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [saving, setSaving] = useState(false);

  if (!inspection) return <LoadingScreen />;

  async function save() {
    const parsedDate = parseDateInput(date);
    if (parsedDate === null) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD format.");
      return;
    }
    setSaving(true);
    try {
      await complete({
        id: inspectionId as Id<"inspections">,
        date: parsedDate,
        tach: tach.trim() ? parseFloat(tach) : undefined,
        createLogEntry,
        performedBy: performedBy.trim() || undefined,
        certificateNumber: certNumber.trim() || undefined,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text className="text-lg font-bold text-white">{inspection.name}</Text>
        <Text className="mt-1 text-xs text-flight-400">
          Recording a completion resets this item's due date/hours.
        </Text>
      </Card>

      <Field label="Date completed (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
      <Field label="Tach at completion" value={tach} onChangeText={setTach} keyboardType="decimal-pad" />

      <View className="flex-row items-center justify-between rounded-xl bg-flight-800 px-3 py-3">
        <Text className="flex-1 pr-2 text-base text-white">Also write a logbook entry</Text>
        <Switch value={createLogEntry} onValueChange={setCreateLogEntry} trackColor={{ true: "#0a84ff" }} />
      </View>

      {createLogEntry && (
        <>
          <Field label="Performed / approved by" value={performedBy} onChangeText={setPerformedBy} placeholder="Jane Smith, IA" />
          <Field label="Certificate number" value={certNumber} onChangeText={setCertNumber} autoCapitalize="characters" />
        </>
      )}

      <Button label="Record Completion" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}
