import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, AppState, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
import * as Device from "expo-device";
import * as SystemUI from "expo-system-ui";
import NetInfo from "@react-native-community/netinfo";
import { LinearGradient } from "expo-linear-gradient";
import { ErrorState, PrimaryButton } from "@/components/Primitives";
import { getBrandLogo } from "@/components/BrandLogo";
import { RootNavigator } from "@/navigation/RootNavigator";
import { useAppStore } from "@/store/useAppStore";
import { getThemeTokens, tokens, type ThemeMode } from "@/theme/tokens";
import { configureNotificationListeners, registerPushNotifications } from "@/services/notifications";

export function RootApp() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const loading = useAppStore((state) => state.loading);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const deviceId = useAppStore((state) => state.deviceId);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const syncNow = useAppStore((state) => state.syncNow);
  const themeMode = useAppStore((state) => state.themeMode);
  const error = useAppStore((state) => state.error);
  const theme = getThemeTokens(themeMode);

  useEffect(() => {
    if (Platform.OS !== "web") {
      void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
    }
  }, [theme.colors.background]);

  useEffect(() => {
    void Asset.fromModule(getBrandLogo(themeMode)).downloadAsync().catch(() => undefined);
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
    const cleanup = configureNotificationListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!business || !user || !deviceId) return;
    void registerPushNotifications({
      businessId: business.id,
      userId: user.id,
      deviceId,
      deviceName: Device.deviceName ?? Device.modelName ?? "Biz Pro device",
      platform: Platform.OS as "android" | "ios" | "web",
      requestPermission: true
    }).then((result) => {
      if (result.status === "error") {
        console.warn("[notifications] Startup registration unavailable", result.message);
      }
    });
  }, [business, deviceId, user]);

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

  if (error && !business) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={theme.colors.background} />
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
              <ErrorState
                title="Biz Pro could not start"
                subtitle={error}
                action={<PrimaryButton title="Try again" onPress={() => bootstrap().catch(() => undefined)} />}
                icon="warning-outline"
              />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={theme.colors.background} />
        <RootNavigator />
        <ThemeTransitionOverlay themeMode={themeMode} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function LoadingSplash({ themeMode }: { themeMode: "light" | "dark" }) {
  const theme = getThemeTokens(themeMode);
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 }}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Animated.View style={{ alignItems: "center", gap: 18, opacity: fade, transform: [{ translateY }, { scale }] }}>
                <Image
                  source={getBrandLogo(themeMode)}
                  resizeMode="contain"
                  style={{ width: 260, height: 260, backgroundColor: "transparent" }}
                />
                <ActivityIndicator size="large" color={theme.colors.primaryStrong} style={{ marginTop: 4 }} />
              </Animated.View>
            </View>
            <View style={{ alignItems: "center", paddingBottom: 6 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>
                Powered by Vickins Technologies
              </Text>
            </View>
          </View>
        </SafeAreaView>
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} translucent={false} backgroundColor={theme.colors.background} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemeTransitionOverlay({ themeMode }: { themeMode: ThemeMode }) {
  const previousModeRef = useRef(themeMode);
  const progress = useRef(new Animated.Value(1)).current;
  const [transition, setTransition] = React.useState<null | { from: ThemeMode; to: ThemeMode }>(null);

  useEffect(() => {
    if (previousModeRef.current === themeMode) {
      return;
    }

    const from = previousModeRef.current;
    previousModeRef.current = themeMode;
    setTransition({ from, to: themeMode });
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        setTransition(null);
      }
    });
  }, [progress, themeMode]);

  if (!transition) {
    return null;
  }

  const fromTheme = getThemeTokens(transition.from);
  const toTheme = getThemeTokens(transition.to);
  const fadeOut = progress.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] });
  const fadeIn = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] });
  const lift = progress.interpolate({ inputRange: [0, 1], outputRange: [1.01, 1] });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 50 }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeOut, transform: [{ scale: lift }] }]}>
        <LinearGradient colors={fromTheme.gradients.surface} style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: fromTheme.colors.background }]} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeIn }]}>
        <LinearGradient colors={toTheme.gradients.premium} style={StyleSheet.absoluteFillObject} />
      </Animated.View>
    </Animated.View>
  );
}
