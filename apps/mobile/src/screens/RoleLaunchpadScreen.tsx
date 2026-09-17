import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, Card, GradientHeader, PrimaryButton, Screen } from "@/components/Primitives";
import { useAppStore } from "@/store/useAppStore";
import { useThemeTokens } from "@/theme";

export function RoleLaunchpadScreen() {
  const theme = useThemeTokens();
  const styles = createStyles(theme);
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const branches = useAppStore((state) => state.branches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);
  const canManageBranches = user?.role === "owner";
  const activeBranches = branches.filter((branch) => branch.status !== "inactive");
  const [savingBranchId, setSavingBranchId] = React.useState<string | null | undefined>(undefined);

  const canChooseConsolidated = user?.role === "owner" && activeBranches.length > 1;
  const selectedLabel = selectedBranchId
    ? branches.find((branch) => branch.id === selectedBranchId)?.name ?? "Selected branch"
    : canChooseConsolidated
      ? "All branches"
      : activeBranches[0]?.name ?? branches[0]?.name ?? "Workspace";

  async function chooseBranch(branchId: string | null) {
    setSavingBranchId(branchId);
    try {
      await setSelectedBranchId(branchId);
    } finally {
      setSavingBranchId(undefined);
    }
  }

  return (
    <Screen>
      <GradientHeader title="Choose Workspace" subtitle="Select the business view you want to work in." />
      <AppScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="business-outline" size={22} color={theme.colors.primaryStrong} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.eyebrow}>Current business</Text>
            <Text style={styles.businessName}>{business?.name ?? "Dira OS"}</Text>
            <Text style={styles.summaryText}>{user?.fullName ?? "Team member"} · {selectedLabel}</Text>
          </View>
          <Badge label={user?.roleLabel ?? user?.role ?? "Member"} tone="primary" />
        </Card>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Workspace scope</Text>
            <Text style={styles.sectionSubtitle}>Choose the branch data used across the workspace.</Text>
          </View>
          <Badge label={`${branches.length} ${branches.length === 1 ? "branch" : "branches"}`} tone="success" />
        </View>

          <View style={styles.options}>
          {canChooseConsolidated ? (
            <WorkspaceOption
              icon="layers-outline"
              title="All branches"
              subtitle="View consolidated business activity"
              selected={selectedBranchId === null}
              loading={savingBranchId === null}
              onPress={() => void chooseBranch(null)}
            />
          ) : null}
          {activeBranches.map((branch) => (
            <WorkspaceOption
              key={branch.id}
              icon="storefront-outline"
              title={branch.name}
              subtitle={branch.isDefault ? "Default branch" : "Business branch"}
              selected={selectedBranchId === branch.id || (!selectedBranchId && branches.length === 1)}
              loading={savingBranchId === branch.id}
              onPress={() => void chooseBranch(branch.id)}
            />
          ))}
        </View>

        <PrimaryButton title="Continue to workspace" onPress={() => navigation.navigate("Main", { screen: "Dashboard" })} />
        {canManageBranches ? <PrimaryButton title="Manage branches" variant="secondary" onPress={() => navigation.navigate("Branches")} /> : null}
      </AppScrollView>
    </Screen>
  );
}

function WorkspaceOption({
  icon,
  title,
  subtitle,
  selected,
  loading,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const theme = useThemeTokens();
  const styles = createStyles(theme);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Ionicons name={icon} size={19} color={selected ? theme.colors.primaryStrong : theme.colors.textSecondary} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={theme.colors.primaryStrong} /> : <Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} size={20} color={selected ? theme.colors.primaryStrong : theme.colors.textMuted} />}
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useThemeTokens>) {
  return StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 28 },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: `${theme.colors.primary}18` },
  summaryCopy: { flex: 1, gap: 2 },
  eyebrow: { color: theme.colors.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  businessName: { color: theme.colors.text, fontSize: 17, fontWeight: "900" },
  summaryText: { color: theme.colors.textSecondary, fontSize: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "900" },
  sectionSubtitle: { color: theme.colors.textSecondary, lineHeight: 18, fontSize: 12 },
  options: { gap: 8 },
  option: { minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 11, flexDirection: "row", alignItems: "center", gap: 11 },
  optionSelected: { borderColor: theme.colors.primaryStrong, backgroundColor: `${theme.colors.primary}12` },
  optionPressed: { opacity: 0.82 },
  optionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surfaceAlt },
  optionIconSelected: { backgroundColor: `${theme.colors.primary}20` },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "800" },
  optionTitleSelected: { color: theme.colors.primaryStrong },
  optionSubtitle: { color: theme.colors.textSecondary, fontSize: 12 }
  });
}
