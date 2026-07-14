import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authClient } from "@/lib/auth-client";
import { Button, Card, Field } from "@/components/ui";

export function SignInScreen() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "signIn"
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim(),
            });
      if (result.error) {
        setError(result.error.message ?? "Something went wrong.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim().length > 3 && password.length >= 8;

  return (
    <SafeAreaView className="flex-1 bg-flight-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-6">
        <Text className="text-center text-3xl font-extrabold text-white">
          Boundless<Text className="text-instrument">Flight</Text>
        </Text>
        <Text className="mb-6 mt-1 text-center text-sm text-flight-300">
          Your aircraft's records, wherever you fly.
        </Text>

        <Card className="gap-3">
          {mode === "signUp" && (
            <Field label="Name" value={name} onChangeText={setName} placeholder="Amelia Earhart" />
          )}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          />
          {error && <Text className="text-sm text-warning">{error}</Text>}
          <Button
            label={mode === "signIn" ? "Sign In" : "Create Account"}
            onPress={() => void submit()}
            loading={busy}
            disabled={!canSubmit}
          />
        </Card>

        <Pressable
          onPress={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="mt-4 active:opacity-60">
          <Text className="text-center text-sm text-flight-300">
            {mode === "signIn" ? (
              <>
                New here? <Text className="font-semibold text-instrument">Create an account</Text>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Text className="font-semibold text-instrument">Sign in</Text>
              </>
            )}
          </Text>
        </Pressable>

        <View className="h-10" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
