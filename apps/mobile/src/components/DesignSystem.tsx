import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useThemeTokens } from "@/theme";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

function toneColor(tone: Tone, colors: ReturnType<typeof useThemeTokens>["colors"]) {
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  if (tone === "danger") return colors.danger;
  if (tone === "neutral") return colors.neutral;
  return colors.primaryStrong;
}

export function SectionHeader({
  title,
  description,
  actionLabel,
  onAction,
  style
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useThemeTokens();
  const componentStyles = useDesignStyles(theme);
  return (
    <View style={[componentStyles.sectionHeader, style]}>
      <View style={componentStyles.copy}>
        <Text style={[componentStyles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        {description ? <Text style={[componentStyles.description, { color: theme.colors.textSecondary }]}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [componentStyles.textAction, pressed && componentStyles.pressed]}>
          <Text style={[componentStyles.actionLabel, { color: theme.colors.primaryStrong }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function MetricSummary({
  label,
  value,
  detail,
  tone = "neutral",
  style
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useThemeTokens();
  const componentStyles = useDesignStyles(theme);
  return (
    <View style={[componentStyles.metric, style]}>
      <Text style={[componentStyles.metricLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      <Text style={[componentStyles.metricValue, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{value}</Text>
      {detail ? <Text style={[componentStyles.metricDetail, { color: toneColor(tone, theme.colors) }]} numberOfLines={1}>{detail}</Text> : null}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  style
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useThemeTokens();
  const componentStyles = useDesignStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        componentStyles.iconButton,
        { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
        disabled && componentStyles.disabled,
        pressed && !disabled && componentStyles.pressed,
        style
      ]}
    >
      <Ionicons name={icon} size={19} color={disabled ? theme.colors.disabled : theme.colors.icon} />
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = "Search",
  accessibilityLabel = "Search",
  style,
  inputStyle
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const theme = useThemeTokens();
  const componentStyles = useDesignStyles(theme);
  return (
    <View style={[componentStyles.searchField, { backgroundColor: theme.colors.input, borderColor: theme.colors.border }, style]}>
      <Ionicons name="search-outline" size={18} color={theme.colors.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[componentStyles.searchInput, { color: theme.colors.text }, inputStyle]}
      />
      {value.length ? (
        <Pressable onPress={() => onChangeText("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={componentStyles.clearButton}>
          <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  style
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useThemeTokens();
  const componentStyles = useDesignStyles(theme);
  const content = (
    <>
      {leading ? <View style={componentStyles.rowLeading}>{leading}</View> : null}
      <View style={componentStyles.copy}>
        <Text style={[componentStyles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[componentStyles.rowSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={componentStyles.rowTrailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) return <View style={[componentStyles.listRow, style]}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [componentStyles.listRow, style, pressed && componentStyles.pressed]}>
      {content}
    </Pressable>
  );
}

export function ChartContainer({
  title,
  description,
  legend,
  children,
  style
}: {
  title: string;
  description?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useThemeTokens();
  const componentStyles = useDesignStyles(theme);
  return (
    <View style={[componentStyles.chartContainer, { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.divider }, style]}>
      <View style={componentStyles.chartHeader}>
        <View style={componentStyles.copy}>
          <Text style={[componentStyles.chartTitle, { color: theme.colors.text }]}>{title}</Text>
          {description ? <Text style={[componentStyles.description, { color: theme.colors.textSecondary }]}>{description}</Text> : null}
        </View>
        {legend ? <View style={componentStyles.chartLegend}>{legend}</View> : null}
      </View>
      {children}
    </View>
  );
}

function useDesignStyles(theme: ReturnType<typeof useThemeTokens>) {
  return React.useMemo(() => StyleSheet.create({
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md, minHeight: 36 },
    copy: { flex: 1, minWidth: 0, gap: theme.spacing.xxs },
    sectionTitle: { fontSize: theme.typography.subtitle, lineHeight: theme.typography.subtitle + 5, fontWeight: "700", letterSpacing: -0.1 },
    description: { fontSize: theme.typography.small, lineHeight: theme.typography.small + 5 },
    textAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: theme.spacing.xxs },
    actionLabel: { fontSize: theme.typography.body, lineHeight: theme.typography.body + 4, fontWeight: "600" },
    metric: { minWidth: 0, gap: theme.spacing.xxs },
    metricLabel: { fontSize: theme.typography.small, lineHeight: theme.typography.small + 4, fontWeight: "500" },
    metricValue: { fontSize: theme.typography.numeric, lineHeight: theme.typography.numeric + 4, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
    metricDetail: { fontSize: theme.typography.micro, lineHeight: theme.typography.micro + 4, fontWeight: "600" },
    iconButton: { width: 44, height: 44, borderWidth: 1, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center" },
    searchField: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderRadius: theme.radii.md },
    searchInput: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 0, fontSize: theme.typography.body },
    clearButton: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
    listRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.xs },
    rowLeading: { alignItems: "center", justifyContent: "center" },
    rowTitle: { fontSize: theme.typography.body, lineHeight: theme.typography.body + 5, fontWeight: "600" },
    rowSubtitle: { fontSize: theme.typography.small, lineHeight: theme.typography.small + 5 },
    rowTrailing: { alignItems: "flex-end", justifyContent: "center" },
    chartContainer: { gap: theme.spacing.md, padding: theme.spacing.md, borderWidth: 1, borderRadius: theme.radii.lg },
    chartHeader: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
    chartTitle: { fontSize: theme.typography.body, lineHeight: theme.typography.body + 5, fontWeight: "700" },
    chartLegend: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.48 }
  }), [theme]);
}
