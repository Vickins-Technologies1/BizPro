import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, AppState, Image, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
import NetInfo from "@react-native-community/netinfo";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";

const splashLogo = require("../../assets/brand/biz-pro-logo-transparent.png");

export function RootApp() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const loading = useAppStore((state) => state.loading);
  const business = useAppStore((state) => state.business);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncNow = useAppStore((state) => state.syncNow);
  const themeMode = useAppStore((state) => state.themeMode);

  useEffect(() => {
    void Asset.fromModule(splashLogo).downloadAsync().catch(() => undefined);
  }, []);

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
    return <LoadingSplash themeMode={themeMode} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={tokens.colors.background} />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

function LoadingSplash({ themeMode }: { themeMode: "light" | "dark" }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2200, useNativeDriver: true })
      ])
    );

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true })
    ]).start(() => driftLoop.start());

    return () => {
      driftLoop.stop();
    };
  }, [drift, fade, scale]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [10, -8] });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: tokens.colors.background, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={{ alignItems: "center", gap: 18, opacity: fade, transform: [{ translateY }, { scale }] }}>
              <Image
                source={splashLogo}
                resizeMode="contain"
                style={{ width: 260, height: 260, backgroundColor: "transparent" }}
              />
              <ActivityIndicator size="large" color={tokens.colors.primaryStrong} style={{ marginTop: 4 }} />
            </Animated.View>
          </View>
          <View style={{ alignItems: "center", paddingBottom: 6 }}>
            <Text style={{ color: tokens.colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>
              Powered by Vickins Technologies
            </Text>
          </View>
        </View>
      </SafeAreaView>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={tokens.colors.background} />
    </SafeAreaProvider>
  );
}
