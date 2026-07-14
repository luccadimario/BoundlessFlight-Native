import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { formatDate } from "@/lib/currency";
import { Button, Card, ChipRow, EmptyState, Field, LoadingScreen, Screen, SectionTitle, Title } from "@/components/ui";

const SEVERITIES = ["grounding", "monitor", "note"] as const;

const SEVERITY_STYLES: Record<string, string> = {
  grounding: "text-warning",
  monitor: "text-caution",
  note: "text-flight-300",
};

export default function Squawks() {
  const { current, isLoading } = useAircraft();
  const squawks = useQuery(
    api.squawks.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const createSquawk = useMutation(api.squawks.create);
  const resolveSquawk = useMutation(api.squawks.resolve);

  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("monitor");

  if (isLoading) return <LoadingScreen />;
  if (!current) {
    return (
      <Screen>
        <Title>Squawks</Title>
        <EmptyState title="No aircraft" hint="Add an aircraft from the Dashboard first." />
      </Screen>
    );
  }

  const open = (squawks ?? []).filter((s) => s.status === "open");
  const resolved = (squawks ?? []).filter((s) => s.status === "resolved");

  const submit = async () => {
    if (!description.trim()) return;
    await createSquawk({ aircraftId: current._id, description: description.trim(), severity });
    setDescription("");
    setSeverity("monitor");
  };

  return (
    <Screen>
      <Title>Squawks</Title>

      <Card className="gap-3">
        <Field
          label="New squawk"
          placeholder="e.g. #2 cylinder CHT reading high in climb"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <ChipRow options={SEVERITIES} value={severity} onChange={setSeverity} />
        <Button label="Add Squawk" onPress={submit} disabled={!description.trim()} />
      </Card>

      <SectionTitle>Open ({open.length})</SectionTitle>
      {open.length === 0 ? (
        <EmptyState title="No open squawks" />
      ) : (
        open.map((s) => (
          <Card key={s._id}>
            <View className="flex-row items-center justify-between">
              <Text className={`text-xs font-bold uppercase tracking-wider ${SEVERITY_STYLES[s.severity]}`}>
                {s.severity}
              </Text>
              <Text className="text-xs text-flight-400">{formatDate(s._creationTime)}</Text>
            </View>
            <Text className="mt-1 text-sm text-white">{s.description}</Text>
            <Pressable
              onPress={() =>
                Alert.alert("Resolve squawk", "Mark this squawk as resolved?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Resolve", onPress: () => resolveSquawk({ id: s._id }) },
                ])
              }
              className="mt-2 self-start active:opacity-60">
              <Text className="text-sm font-semibold text-ok">Mark resolved</Text>
            </Pressable>
          </Card>
        ))
      )}

      {resolved.length > 0 && (
        <>
          <SectionTitle>Resolved ({resolved.length})</SectionTitle>
          {resolved.map((s) => (
            <Card key={s._id} className="opacity-60">
              <Text className="text-sm text-flight-200">{s.description}</Text>
              <Text className="mt-1 text-xs text-flight-400">
                Resolved {formatDate(s.resolvedAt)}
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
