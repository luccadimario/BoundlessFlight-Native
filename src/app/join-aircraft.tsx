import { useState } from "react";
import { Alert, Text } from "react-native";
import { router } from "expo-router";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAircraft } from "@/lib/aircraft-context";
import { errorMessage } from "@/lib/errors";
import { Button, Field, Screen } from "@/components/ui";

export default function JoinAircraft() {
  const { setAircraftId } = useAircraft();
  const join = useMutation(api.sharing.joinWithCode);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  async function submit() {
    setJoining(true);
    try {
      const result = await join({ code });
      setAircraftId(result.aircraftId);
      router.dismissAll();
      Alert.alert("You're in", `You now have ${result.role} access to ${result.tailNumber}.`);
    } catch (err) {
      Alert.alert("Couldn't join", errorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  return (
    <Screen>
      <Text className="text-flight-300">
        Enter the invite code the aircraft owner sent you. Codes are single use and expire after 7 days.
      </Text>
      <Field
        label="Invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCD2345"
        style={{ fontSize: 24, letterSpacing: 4, textAlign: "center" }}
      />
      <Button
        label="Join Aircraft"
        loading={joining}
        disabled={code.replace(/[^A-Za-z0-9]/g, "").length < 8}
        onPress={() => void submit()}
      />
    </Screen>
  );
}
