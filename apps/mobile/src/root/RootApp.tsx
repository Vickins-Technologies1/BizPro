import React, { useEffect } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";

export function RootApp() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const loading = useAppStore((state) => state.loading);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const syncNow = useAppStore((state) => state.syncNow);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!business || !user) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncNow().catch(() => undefined);
      }
    });
    const timer = setInterval(() => {
      syncNow().catch(() => undefined);
    }, 60000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [business, user, syncNow]);

  if (loading) {
    return (
      <SafeAreaProvider>
        <LinearGradient colors={[tokens.colors.background, tokens.colors.backgroundAlt]} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ alignItems: "center", gap: 16 }}>
            <View
              style={{
                width: 92,
                height: 92,
                borderRadius: 28,
                backgroundColor: "rgba(37,99,235,0.14)",
                borderWidth: 1,
                borderColor: tokens.colors.border,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: tokens.colors.text, fontSize: 30, fontWeight: "900" }}>V</Text>
            </View>
            <Text style={{ color: tokens.colors.text, fontSize: 26, fontWeight: "800", letterSpacing: 0.6 }}>Vickins Business OS</Text>
            <Text style={{ color: tokens.colors.textSecondary, textAlign: "center", maxWidth: 280 }}>
              Executive offline-first business control for serious SMEs.
            </Text>
            <ActivityIndicator size="large" color={tokens.colors.primaryStrong} style={{ marginTop: 10 }} />
          </View>
        </LinearGradient>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
