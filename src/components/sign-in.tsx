import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

import { authClient } from "@/lib/auth-client";

export function SignInScreen() {
  const [error, setError] = useState<string | null>(null);

  async function signInWithApple() {
    setError(null);
    try {
      const nonce = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
      if (!credential.identityToken) {
        setError("Apple didn't return an identity token. Please try again.");
        return;
      }
      const result = await authClient.signIn.social({
        provider: "apple",
        idToken: {
          token: credential.identityToken,
          nonce,
          // Apple only ever sends the name/email on the user's first
          // authorization, so pass it through when present.
          user:
            credential.fullName?.givenName || credential.email
              ? {
                  name: {
                    firstName: credential.fullName?.givenName ?? undefined,
                    lastName: credential.fullName?.familyName ?? undefined,
                  },
                  email: credential.email ?? undefined,
                }
              : undefined,
        },
      });
      if (result.error) {
        setError(result.error.message ?? "Something went wrong.");
      }
    } catch (err) {
      // Code 1001 is Apple's own "user canceled" — not an error worth surfacing.
      if (err && typeof err === "object" && "code" in err && err.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Boundless<Text style={styles.titleAccent}>Flight</Text>
        </Text>
        <Text style={styles.subtitle}>Your aircraft's records, wherever you fly.</Text>

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={() => void signInWithApple()}
        />

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    textAlign: "center",
    fontSize: 30,
    fontWeight: "800",
    color: "#ffffff",
  },
  titleAccent: {
    color: "#0a84ff",
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 40,
    textAlign: "center",
    fontSize: 14,
    color: "#98989d",
  },
  appleButton: {
    height: 50,
  },
  error: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 14,
    color: "#ff453a",
  },
});
