import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Brand } from "@shared";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { archiveBrand, updateBrand } from "@/services/apiClient";
import { Ionicons } from "@expo/vector-icons";
import { SearchField } from "@/components/DesignSystem";

export function BrandsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const brands = useAppStore((state) => state.brands);
  const products = useAppStore((state) => state.products);
  const addBrand = useAppStore((state) => state.addBrand);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [search, setSearch] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<Brand | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "archived">("all");

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const productCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (product.brandId) counts.set(product.brandId, (counts.get(product.brandId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return brands.filter((brand) => {
      const productNames = products.filter((product) => product.brandId === brand.id).map((product) => product.name).join(" ");
      const matchesQuery = [brand.name, brand.description ?? "", productNames].join(" ").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? brand.isActive : !brand.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [brands, products, search, statusFilter]);

  function openEditor(brand?: Brand | null) {
    setEditing(brand ?? null);
    setName(brand?.name ?? "");
    setDescription(brand?.description ?? "");
    setVisible(true);
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadCatalog();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen>
      <GradientHeader
        title="Brands"
        subtitle="Keep manufacturer and label records organized"
        right={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back-outline" size={26} color={tokens.colors.text} />
          </Pressable>
        }
      />
      <AppScrollView refreshing={refreshing} onRefresh={refresh} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 }}>
        <View style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: tokens.colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>Brand directory</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }}>{filtered.length} of {brands.length} brands · {[...productCounts.values()].reduce((sum, count) => sum + count, 0)} linked products in loaded catalog</Text>
            </View>
            <PrimaryButton title="Add brand" onPress={() => openEditor(null)} />
          </View>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search brands, descriptions, or products" accessibilityLabel="Search brands and linked products" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }} accessibilityLabel="Filter brands by status">
            {(["all", "active", "archived"] as const).map((option) => <Tag key={option} label={option === "all" ? "All brands" : option === "active" ? "Active" : "Archived"} selected={statusFilter === option} onPress={() => setStatusFilter(option)} />)}
          </ScrollView>
        </View>
        {filtered.length ? (
          <View style={{ borderTopWidth: 1, borderTopColor: tokens.colors.border }}>
            {filtered.map((brand) => (
              <View key={brand.id} style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: tokens.colors.border }}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: tokens.colors.text, fontSize: 13, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>{brand.name}</Text>
                    {!brand.isActive ? <Badge label="Archived" tone="warning" /> : null}
                  </View>
                  {brand.description ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 11 }} numberOfLines={1}>{brand.description}</Text> : null}
                  <Text style={{ color: tokens.colors.textMuted, fontSize: 10 }}>{productCounts.get(brand.id) ?? 0} linked product{productCounts.get(brand.id) === 1 ? "" : "s"}</Text>
                </View>
                <Pressable onPress={() => openEditor(brand)} accessibilityRole="button" accessibilityLabel={`Edit ${brand.name}`} hitSlop={7} style={{ padding: 8 }}>
                  <Ionicons name="create-outline" size={18} color={tokens.colors.primaryStrong} />
                </Pressable>
                {brand.isActive ? <Pressable
                  onPress={async () => {
                    const confirmed = await confirmMobile(`Archive ${brand.name}?`);
                    if (!confirmed) return;
                    await archiveBrand(brand.id);
                    await loadCatalog();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${brand.name}`}
                  hitSlop={7}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="archive-outline" size={18} color={tokens.colors.textSecondary} />
                </Pressable> : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title={search || statusFilter !== "all" ? "No matching brands" : "No brands yet"}
            subtitle={search || statusFilter !== "all" ? "Try another search or clear the active filters." : "Create a brand to organize inventory by supplier line."}
            action={search || statusFilter !== "all" ? <PrimaryButton title="Clear filters" variant="secondary" onPress={() => { setSearch(""); setStatusFilter("all"); }} /> : <PrimaryButton title="Add brand" onPress={() => openEditor(null)} />}
            icon="pricetag-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={visible} title={editing ? "Edit brand" : "Add brand"} onClose={() => setVisible(false)}>
        <View style={{ gap: 9 }}>
          <InputField label="Brand name" value={name} onChangeText={setName} placeholder="Acme" />
          <InputField label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} />
          <PrimaryButton
            title={saving ? "Saving..." : "Save brand"}
            loading={saving}
            onPress={async () => {
              if (!business?.id) return;
              if (!name.trim()) {
                Alert.alert("Missing name", "Enter a brand name.");
                return;
              }
              setSaving(true);
              try {
                if (editing) {
                  await updateBrand(editing.id, { name: name.trim(), description: description.trim() || null });
                } else {
                  await addBrand({ businessId: business.id, name: name.trim(), description: description.trim() || null });
                }
                setVisible(false);
                setEditing(null);
                setName("");
                setDescription("");
                await loadCatalog();
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save brand");
              } finally {
                setSaving(false);
              }
            }}
          />
        </View>
      </SimpleModal>
    </Screen>
  );
}

function confirmMobile(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm archive", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Archive", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}
