import { useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAircraft } from "@/lib/aircraft-context";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/currency";
import { Button, Card, ChipRow, EmptyState, Screen, SectionTitle } from "@/components/ui";

const ROLES = ["mechanic", "viewer"] as const;
const ROLE_HINT: Record<(typeof ROLES)[number], string> = {
  mechanic: "Can add log entries, record inspections and ADs, upload documents, and resolve squawks.",
  viewer: "Can see everything and report squawks. Good for partners, renters, or a buyer's pre-buy.",
};

export default function ShareAircraft() {
  const { current, isOwner } = useAircraft();
  const members = useQuery(
    api.sharing.listMembers,
    current ? { aircraftId: current._id } : "skip",
  );
  const createInvite = useMutation(api.sharing.createInvite);
  const removeMember = useMutation(api.sharing.removeMember);

  const [role, setRole] = useState<(typeof ROLES)[number]>("mechanic");
  const [invite, setInvite] = useState<{ code: string; expiresAt: number } | null>(null);
  const [creating, setCreating] = useState(false);

  if (!current) {
    return (
      <Screen>
        <Button label="Join with Invite Code" onPress={() => router.replace("/join-aircraft")} />
      </Screen>
    );
  }

  async function generate() {
    if (!current) return;
    setCreating(true);
    try {
      setInvite(await createInvite({ aircraftId: current._id, role }));
    } catch (err) {
      Alert.alert("Couldn't create invite", errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function confirmRemove(id: Id<"aircraftMembers">, name: string, isMe: boolean) {
    Alert.alert(
      isMe ? "Leave aircraft" : "Remove access",
      isMe
        ? `You'll lose access to ${current?.tailNumber}'s records.`
        : `${name} will lose access to ${current?.tailNumber}'s records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isMe ? "Leave" : "Remove",
          style: "destructive",
          onPress: () => {
            void removeMember({ memberId: id }).then(() => {
              if (isMe) router.back();
            });
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Text className="text-2xl font-bold text-white">{current.tailNumber}</Text>

      {isOwner && (
        <Card className="gap-3">
          <SectionTitle>Invite someone</SectionTitle>
          <ChipRow options={ROLES} value={role} onChange={(r) => { setRole(r); setInvite(null); }} />
          <Text className="text-xs text-flight-300">{ROLE_HINT[role]}</Text>
          {invite ? (
            <View className="items-center gap-2 rounded-xl bg-flight-800 py-4">
              <Text selectable className="font-mono text-3xl font-bold tracking-[6px] text-white">
                {invite.code}
              </Text>
              <Text className="text-xs text-flight-400">
                Single use · expires {formatDate(invite.expiresAt)}
              </Text>
              <Button
                label="Send Code"
                icon="share-outline"
                variant="ghost"
                onPress={() =>
                  void Share.share({
                    message: `Join ${current.tailNumber} on BoundlessFlight as ${role}. Open the app, tap the people icon, then "Join with code", and enter: ${invite.code}`,
                  })
                }
              />
            </View>
          ) : (
            <Button label="Create Invite Code" icon="key-outline" loading={creating} onPress={() => void generate()} />
          )}
        </Card>
      )}

      <SectionTitle>People with access</SectionTitle>
      <Card className="flex-row items-center gap-3 py-3">
        <Ionicons name="star" size={18} color="#ffd60a" />
        <Text className="flex-1 font-semibold text-white">{isOwner ? "You" : "Aircraft owner"}</Text>
        <Text className="text-xs uppercase text-flight-400">Owner</Text>
      </Card>
      {members === undefined ? null : members.length === 0 ? (
        <EmptyState title="Only you" hint="Invite your A&P so they can sign entries straight into the logbook." />
      ) : (
        members.map((m) => (
          <Card key={m._id} className="flex-row items-center gap-3 py-3">
            <Ionicons
              name={m.role === "mechanic" ? "construct-outline" : "eye-outline"}
              size={18}
              color="#98989d"
            />
            <Text className="flex-1 font-semibold text-white" numberOfLines={1}>
              {m.isMe ? `${m.displayName} (you)` : m.displayName}
            </Text>
            <Text className="text-xs uppercase text-flight-400">{m.role}</Text>
            {(isOwner || m.isMe) && (
              <Pressable onPress={() => confirmRemove(m._id, m.displayName, m.isMe)} className="pl-2 active:opacity-60">
                <Ionicons name="close-circle-outline" size={22} color="#ff453a" />
              </Pressable>
            )}
          </Card>
        ))
      )}

      <Button
        label="Join Another Aircraft"
        icon="enter-outline"
        variant="secondary"
        onPress={() => router.push("/join-aircraft")}
      />
    </Screen>
  );
}
