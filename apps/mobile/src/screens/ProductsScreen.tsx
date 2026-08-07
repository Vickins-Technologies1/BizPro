import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productCreateSchema, BUSINESS_TYPES } from "@shared";
import { AppScrollView, Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useNavigation } from "@react-navigation/native";
import { EmptyState } from "@/components/Primitives";
import { hasPermission } from "@shared";
import { deleteProduct } from "@/services/apiClient";

type FormValues = z.infer<typeof productCreateSchema>;

export function ProductsScreen() {
  const navigation = useNavigation<any>();
  const products = useAppStore((state) => state.products);
  const categories = useAppStore((state) => state.categories);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
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
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    mode: "onTouched",
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
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageProducts = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, filtered]);

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategoryId]);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  async function refreshCatalog() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadCatalog();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    if (deletingProductId) return;
    const confirmed = await confirmMobile(`Delete ${name}? This removes it from the active catalog.`);
    if (!confirmed) return;

    setDeletingProductId(id);
    try {
      await deleteProduct(id);
      await loadCatalog();
      Alert.alert("Product deleted", `${name} was removed from the catalog.`);
    } catch (error) {
      Alert.alert("Delete failed", error instanceof Error ? error.message : "Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  }

  React.useEffect(() => {
    if (visible) {
      setValue("categoryId", selectedCategoryId);
    }
  }, [visible, selectedCategoryId, setValue]);
  const currentCategoryId = watch("categoryId");
  const canManageInventory = hasPermission(user, "manageInventory");

  if (!canManageInventory) {
    return (
      <Screen>
        <GradientHeader title="Catalog" subtitle="Products, stock, and pricing" />
        <View style={{ padding: 16 }}>
          <EmptyState
            title="Catalog access restricted"
            subtitle="This account can only view sales work. Ask an owner or manager for inventory access."
            action={<PrimaryButton title="Go back" onPress={() => navigation.goBack()} />}
            icon="cube-outline"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <GradientHeader
        title="Catalog"
        subtitle={`${business?.businessType ?? BUSINESS_TYPES[0]} products, stock, and pricing`}
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
      <AppScrollView refreshing={refreshing} onRefresh={refreshCatalog}>
        <Card>
          <InputField label="Search products" value={search} onChangeText={setSearch} placeholder="Search name or SKU" />
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Filter by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => setSelectedCategoryId(null)}>
              <Badge label="All products" tone={selectedCategoryId === null ? "success" : "primary"} />
            </Pressable>
            {categories.map((category) => (
              <Pressable key={category.id} onPress={() => setSelectedCategoryId(category.id)}>
                <Badge label={category.name} tone={selectedCategoryId === category.id ? "success" : "primary"} />
              </Pressable>
            ))}
          </ScrollView>
        </Card>
        {filtered.length ? (
          <>
            <View style={{ gap: 10 }}>
              {pageProducts.map((product) => {
                const categoryName = categories.find((category) => category.id === product.categoryId)?.name ?? "Uncategorized";
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => navigation.navigate("ProductDetail", { productId: product.id })}
                    style={({ pressed }) => [pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] }]}
                  >
                    <Card style={{ gap: 10, padding: 12 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                            {product.name}
                          </Text>
                          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                            {product.sku ?? "No SKU"} • {product.unit} • {categoryName}
                          </Text>
                        </View>
                        <Badge label={product.isActive ? "Active" : "Archived"} tone={product.isActive ? "success" : "warning"} />
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>Stock {product.stockOnHand}</Text>
                        <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>Low {product.lowStockThreshold}</Text>
                        <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>View details</Text>
                      </View>
                      <Text style={{ color: tokens.colors.primaryStrong, fontSize: 15, fontWeight: "800" }}>
                        {formatMoney(product.sellingPrice, business?.currency)}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        <Pressable
                          onPress={(event) => {
                            event?.stopPropagation?.();
                            setRestockProductId(product.id);
                            setRestockQty("0");
                            setRestockCost(String(product.buyingPrice));
                            setRestockVisible(true);
                          }}
                        >
                          <Badge label="Restock" tone="success" />
                        </Pressable>
                        <Pressable
                          onPress={(event) => {
                            event?.stopPropagation?.();
                            void handleDeleteProduct(product.id, product.name);
                          }}
                        >
                          <Badge label={deletingProductId === product.id ? "Deleting..." : "Delete"} tone="danger" />
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
            {totalPages > 1 ? (
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Text style={{ color: tokens.colors.textMuted, fontSize: 12 }}>
                    Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filtered.length, currentPage * pageSize)} of {filtered.length}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Previous"
                      variant="secondary"
                      disabled={currentPage === 1}
                      onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Next"
                      variant="secondary"
                      disabled={currentPage === totalPages}
                      onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    />
                  </View>
                </View>
              </Card>
            ) : null}
          </>
        ) : (
          <EmptyState
            title={search ? "No matching products" : "No products yet"}
            subtitle={search ? "Try a different product name or SKU, or clear the search to see everything." : "Create your first product to start tracking stock and sales."}
            action={<PrimaryButton title="Add product" onPress={() => setVisible(true)} />}
            icon="cube-outline"
          />
        )}
      </AppScrollView>
      <SimpleModal visible={visible} title="Add product" onClose={() => setVisible(false)}>
        <AppScrollView contentContainerStyle={{ gap: 12 }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <InputField label="Product name" value={value} onChangeText={onChange} error={errors.name?.message} helperText="Use the name staff will recognize quickly." />
            )}
          />
          <Controller
            control={control}
            name="sku"
            render={({ field: { value, onChange } }) => <InputField label="SKU" value={(value as string) ?? ""} onChangeText={onChange} helperText="Optional shelf or lookup code." />}
          />
          <Controller
            control={control}
            name="barcode"
            render={({ field: { value, onChange } }) => <InputField label="Barcode" value={(value as string) ?? ""} onChangeText={onChange} helperText="Optional barcode for scanner input." />}
          />
          <Controller
            control={control}
            name="unit"
            render={({ field: { value, onChange } }) => (
              <InputField label="Unit" value={value} onChangeText={onChange} error={errors.unit?.message} helperText="Examples: pcs, kg, box, or bottle." />
            )}
          />
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
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="buyingPrice"
                render={({ field: { value, onChange } }) => (
                  <InputField
                    label="Buying price"
                    value={String(value)}
                    onChangeText={(text) => onChange(Number(text || 0))}
                    keyboardType="decimal-pad"
                    error={errors.buyingPrice?.message}
                    helperText="How much you paid for one unit."
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="sellingPrice"
                render={({ field: { value, onChange } }) => (
                  <InputField
                    label="Selling price"
                    value={String(value)}
                    onChangeText={(text) => onChange(Number(text || 0))}
                    keyboardType="decimal-pad"
                    error={errors.sellingPrice?.message}
                    helperText="What customers pay for one unit."
                  />
                )}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="stockOnHand"
                render={({ field: { value, onChange } }) => (
                  <InputField
                    label="Opening stock"
                    value={String(value)}
                    onChangeText={(text) => onChange(Number(text || 0))}
                    keyboardType="decimal-pad"
                    error={errors.stockOnHand?.message}
                    helperText="Start with the stock you already have."
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="lowStockThreshold"
                render={({ field: { value, onChange } }) => (
                  <InputField
                    label="Low stock"
                    value={String(value)}
                    onChangeText={(text) => onChange(Number(text || 0))}
                    keyboardType="decimal-pad"
                    error={errors.lowStockThreshold?.message}
                    helperText="You will be warned when stock falls below this level."
                  />
                )}
              />
            </View>
          </View>
          <PrimaryButton
            title="Save product"
            onPress={handleSubmit(async (values) => {
              setSavingProduct(true);
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
                reset({ businessId: business?.id ?? "", categoryId: null, name: "", sku: "", barcode: "", unit: "pcs", buyingPrice: 0, sellingPrice: 0, stockOnHand: 0, lowStockThreshold: 5, isActive: true });
                setVisible(false);
                Alert.alert("Product created", "Product created successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save product");
              } finally {
                setSavingProduct(false);
              }
            })}
            loading={savingProduct}
          />
        </AppScrollView>
      </SimpleModal>
      <SimpleModal visible={categoryVisible} title="Add category" onClose={() => setCategoryVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Category name" value={categoryName} onChangeText={setCategoryName} placeholder="Fast Moving" helperText="Use a simple name like Drinks or Cleaning." />
          <PrimaryButton
            title="Save category"
            onPress={async () => {
              setSavingCategory(true);
              try {
                if (!categoryName.trim()) {
                  Alert.alert("Missing name", "Enter a category name.");
                  return;
                }
                await addCategory({ businessId: business?.id ?? "", name: categoryName.trim(), color: null, sortOrder: categories.length + 1 });
                setCategoryName("");
                setCategoryVisible(false);
                Alert.alert("Category created", "Category created successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save category");
              } finally {
                setSavingCategory(false);
              }
            }}
            loading={savingCategory}
          />
        </View>
      </SimpleModal>
      <SimpleModal visible={restockVisible} title="Add stock" onClose={() => setRestockVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Quantity to add" value={restockQty} onChangeText={setRestockQty} keyboardType="decimal-pad" helperText="Enter how many units are being added." />
          <InputField label="Unit cost" value={restockCost} onChangeText={setRestockCost} keyboardType="decimal-pad" helperText="Use the cost paid for one unit." />
          <PrimaryButton
            title="Save stock"
            onPress={async () => {
              setSavingStock(true);
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
                Alert.alert("Stock updated", "Inventory updated successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to add stock");
              } finally {
                setSavingStock(false);
              }
            }}
            loading={savingStock}
          />
        </View>
      </SimpleModal>
    </Screen>
  );
}

function confirmMobile(message: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert("Confirm delete", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) }
    ]);
  });
}
