import { useState } from "react";
import { Alert, FlatList, Image, Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAircraft } from "@/lib/aircraft-context";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/currency";
import { exportLogbookPdf } from "@/lib/pdf-export";
import { Card, EmptyState, LoadingScreen, Screen, Title } from "@/components/ui";

const CATEGORIES = ["all", "airframe", "engine", "propeller", "avionics", "other"] as const;

export default function Logbook() {
  const { current, isLoading, canWrite } = useAircraft();
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>("all");
  const entries = useQuery(
    api.logEntries.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const voidEntry = useMutation(api.logEntries.voidEntry);

  if (isLoading) return <LoadingScreen />;
  if (!current) {
    return (
      <Screen>
        <Title>Logbook</Title>
        <EmptyState title="No aircraft" hint="Add an aircraft from the Dashboard first." />
      </Screen>
    );
  }

  const filtered = (entries ?? []).filter((e) => filter === "all" || e.category === filter);

  const runVoid = (id: Id<"logEntries">, reason: string) => {
    voidEntry({ id, reason }).catch((err: unknown) =>
      Alert.alert("Couldn't void entry", errorMessage(err)),
    );
  };

  // Entries are never deleted — voiding keeps them in the record with a reason
  const confirmVoid = (id: Id<"logEntries">) => {
    const message =
      "The entry stays in the logbook, struck through, with your reason. Add a new entry with the correction.";
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Void entry",
        message,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Void", style: "destructive", onPress: (reason?: string) => runVoid(id, reason || "Entered in error") },
        ],
        "plain-text",
        "Entered in error",
      );
    } else {
      Alert.alert("Void entry", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Void", style: "destructive", onPress: () => runVoid(id, "Entered in error") },
      ]);
    }
  };

  return (
    <Screen scroll={false}>
      <View className="flex-row items-center justify-between pb-2">
        <Title>Logbook</Title>
        <View className="mr-2 flex-row items-center gap-4">
          <Pressable
            onPress={() => {
              if (!entries || entries.length === 0) {
                Alert.alert("Nothing to export", "Add some log entries first.");
                return;
              }
              void exportLogbookPdf(current, entries).catch((err: unknown) =>
                Alert.alert("Export failed", errorMessage(err)),
              );
            }}
            className="p-1 active:opacity-60">
            <Ionicons name="share-outline" size={24} color="#0a84ff" />
          </Pressable>
          {canWrite && (
            <Pressable
              onPress={() => router.push({ pathname: "/add-log", params: { scan: "1" } })}
              className="p-1 active:opacity-60">
              <Ionicons name="camera-outline" size={26} color="#0a84ff" />
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 pb-3">
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setFilter(c)}
            className={`rounded-lg px-3 py-1 ${filter === c ? "bg-instrument/15" : "bg-flight-900"}`}>
            <Text
              className={`text-xs capitalize ${
                filter === c ? "font-semibold text-instrument" : "text-flight-300"
              }`}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerClassName="gap-3 pb-28"
        ListEmptyComponent={
          <EmptyState
            title="No entries"
            hint="Add a maintenance record manually or scan a logbook page with the camera."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={!canWrite || item.voidedAt !== undefined}
            onLongPress={() => confirmVoid(item._id)}>
            <Card className={item.voidedAt !== undefined ? "opacity-50" : undefined}>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-instrument">
                  {item.category} · {item.entryType}
                </Text>
                <Text className="text-xs text-flight-400">{formatDate(item.date)}</Text>
              </View>
              <Text
                className={`mt-2 text-sm leading-5 text-white ${item.voidedAt !== undefined ? "line-through" : ""}`}>
                {item.description}
              </Text>
              {item.voidedAt !== undefined && (
                <Text className="mt-1 text-xs font-semibold text-warning">
                  VOIDED {formatDate(item.voidedAt)} · {item.voidReason}
                </Text>
              )}
              <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
                {item.tachTime !== undefined && (
                  <Meta icon="time-outline" text={`Tach ${item.tachTime.toFixed(1)}`} />
                )}
                {item.performedBy && <Meta icon="person-outline" text={item.performedBy} />}
                {item.certificateNumber && (
                  <Meta
                    icon="ribbon-outline"
                    text={`${item.certificateType ?? ""} ${item.certificateNumber}`.trim()}
                  />
                )}
                {item.returnToService && <Meta icon="checkmark-circle-outline" text="RTS" ok />}
                {item.source === "ocr" && <Meta icon="scan-outline" text="Scanned" />}
              </View>
              {item.attachmentUrls.filter(Boolean).length > 0 && (
                <View className="mt-3 flex-row gap-2">
                  {item.attachmentUrls.filter(Boolean).map((url) => (
                    <Image
                      key={url}
                      source={{ uri: url! }}
                      className="h-16 w-16 rounded-lg border border-flight-700"
                    />
                  ))}
                </View>
              )}
            </Card>
          </Pressable>
        )}
      />

      {/* New entry button */}
      {canWrite && (
        <Pressable
          onPress={() => router.push("/add-log")}
          className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-2xl bg-instrument active:opacity-80">
          <Ionicons name="add" size={28} color="#ffffff" />
        </Pressable>
      )}
    </Screen>
  );
}

function Meta({ icon, text, ok }: { icon: any; text: string; ok?: boolean }) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={13} color={ok ? "#30d158" : "#98989d"} />
      <Text className={`text-xs ${ok ? "text-ok" : "text-flight-300"}`}>{text}</Text>
    </View>
  );
}
