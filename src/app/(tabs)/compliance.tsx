import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useAircraft } from "@/lib/aircraft-context";
import { adDue, dueLabel, formatDate, inspectionDue } from "@/lib/currency";
import { Card, EmptyState, LoadingScreen, Screen, SectionTitle, StatusBadge, Title } from "@/components/ui";

export default function Compliance() {
  const { current, isLoading } = useAircraft();
  const inspections = useQuery(
    api.inspections.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const ads = useQuery(api.ads.listByAircraft, current ? { aircraftId: current._id } : "skip");
  const updateInspection = useMutation(api.inspections.update);
  const removeAd = useMutation(api.ads.remove);

  if (isLoading) return <LoadingScreen />;
  if (!current) {
    return (
      <Screen>
        <Title>Compliance</Title>
        <EmptyState title="No aircraft" hint="Add an aircraft from the Dashboard first." />
      </Screen>
    );
  }

  const sortRank = { overdue: 0, no_record: 1, due_soon: 2, ok: 3, untracked: 4 } as const;
  const sortedInspections = [...(inspections ?? [])].sort(
    (a, b) =>
      sortRank[inspectionDue(a, current.currentTach).status] -
      sortRank[inspectionDue(b, current.currentTach).status],
  );

  return (
    <Screen>
      <Title>Compliance</Title>

      <SectionTitle>Inspections (AV1ATE)</SectionTitle>
      {sortedInspections.map((insp) => {
        const info = inspectionDue(insp, current.currentTach);
        return (
          <Card key={insp._id}>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 pr-2 font-semibold text-white">{insp.name}</Text>
              <StatusBadge status={info.status} detail={dueLabel(info)} />
            </View>
            <Text className="mt-1 text-xs text-flight-400">
              {intervalText(insp)}
              {insp.lastDoneDate !== undefined
                ? ` · last done ${formatDate(insp.lastDoneDate)}${
                    insp.lastDoneTach !== undefined ? ` @ ${insp.lastDoneTach.toFixed(1)}` : ""
                  }`
                : ""}
            </Text>
            <View className="mt-3 flex-row gap-4">
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/complete-inspection", params: { inspectionId: insp._id } })
                }
                className="active:opacity-60">
                <Text className="text-sm font-semibold text-instrument">Record completion</Text>
              </Pressable>
              <Pressable
                onPress={() => updateInspection({ id: insp._id, tracked: !insp.tracked })}
                className="active:opacity-60">
                <Text className="text-sm text-flight-400">
                  {insp.tracked ? "Stop tracking" : "Track"}
                </Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      <View className="flex-row items-center justify-between">
        <SectionTitle>Airworthiness Directives</SectionTitle>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.push("/import-ads")} className="active:opacity-60">
            <Ionicons name="cloud-download-outline" size={24} color="#0a84ff" />
          </Pressable>
          <Pressable onPress={() => router.push("/add-ad")} className="active:opacity-60">
            <Ionicons name="add-circle-outline" size={24} color="#0a84ff" />
          </Pressable>
        </View>
      </View>
      {(ads ?? []).length === 0 ? (
        <EmptyState
          title="No ADs recorded"
          hint="Track one-time and recurring Airworthiness Directives for this airframe, engine, and prop. Search current ADs at drs.faa.gov."
        />
      ) : (
        (ads ?? []).map((ad) => {
          const info = adDue(ad, current.currentTach);
          return (
            <Pressable
              key={ad._id}
              onLongPress={() =>
                Alert.alert("Delete AD", `Remove ${ad.adNumber}?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => removeAd({ id: ad._id }) },
                ])
              }>
              <Card>
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-white">AD {ad.adNumber}</Text>
                  <StatusBadge
                    status={info.status}
                    detail={ad.status === "not_applicable" ? "N/A" : ad.status === "complied" ? "Complied" : dueLabel(info)}
                  />
                </View>
                <Text className="mt-1 text-sm text-flight-200">{ad.title}</Text>
                <Text className="mt-1 text-xs text-flight-400">
                  {[
                    ad.appliesTo,
                    ad.methodOfCompliance && `MOC: ${ad.methodOfCompliance}`,
                    ad.complianceDate !== undefined && `complied ${formatDate(ad.complianceDate)}`,
                    ad.recurringIntervalHours !== undefined && `every ${ad.recurringIntervalHours}h`,
                    ad.recurringIntervalMonths !== undefined && `every ${ad.recurringIntervalMonths}mo`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

function intervalText(insp: Doc<"inspections">): string {
  const parts: string[] = [];
  if (insp.intervalCalendarMonths) parts.push(`${insp.intervalCalendarMonths} cal-mo`);
  if (insp.intervalDays) parts.push(`${insp.intervalDays} days`);
  if (insp.intervalHours) parts.push(`${insp.intervalHours} hrs`);
  return parts.length ? `Every ${parts.join(" / ")}` : "No interval set";
}
