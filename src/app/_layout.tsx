import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Authenticated,
  AuthLoading,
  ConvexProvider,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ComponentProps } from "react";

import { authClient } from "@/lib/auth-client";
import { AircraftProvider } from "@/lib/aircraft-context";
import { LoadingScreen } from "@/components/ui";
import { SignInScreen } from "@/components/sign-in";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  expectAuth: true,
  unsavedChangesWarning: false,
});

const modalOptions = {
  presentation: "modal" as const,
  headerStyle: { backgroundColor: "#000000" },
  headerTintColor: "#0a84ff",
  headerTitleStyle: { color: "#ffffff" },
  contentStyle: { backgroundColor: "#000000" },
};

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      {/* Cast bridges a type-only skew between better-auth 1.6.23 and the
          component's AuthClient type; runtime shape matches the integration guide. */}
      <ConvexBetterAuthProvider
        client={convex}
        authClient={
          authClient as unknown as ComponentProps<typeof ConvexBetterAuthProvider>["authClient"]
        }>
        <StatusBar style="light" />
        <AuthLoading>
          <LoadingScreen />
        </AuthLoading>
        <Unauthenticated>
          <SignInScreen />
        </Unauthenticated>
        <Authenticated>
          <AircraftProvider>
            <Stack screenOptions={{ contentStyle: { backgroundColor: "#000000" } }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add-aircraft" options={{ ...modalOptions, title: "Add Aircraft" }} />
              <Stack.Screen name="add-log" options={{ ...modalOptions, title: "New Log Entry" }} />
              <Stack.Screen name="add-ad" options={{ ...modalOptions, title: "Airworthiness Directive" }} />
              <Stack.Screen name="import-ads" options={{ ...modalOptions, title: "Find ADs" }} />
              <Stack.Screen name="add-document" options={{ ...modalOptions, title: "Upload Document" }} />
              <Stack.Screen
                name="complete-inspection"
                options={{ ...modalOptions, title: "Record Inspection" }}
              />
              <Stack.Screen name="update-times" options={{ ...modalOptions, title: "Update Times" }} />
            </Stack>
          </AircraftProvider>
        </Authenticated>
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  );
}
