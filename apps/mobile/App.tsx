import "react-native-gesture-handler";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as SystemUI from "expo-system-ui";
import { tokens } from "./src/theme/tokens";
import { RootApp } from "./src/root/RootApp";
import { reportMobileError } from "./src/services/apiClient";

if (Platform.OS !== "web") {
  void SystemUI.setBackgroundColorAsync(tokens.colors.background).catch(() => undefined);
}

type ErrorUtilsLike = { getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined; setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void };
const runtime = globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike; __diraErrorHandlerInstalled?: boolean };
if (runtime.ErrorUtils && !runtime.__diraErrorHandlerInstalled) {
  runtime.__diraErrorHandlerInstalled = true;
  const previous = runtime.ErrorUtils.getGlobalHandler?.();
  runtime.ErrorUtils.setGlobalHandler((error, isFatal) => {
    void reportMobileError({ title: error?.name || "Unhandled mobile error", message: error?.message || "An unhandled mobile error occurred", ...(error?.stack ? { stackTrace: error.stack } : {}), module: "runtime", severity: isFatal ? "critical" : "high" });
    previous?.(error, isFatal);
  });
}

class RootErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void reportMobileError({ title: error.name || "Mobile rendering error", message: error.message, stackTrace: `${error.stack ?? ""}\n${info.componentStack ?? ""}`, module: "render", severity: "critical" });
  }
  render() {
    if (this.state.hasError) return <View style={{ flex: 1, backgroundColor: tokens.colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}><Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "700" }}>DIRA OS needs to restart this screen</Text><Text style={{ color: tokens.colors.textSecondary, textAlign: "center" }}>The issue has been recorded when a secure connection is available.</Text><Pressable onPress={() => this.setState({ hasError: false })} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: tokens.colors.primary }}><Text style={{ color: "#fff", fontWeight: "700" }}>Try again</Text></Pressable></View>;
    return this.props.children;
  }
}

export default function App() {
  return <RootErrorBoundary><RootApp /></RootErrorBoundary>;
}
