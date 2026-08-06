import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, AppState, Image, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import NetInfo from "@react-native-community/netinfo";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";

const splashLogo = require("../../assets/brand/biz-pro-logo.png");

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
  const glowScale = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowOpacity = drift.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.58] });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <LinearGradient
          colors={[tokens.colors.background, tokens.colors.backgroundAlt]}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: tokens.colors.background
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: 320,
              backgroundColor: "rgba(37,99,235,0.18)"
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 360,
              height: 360,
              borderRadius: 360,
              backgroundColor: "rgba(14,165,233,0.14)",
              opacity: glowOpacity,
              transform: [{ scale: glowScale }]
            }}
          />

          <Animated.View style={{ alignItems: "center", gap: 18, opacity: fade, transform: [{ translateY }, { scale }] }}>
            <View
              style={{
                width: 184,
                height: 184,
                borderRadius: 52,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: tokens.colors.border,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.22,
                shadowRadius: 28,
                shadowOffset: { width: 0, height: 16 },
                elevation: 10
              }}
            >
              <Image source={splashLogo} resizeMode="contain" style={{ width: 154, height: 154 }} />
            </View>
            <View style={{ alignItems: "center", gap: 8, maxWidth: 320 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 24, fontWeight: "800", letterSpacing: 0.5 }}>Biz Pro</Text>
              <Text style={{ color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
                Preparing your workspace and syncing your latest data.
              </Text>
              <Text style={{ color: tokens.colors.textMuted, textAlign: "center", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
                Powered by Vickins Technologies
              </Text>
            </View>
            <ActivityIndicator size="large" color={tokens.colors.primaryStrong} style={{ marginTop: 6 }} />
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={tokens.colors.background} />
    </SafeAreaProvider>
  );
}
