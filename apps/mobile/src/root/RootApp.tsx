import React, { useEffect, useRef } from "react";
import { Animated, AppState, Easing, Image, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
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
      requestPermission: false
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Image source={getBrandLogo(themeMode)} resizeMode="contain" style={{ width: 220, height: 220, backgroundColor: "transparent" }} />
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
