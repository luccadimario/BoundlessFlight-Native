import { Alert, Linking, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { api } from "../../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { formatDate } from "@/lib/currency";
import { Button, Card, EmptyState, LoadingScreen, Screen, SectionTitle, Title } from "@/components/ui";

const KIND_META: Record<string, { label: string; icon: any }> = {
  airworthiness_certificate: { label: "Airworthiness Certificate", icon: "shield-outline" },
  registration: { label: "Registration", icon: "card-outline" },
  weight_and_balance: { label: "Weight & Balance", icon: "scale-outline" },
  poh_afm: { label: "POH / AFM", icon: "book-outline" },
  logbook_scan: { label: "Logbook Scan", icon: "images-outline" },
  insurance: { label: "Insurance", icon: "umbrella-outline" },
  stc_337: { label: "STC / Form 337", icon: "construct-outline" },
  other: { label: "Other", icon: "document-outline" },
};

// ARROW: documents required on board
const ARROW_KINDS = ["airworthiness_certificate", "registration", "poh_afm", "weight_and_balance"];

export default function Documents() {
  const { current, isLoading, isOwner, canWrite } = useAircraft();
  const docs = useQuery(
    api.documents.listByAircraft,
    current ? { aircraftId: current._id } : "skip",
  );
  const removeDoc = useMutation(api.documents.remove);

  if (isLoading) return <LoadingScreen />;
  if (!current) {
    return (
      <Screen>
        <Title>Documents</Title>
        <EmptyState title="No aircraft" hint="Add an aircraft from the Dashboard first." />
      </Screen>
    );
  }

  const kindsOnFile = new Set((docs ?? []).map((d) => d.kind));
  const missingArrow = ARROW_KINDS.filter((k) => !kindsOnFile.has(k as any));

  return (
    <Screen>
      <Title>Documents</Title>

      {missingArrow.length > 0 && (
        <Card className="border-caution/40 bg-caution/10">
          <Text className="font-semibold text-caution">ARROW checklist incomplete</Text>
          <Text className="mt-1 text-xs text-flight-200">
            Missing: {missingArrow.map((k) => KIND_META[k].label).join(", ")}
          </Text>
        </Card>
      )}

      {canWrite && <Button label="Upload Document" onPress={() => router.push("/add-document")} />}

      <SectionTitle>On file</SectionTitle>
      {(docs ?? []).length === 0 ? (
        <EmptyState
          title="Nothing on file"
          hint="Store the airworthiness certificate, registration, W&B, and scanned logbooks so they're always with you."
        />
      ) : (
        (docs ?? []).map((doc) => {
          const meta = KIND_META[doc.kind] ?? KIND_META.other;
          return (
            <Pressable
              key={doc._id}
              onPress={() => doc.url && Linking.openURL(doc.url)}
              onLongPress={() =>
                isOwner &&
                Alert.alert("Delete document", `Remove "${doc.title}"?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => removeDoc({ id: doc._id }) },
                ])
              }>
              <Card className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-flight-800">
                  <Ionicons name={meta.icon} size={20} color="#0a84ff" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-white" numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text className="text-xs text-flight-400">
                    {meta.label}
                    {doc.expiresOn !== undefined ? ` · expires ${formatDate(doc.expiresOn)}` : ""}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={18} color="#8e8e93" />
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
