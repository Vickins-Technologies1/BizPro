import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Badge, Card, GradientHeader, PrimaryButton, Screen, StatCard } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { ACCESS_PERMISSIONS, ROLE_ACCESS, ROLE_PRESETS, formatPermissionLabel, formatRoleLabel, getEffectivePermissions, type UserRole } from "@shared";

export function TeamAccessScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const role = (user?.role ?? "cashier") as UserRole;
  const currentPermissions = getEffectivePermissions(user);
  const roleLabel = user?.roleLabel ?? formatRoleLabel(role);
  const roleDetails = ROLE_PRESETS.map((preset) => ({
    role: preset.role,
    title: preset.label,
    subtitle: preset.description,
    tone: preset.role === "owner" ? ("success" as const) : preset.role === "manager" || preset.role === "supervisor" ? ("primary" as const) : ("warning" as const)
  }));

  return (
    <Screen>
      <GradientHeader
        title="Team Access"
        subtitle="Understand roles, permissions, and employee access"
        right={<Ionicons name="shield-checkmark-outline" size={26} color={tokens.colors.text} />}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>Access snapshot</Text>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Current account</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            {user?.fullName ?? "This account"} is signed in as {roleLabel}. {role === "owner" ? "Owner access is always granted full permissions." : "This view shows what this account can and cannot do."}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label={`${currentPermissions.length} permissions`} tone="success" />
            <Badge label={business?.name ?? "Biz Pro"} tone="primary" />
            <Badge label={roleLabel} tone="warning" />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {currentPermissions.map((permission) => (
              <Badge key={permission} label={formatPermissionLabel(permission)} tone="primary" />
            ))}
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <StatCard label="Roles" value={`${roleDetails.length}`} icon="people-outline" tone="primary" />
          </View>
          <View style={{ flex: 1 }}>
            <StatCard label="Permissions" value={`${ACCESS_PERMISSIONS.length}`} icon="shield-outline" tone="success" />
          </View>
        </View>

        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Role matrix</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Each role below uses a preset permission set. The owner can still customize employees after they are created.
          </Text>
          {roleDetails.map((item) => {
            const permissions = ROLE_ACCESS[item.role];
            const isCurrent = role === item.role;
            return (
              <View
                key={item.role}
                style={{
                  gap: 10,
                  padding: 14,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isCurrent ? tokens.colors.primaryStrong : tokens.colors.border,
                  backgroundColor: isCurrent ? "rgba(37,99,235,0.08)" : tokens.colors.surfaceAlt
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{item.title}</Text>
                    <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{item.subtitle}</Text>
                  </View>
                  <Badge label={isCurrent ? "current" : `${permissions.length} perms`} tone={item.tone} />
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {permissions.map((permission) => (
                    <Badge key={permission} label={formatPermissionLabel(permission)} tone="primary" />
                  ))}
                </View>
              </View>
            );
          })}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Owner workflow</Text>
          {[
            "Create the business owner during onboarding.",
            "Add employees after the first sign-in.",
            "Choose a role preset before sharing access.",
            "Review activity and tighten access when needed."
          ].map((step, index) => (
            <View key={step} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(37,99,235,0.16)"
                }}
              >
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>{index + 1}</Text>
              </View>
              <Text style={{ color: tokens.colors.textSecondary, flex: 1, lineHeight: 20 }}>{step}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Access notes</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Open the employee workspace to manage staff profiles, permissions, and audit history.
          </Text>
          <PrimaryButton title="Open employees" onPress={() => navigation.navigate("Employees")} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
