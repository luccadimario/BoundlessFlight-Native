import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useAircraft } from "@/lib/aircraft-context";
import { adDue, dueLabel, inspectionDue, type DueInfo } from "@/lib/currency";
import { Button, Card, EmptyState, LoadingScreen, Screen, SectionTitle, StatusBadge, Title } from "@/components/ui";

export default function Dashboard() {
  const { fleet, current, setAircraftId, isLoading } = useAircraft();

  const inspections = useQuery(
    api.inspections.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const ads = useQuery(
    api.ads.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const squawks = useQuery(
    api.squawks.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );

  if (isLoading) return <LoadingScreen />;

  if (!current) {
    return (
      <Screen>
        <Title>BoundlessFlight</Title>
        <Text className="text-flight-300">
          Your aircraft's maintenance records, inspections, ADs, and documents — all in one place.
        </Text>
        <EmptyState
          title="No aircraft yet"
          hint="Add your aircraft to start tracking its maintenance and airworthiness."
        />
        <Button label="Add Aircraft" onPress={() => router.push("/add-aircraft")} />
      </Screen>
    );
  }

  const tach = current.currentTach;
  const dueItems: { name: string; info: DueInfo }[] = [
    ...(inspections ?? [])
      .map((i) => ({ name: i.name, info: inspectionDue(i, tach) }))
      .filter((x) => x.info.status !== "untracked"),
    ...(ads ?? [])
      .filter((ad) => ad.status === "recurring" || ad.status === "open")
      .map((ad) => ({ name: `AD ${ad.adNumber}`, info: adDue(ad, tach) })),
  ];
  const overdue = dueItems.filter((x) => x.info.status === "overdue");
  const dueSoon = dueItems.filter((x) => x.info.status === "due_soon");
  const noRecord = dueItems.filter((x) => x.info.status === "no_record");
  const groundingSquawks = (squawks ?? []).filter(
    (s) => s.status === "open" && s.severity === "grounding",
  );

  const banner =
    overdue.length > 0 || groundingSquawks.length > 0
      ? { style: "border-warning/50 bg-warning/10", text: "text-warning", label: "ACTION REQUIRED" }
      : dueSoon.length > 0
        ? { style: "border-caution/50 bg-caution/10", text: "text-caution", label: "ITEMS COMING DUE" }
        : { style: "border-ok/50 bg-ok/10", text: "text-ok", label: "TRACKED ITEMS CURRENT" };

  const attention = [...overdue, ...dueSoon, ...noRecord].slice(0, 5);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>BoundlessFlight</Title>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.push("/add-aircraft")} className="p-1 active:opacity-60">
            <Ionicons name="add-circle-outline" size={28} color="#0a84ff" />
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert("Sign out", "Sign out of BoundlessFlight?", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign Out", style: "destructive", onPress: () => void authClient.signOut() },
              ])
            }
            className="p-1 active:opacity-60">
            <Ionicons name="log-out-outline" size={26} color="#8e8e93" />
          </Pressable>
        </View>
      </View>

      {/* Fleet switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {(fleet ?? []).map((a) => (
          <Pressable
            key={a._id}
            onPress={() => setAircraftId(a._id)}
            className={`rounded-lg px-4 py-2 ${
              a._id === current._id ? "bg-instrument/15" : "bg-flight-900"
            }`}>
            <Text
              className={
                a._id === current._id ? "font-bold text-instrument" : "font-semibold text-flight-200"
              }>
              {a.tailNumber}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Airworthiness banner */}
      <Card className={banner.style}>
        <Text className={`text-lg font-extrabold tracking-wide ${banner.text}`}>{banner.label}</Text>
        <Text className="mt-1 text-sm text-flight-200">
          {current.year ? `${current.year} ` : ""}
          {current.make} {current.model} · {current.tailNumber}
        </Text>
        <View className="mt-3 flex-row gap-4">
          <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "text-warning" : "text-flight-300"} />
          <Stat label="Due soon" value={dueSoon.length} tone={dueSoon.length ? "text-caution" : "text-flight-300"} />
          <Stat label="No record" value={noRecord.length} tone="text-flight-300" />
          <Stat
            label="Grounding"
            value={groundingSquawks.length}
            tone={groundingSquawks.length ? "text-warning" : "text-flight-300"}
          />
        </View>
      </Card>

      {/* Times */}
      <Card>
        <View className="flex-row items-center justify-between">
          <SectionTitle>Times</SectionTitle>
          <Pressable onPress={() => router.push("/update-times")} className="active:opacity-60">
            <Text className="text-sm font-semibold text-instrument">Update</Text>
          </Pressable>
        </View>
        <View className="mt-2 flex-row gap-6">
          <Stat label="Tach" value={current.currentTach.toFixed(1)} tone="text-white" big />
          {current.currentHobbs !== undefined && (
            <Stat label="Hobbs" value={current.currentHobbs.toFixed(1)} tone="text-white" big />
          )}
          {current.engineTimeSinceOverhaul !== undefined && (
            <Stat
              label={current.engineTBO ? `SMOH / TBO ${current.engineTBO}` : "SMOH"}
              value={current.engineTimeSinceOverhaul.toFixed(0)}
              tone="text-white"
              big
            />
          )}
        </View>
      </Card>

      {/* Needs attention */}
      <SectionTitle>Needs attention</SectionTitle>
      {attention.length === 0 ? (
        <EmptyState title="Nothing due" hint="All tracked inspections and ADs are current." />
      ) : (
        attention.map(({ name, info }) => (
          <Card key={name} className="flex-row items-center justify-between py-3">
            <Text className="flex-1 pr-2 font-semibold text-white" numberOfLines={1}>
              {name}
            </Text>
            <StatusBadge status={info.status} detail={dueLabel(info)} />
          </Card>
        ))
      )}

      {/* Quick actions */}
      <SectionTitle>Quick actions</SectionTitle>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label="Scan Entry"
            icon="camera-outline"
            onPress={() => router.push({ pathname: "/add-log", params: { scan: "1" } })}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Log Entry"
            icon="add"
            variant="secondary"
            onPress={() => router.push("/add-log")}
          />
        </View>
      </View>
      <Button
        label="Upload Document"
        icon="cloud-upload-outline"
        variant="secondary"
        onPress={() => router.push("/add-document")}
      />
    </Screen>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string | number;
  tone: string;
  big?: boolean;
}) {
  return (
    <View>
      <Text className={`font-bold ${big ? "text-xl" : "text-lg"} ${tone}`}>{value}</Text>
      <Text className="text-xs text-flight-400">{label}</Text>
    </View>
  );
}
