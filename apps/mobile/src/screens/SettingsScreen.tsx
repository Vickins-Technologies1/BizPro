import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Card, GradientHeader, PrimaryButton, Screen } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const pendingSync = useAppStore((state) => state.pendingSync);
  const themeMode = useAppStore((state) => state.themeMode);
  const syncNow = useAppStore((state) => state.syncNow);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const logout = useAppStore((state) => state.logout);

  return (
    <Screen>
      <GradientHeader
        title="Settings"
        subtitle="Business profile, sync status, and device security"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 8 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>{business?.name}</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>{business?.businessType?.replaceAll("_", " ")}</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Plan: {business?.planTier?.toUpperCase()} • Currency: {business?.currency}</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Signed in: {user?.fullName ?? "Unknown"} ({user?.role ?? "n/a"})</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Pending sync: {pendingSync}</Text>
        </Card>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Theme</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>Light is the default. Dark mode stays off unless you turn it on here.</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              { label: "Light", value: "light" as const },
              { label: "Dark", value: "dark" as const }
            ].map((option) => {
              const selected = themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    setThemeMode(option.value).catch((error) => {
                      Alert.alert("Theme update failed", error instanceof Error ? error.message : "Unable to save theme preference");
                    })
                  }
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: selected ? tokens.colors.primaryStrong : tokens.colors.border,
                    backgroundColor: selected ? tokens.colors.primary : tokens.colors.surfaceAlt
                  }}
                >
                  <Text style={{ color: selected ? "#FFFFFF" : tokens.colors.text, fontWeight: "800" }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <PrimaryButton title="Sync now" onPress={() => syncNow().catch((error) => Alert.alert("Sync failed", error.message))} />
        <PrimaryButton title="Logout" variant="danger" onPress={() => logout().catch((error) => Alert.alert("Logout failed", error.message))} />
      </ScrollView>
    </Screen>
  );
}
