import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Brand } from "@shared";
import { useNavigation } from "@react-navigation/native";
import { AppScrollView, Badge, Card, EmptyState, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { archiveBrand, updateBrand } from "@/services/apiClient";
import { Ionicons } from "@expo/vector-icons";

export function BrandsScreen() {
  const navigation = useNavigation<any>();
  const business = useAppStore((state) => state.business);
  const brands = useAppStore((state) => state.brands);
  const addBrand = useAppStore((state) => state.addBrand);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [search, setSearch] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<Brand | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return brands.filter((brand) => [brand.name, brand.description ?? ""].join(" ").toLowerCase().includes(query));
  }, [brands, search]);

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
      <AppScrollView refreshing={refreshing} onRefresh={refresh}>
        <Card>
          <InputField label="Search brands" value={search} onChangeText={setSearch} placeholder="Brand name or note" />
        </Card>
        <Card>
          <PrimaryButton title="Add brand" onPress={() => openEditor(null)} />
        </Card>
        {filtered.length ? (
          filtered.map((brand) => (
            <Card key={brand.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{brand.name}</Text>
                  <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{brand.description ?? "No description"}</Text>
                </View>
                <Badge label={brand.isActive ? "Active" : "Archived"} tone={brand.isActive ? "success" : "warning"} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Edit" variant="secondary" onPress={() => openEditor(brand)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Archive"
                    variant="danger"
                    onPress={async () => {
                      const confirmed = await confirmMobile(`Archive ${brand.name}?`);
                      if (!confirmed) return;
                      await archiveBrand(brand.id);
                      await loadCatalog();
                    }}
                  />
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            title={search ? "No matching brands" : "No brands yet"}
            subtitle={search ? "Try a different brand name or clear the search." : "Create a brand to organize inventory by supplier line."}
            action={<PrimaryButton title="Add brand" onPress={() => openEditor(null)} />}
            icon="pricetag-outline"
          />
        )}
      </AppScrollView>

      <SimpleModal visible={visible} title={editing ? "Edit brand" : "Add brand"} onClose={() => setVisible(false)}>
        <View style={{ gap: 12 }}>
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
