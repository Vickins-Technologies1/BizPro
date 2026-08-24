import "react-native-gesture-handler";
import React from "react";
import { Platform } from "react-native";
import * as SystemUI from "expo-system-ui";
import { tokens } from "./src/theme/tokens";
import { RootApp } from "./src/root/RootApp";

if (Platform.OS !== "web") {
  void SystemUI.setBackgroundColorAsync(tokens.colors.background).catch(() => undefined);
}

export default function App() {
  return <RootApp />;
}
