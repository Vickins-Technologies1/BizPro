import React, { useEffect } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import NetInfo from "@react-native-community/netinfo";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";

export function RootApp() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const loading = useAppStore((state) => state.loading);
  const business = useAppStore((state) => state.business);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncNow = useAppStore((state) => state.syncNow);
  const themeMode = useAppStore((state) => state.themeMode);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!business) return;
    if (pendingSync > 0) {
      syncNow().catch(() => undefined);
    }
  }, [business, pendingSync, syncNow]);

  useEffect(() => {
    if (!business) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncNow().catch(() => undefined);
      }
    });
    const netSub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncNow().catch(() => undefined);
      }
    });
    const timer = setInterval(() => {
      syncNow().catch(() => undefined);
    }, 60000);
    return () => {
      sub.remove();
      netSub();
      clearInterval(timer);
    };
  }, [business, syncNow]);

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
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
                Executive internet-first business control for serious SMEs.
              </Text>
              <ActivityIndicator size="large" color={tokens.colors.primaryStrong} style={{ marginTop: 10 }} />
            </View>
          </LinearGradient>
        </SafeAreaView>
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={tokens.colors.background} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={tokens.colors.background} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
