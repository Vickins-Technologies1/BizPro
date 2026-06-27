import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productCreateSchema, BUSINESS_TYPES } from "@shared";
import { Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useNavigation } from "@react-navigation/native";

type FormValues = z.infer<typeof productCreateSchema>;

export function ProductsScreen() {
  const navigation = useNavigation<any>();
  const products = useAppStore((state) => state.products);
  const categories = useAppStore((state) => state.categories);
  const business = useAppStore((state) => state.business);
  const addCategory = useAppStore((state) => state.addCategory);
  const addProduct = useAppStore((state) => state.addProduct);
  const adjustStock = useAppStore((state) => state.adjustStock);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(false);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [restockVisible, setRestockVisible] = useState(false);
  const [restockProductId, setRestockProductId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState("0");
  const [restockCost, setRestockCost] = useState("0");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const { control, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      businessId: business?.id ?? "",
      categoryId: null,
      name: "",
      sku: "",
      barcode: "",
      unit: "pcs",
      buyingPrice: 0,
      sellingPrice: 0,
      stockOnHand: 0,
      lowStockThreshold: 5,
      isActive: true
    }
  });

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (selectedCategoryId ? product.categoryId === selectedCategoryId : true) &&
          (product.name.toLowerCase().includes(search.toLowerCase()) || (product.sku ?? "").toLowerCase().includes(search.toLowerCase()))
      ),
    [products, search, selectedCategoryId]
  );

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  React.useEffect(() => {
    if (visible) {
      setValue("categoryId", selectedCategoryId);
    }
  }, [visible, selectedCategoryId, setValue]);
  const currentCategoryId = watch("categoryId");

  return (
    <Screen>
      <GradientHeader
        title="Catalog"
        subtitle={`${business?.businessType ?? BUSINESS_TYPES[0]} inventory and product control`}
        right={
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable onPress={() => setCategoryVisible(true)}>
              <Ionicons name="albums-outline" size={26} color={tokens.colors.text} />
            </Pressable>
            <Pressable onPress={() => setVisible(true)}>
              <Ionicons name="add-circle-outline" size={28} color={tokens.colors.text} />
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <InputField label="Search products" value={search} onChangeText={setSearch} placeholder="Search name or SKU" />
        </Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable onPress={() => setSelectedCategoryId(null)}>
            <Badge label="All" tone={selectedCategoryId === null ? "success" : "primary"} />
          </Pressable>
          {categories.map((category) => (
            <Pressable key={category.id} onPress={() => setSelectedCategoryId(category.id)}>
              <Badge label={category.name} tone={selectedCategoryId === category.id ? "success" : "primary"} />
            </Pressable>
          ))}
        </ScrollView>
        {filtered.map((product) => (
          <Card key={product.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: tokens.colors.text, fontSize: 17, fontWeight: "800" }}>{product.name}</Text>
                <Text style={{ color: tokens.colors.textSecondary }}>
                  {product.sku ?? "No SKU"} • {product.unit} • {categories.find((category) => category.id === product.categoryId)?.name ?? "Uncategorized"}
                </Text>
              </View>
              <Badge label={product.isActive ? "active" : "archived"} tone={product.isActive ? "success" : "warning"} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tokens.colors.textSecondary }}>Stock: {product.stockOnHand}</Text>
              <Text style={{ color: tokens.colors.textSecondary }}>Low: {product.lowStockThreshold}</Text>
            </View>
            <Text style={{ color: tokens.colors.primaryStrong, fontSize: 16, fontWeight: "800" }}>{formatMoney(product.sellingPrice, business?.currency)}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => navigation.navigate("ProductDetail", { productId: product.id })}>
                <Badge label="view details" tone="primary" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setRestockProductId(product.id);
                  setRestockQty("0");
                  setRestockCost(String(product.buyingPrice));
                  setRestockVisible(true);
                }}
              >
                <Badge label="restock" tone="success" />
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
      <SimpleModal visible={visible} title="Add product" onClose={() => setVisible(false)}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller control={control} name="name" render={({ field: { value, onChange } }) => <InputField label="Product name" value={value} onChangeText={onChange} />} />
          <Controller control={control} name="sku" render={({ field: { value, onChange } }) => <InputField label="SKU" value={(value as string) ?? ""} onChangeText={onChange} />} />
          <Controller control={control} name="barcode" render={({ field: { value, onChange } }) => <InputField label="Barcode" value={(value as string) ?? ""} onChangeText={onChange} />} />
          <Controller control={control} name="unit" render={({ field: { value, onChange } }) => <InputField label="Unit" value={value} onChangeText={onChange} />} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable onPress={() => setValue("categoryId", null)}>
              <Badge label="No category" tone={!currentCategoryId ? "success" : "primary"} />
            </Pressable>
            {categories.map((category) => (
              <Pressable key={category.id} onPress={() => setValue("categoryId", category.id)}>
                <Badge label={category.name} tone={currentCategoryId === category.id ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <Controller control={control} name="buyingPrice" render={({ field: { value, onChange } }) => <InputField label="Buying price" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
          <Controller control={control} name="sellingPrice" render={({ field: { value, onChange } }) => <InputField label="Selling price" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
          <Controller control={control} name="stockOnHand" render={({ field: { value, onChange } }) => <InputField label="Opening stock" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
          <Controller control={control} name="lowStockThreshold" render={({ field: { value, onChange } }) => <InputField label="Low stock threshold" value={String(value)} onChangeText={(text) => onChange(Number(text || 0))} keyboardType="decimal-pad" />} />
          <PrimaryButton
            title="Save product"
            onPress={handleSubmit(async (values) => {
              try {
                await addProduct({
                  businessId: business?.id ?? "",
                  categoryId: values.categoryId ?? null,
                  name: values.name,
                  sku: values.sku ? values.sku : null,
                  barcode: values.barcode ? values.barcode : null,
                  unit: values.unit,
                  buyingPrice: values.buyingPrice,
                  sellingPrice: values.sellingPrice,
                  stockOnHand: values.stockOnHand,
                  lowStockThreshold: values.lowStockThreshold,
                  isActive: values.isActive
                });
                await loadCatalog();
                reset({ businessId: business?.id ?? "", categoryId: null, name: "", sku: "", barcode: "", unit: "pcs", buyingPrice: 0, sellingPrice: 0, stockOnHand: 0, lowStockThreshold: 5, isActive: true });
                setVisible(false);
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save product");
              }
            })}
          />
        </ScrollView>
      </SimpleModal>
      <SimpleModal visible={categoryVisible} title="Add category" onClose={() => setCategoryVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Category name" value={categoryName} onChangeText={setCategoryName} placeholder="Fast Moving" />
          <PrimaryButton
            title="Save category"
            onPress={async () => {
              try {
                if (!categoryName.trim()) {
                  Alert.alert("Missing name", "Enter a category name.");
                  return;
                }
                await addCategory({ businessId: business?.id ?? "", name: categoryName.trim(), color: null, sortOrder: categories.length + 1 });
                await loadCatalog();
                setCategoryName("");
                setCategoryVisible(false);
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save category");
              }
            }}
          />
        </View>
      </SimpleModal>
      <SimpleModal visible={restockVisible} title="Add stock" onClose={() => setRestockVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Quantity to add" value={restockQty} onChangeText={setRestockQty} keyboardType="decimal-pad" />
          <InputField label="Unit cost" value={restockCost} onChangeText={setRestockCost} keyboardType="decimal-pad" />
          <PrimaryButton
            title="Save stock"
            onPress={async () => {
              try {
                if (!restockProductId) {
                  Alert.alert("Missing product", "Select a product first.");
                  return;
                }
                const qty = Number(restockQty || 0);
                const cost = Number(restockCost || 0);
                if (qty <= 0) {
                  Alert.alert("Invalid quantity", "Enter a quantity greater than zero.");
                  return;
                }
                await adjustStock({ productId: restockProductId, quantityDelta: qty, unitCost: cost, note: "Manual restock" });
                setRestockVisible(false);
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to add stock");
              }
            }}
          />
        </View>
      </SimpleModal>
    </Screen>
  );
}
