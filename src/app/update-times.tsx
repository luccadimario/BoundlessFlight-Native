import { useState } from "react";
import { Alert, Text } from "react-native";
import { router } from "expo-router";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { Button, Card, Field, LoadingScreen, Screen } from "@/components/ui";

export default function UpdateTimes() {
  const { current } = useAircraft();
  const updateAircraft = useMutation(api.aircraft.update);

  const [tach, setTach] = useState(current?.currentTach.toString() ?? "");
  const [hobbs, setHobbs] = useState(current?.currentHobbs?.toString() ?? "");
  const [smoh, setSmoh] = useState(current?.engineTimeSinceOverhaul?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  if (!current) return <LoadingScreen />;

  async function save() {
    if (!current) return;
    const parsedTach = parseFloat(tach);
    if (Number.isNaN(parsedTach)) {
      Alert.alert("Invalid tach", "Enter the current tach time.");
      return;
    }
    setSaving(true);
    try {
      await updateAircraft({
        id: current._id,
        currentTach: parsedTach,
        currentHobbs: hobbs.trim() ? parseFloat(hobbs) : undefined,
        engineTimeSinceOverhaul: smoh.trim() ? parseFloat(smoh) : undefined,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text className="font-semibold text-white">{current.tailNumber}</Text>
        <Text className="mt-1 text-xs text-flight-400">
          Keep tach current — hour-based inspections and recurring ADs are computed from it.
        </Text>
      </Card>
      <Field label="Tach" value={tach} onChangeText={setTach} keyboardType="decimal-pad" />
      <Field label="Hobbs" value={hobbs} onChangeText={setHobbs} keyboardType="decimal-pad" />
      <Field label="Engine SMOH" value={smoh} onChangeText={setSmoh} keyboardType="decimal-pad" />
      <Button label="Save" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}
