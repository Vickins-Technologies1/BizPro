import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { INVENTORY_UNITS, productCreateSchema, resolveIndustryModule } from "@shared";
import { AppScrollView, Card, GradientHeader, InputField, PrimaryButton, Screen, SimpleModal, Badge, Tag } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { formatMoney } from "@/utils/money";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { useNavigation } from "@react-navigation/native";
import { EmptyState } from "@/components/Primitives";
import { hasPermission } from "@shared";
import { deleteProduct } from "@/services/apiClient";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

type FormValues = z.infer<typeof productCreateSchema>;

export function ProductsScreen() {
  const navigation = useNavigation<any>();
  const products = useAppStore((state) => state.products);
  const categories = useAppStore((state) => state.categories);
  const brands = useAppStore((state) => state.brands);
  const suppliers = useAppStore((state) => state.suppliers);
  const business = useAppStore((state) => state.business);
  const user = useAppStore((state) => state.user);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const addCategory = useAppStore((state) => state.addCategory);
  const addBrand = useAppStore((state) => state.addBrand);
  const addProduct = useAppStore((state) => state.addProduct);
  const addSupplier = useAppStore((state) => state.addSupplier);
  const adjustStock = useAppStore((state) => state.adjustStock);
  const loadCatalog = useAppStore((state) => state.loadCatalog);
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(false);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [brandVisible, setBrandVisible] = useState(false);
  const [supplierVisible, setSupplierVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [restockVisible, setRestockVisible] = useState(false);
  const [restockProductId, setRestockProductId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState("0");
  const [restockCost, setRestockCost] = useState("0");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [importText, setImportText] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const deferredSearch = React.useDeferredValue(search);
  const industry = resolveIndustryModule({ industryKey: business?.industryKey, businessType: business?.businessType });

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
      brandId: null,
      supplierId: null,
      name: "",
      sku: "",
      barcode: "",
      batchNumber: "",
      expiryDate: null,
      serialNumber: "",
      unit: "pcs",
      buyingPrice: 0,
      sellingPrice: 0,
      stockOnHand: 0,
      lowStockThreshold: 5,
      isActive: true
    }
  });

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const brandMap = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);
  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);

  const filtered = useMemo(
    () =>
      products.filter(
        (product) => {
          const brandName = brandMap.get(product.brandId ?? "")?.name ?? "";
          const supplierName = supplierMap.get(product.supplierId ?? "")?.name ?? "";
          const categoryName = categoryMap.get(product.categoryId ?? "")?.name ?? "";
          const searchSpace = [product.name, product.sku, product.barcode, product.batchNumber, product.serialNumber, brandName, supplierName, categoryName]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(deferredSearch.toLowerCase()));
          return (
          (selectedCategoryId ? product.categoryId === selectedCategoryId : true) &&
          (selectedBrandId ? product.brandId === selectedBrandId : true) &&
          (selectedSupplierId ? product.supplierId === selectedSupplierId : true) &&
          searchSpace
          );
        }
      ),
    [products, deferredSearch, selectedCategoryId, selectedBrandId, selectedSupplierId, categoryMap, brandMap, supplierMap]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageProducts = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, filtered]);

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, selectedCategoryId, selectedBrandId, selectedSupplierId]);

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

  function csvEscape(value: string | number | null | undefined) {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function splitCsvLine(line: string) {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === "," && !quoted) {
        cells.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  }

  function parseProductsCsv(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      return [];
    }
    const headerLine = lines[0];
    if (!headerLine) {
      return [];
    }
    const headers = splitCsvLine(headerLine).map((header) => header.toLowerCase());
    return lines.slice(1).map((line) => {
      const values = splitCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    });
  }

  async function exportProductsCsv() {
    if (!products.length) {
      Alert.alert("Nothing to export", "Create products first, then export the catalog as CSV.");
      return;
    }
    const headers = [
      "name",
      "sku",
      "barcode",
      "brand",
      "supplier",
      "category",
      "unit",
      "batchNumber",
      "expiryDate",
      "serialNumber",
      "buyingPrice",
      "sellingPrice",
      "stockOnHand",
      "lowStockThreshold",
      "isActive"
    ];
    const csvRows = [
      headers.join(","),
      ...products.map((product) => {
        const categoryName = categoryMap.get(product.categoryId ?? "")?.name ?? "";
        const brandName = brandMap.get(product.brandId ?? "")?.name ?? "";
        const supplierName = supplierMap.get(product.supplierId ?? "")?.name ?? "";
        return [
          product.name,
          product.sku ?? "",
          product.barcode ?? "",
          brandName,
          supplierName,
          categoryName,
          product.unit,
          product.batchNumber ?? "",
          product.expiryDate ?? "",
          product.serialNumber ?? "",
          product.buyingPrice,
          product.sellingPrice,
          product.stockOnHand,
          product.lowStockThreshold,
          product.isActive ? "true" : "false"
        ]
          .map(csvEscape)
          .join(",");
      })
    ];
    const csv = csvRows.join("\n");
    const fileName = `biz-pro-products-${Date.now()}.csv`;
    const filePath = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ""}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, { mimeType: "text/csv", dialogTitle: "Export products" });
      return;
    }
    await Clipboard.setStringAsync(csv);
    Alert.alert("Export ready", "CSV was copied to the clipboard.");
  }

  async function importProductsCsv() {
    const rows = parseProductsCsv(importText);
    if (!rows.length) {
      Alert.alert("No rows found", "Paste a CSV file with a header row before importing.");
      return;
    }
    setImportingProducts(true);
    try {
      let imported = 0;
      for (const row of rows) {
        const name = row.name?.trim();
        if (!name) {
          continue;
        }
        const categoryId = categories.find((category) => category.name.toLowerCase() === (row.category ?? "").trim().toLowerCase())?.id ?? null;
        const brandId = brands.find((brand) => brand.name.toLowerCase() === (row.brand ?? "").trim().toLowerCase())?.id ?? null;
        const supplierId = suppliers.find((supplier) => supplier.name.toLowerCase() === (row.supplier ?? "").trim().toLowerCase())?.id ?? null;
        await addProduct({
          businessId: business?.id ?? "",
          categoryId,
          brandId,
          supplierId,
          name,
          sku: row.sku?.trim() ? row.sku.trim() : null,
          barcode: row.barcode?.trim() ? row.barcode.trim() : null,
          batchNumber: row.batchnumber?.trim() ? row.batchnumber.trim() : null,
          expiryDate: row.expirydate?.trim() ? row.expirydate.trim() : null,
          serialNumber: row.serialnumber?.trim() ? row.serialnumber.trim() : null,
          unit: row.unit?.trim() || "pcs",
          buyingPrice: Number(row.buyingprice ?? 0),
          sellingPrice: Number(row.sellingprice ?? 0),
          stockOnHand: Number(row.stockonhand ?? 0),
          lowStockThreshold: Number(row.lowstockthreshold ?? 5),
          isActive: (row.isactive ?? "true").trim().toLowerCase() !== "false"
        });
        imported += 1;
      }
      setImportVisible(false);
      setImportText("");
      Alert.alert("Import complete", `Imported ${imported} product${imported === 1 ? "" : "s"} successfully.`);
    } catch (error) {
      Alert.alert("Import failed", error instanceof Error ? error.message : "Failed to import products");
    } finally {
      setImportingProducts(false);
    }
  }

  async function handleDeleteProduct(id: string, name: string) {
    if (deletingProductId) return;
    const confirmed = await confirmMobile(`Delete ${name}? This removes it from the active catalog.`);
    if (!confirmed) return;

    setDeletingProductId(id);
    try {
      await deleteProduct(id, selectedBranchId);
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
      setValue("brandId", selectedBrandId);
      setValue("supplierId", selectedSupplierId);
    }
  }, [visible, selectedBrandId, selectedCategoryId, selectedSupplierId, setValue]);
  const currentCategoryId = watch("categoryId");
  const currentBrandId = watch("brandId");
  const currentSupplierId = watch("supplierId");
  const currentUnit = watch("unit");
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
        subtitle={`${industry.label} products, stock, and pricing`}
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
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Inventory tools</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Add brand" variant="secondary" onPress={() => setBrandVisible(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Add supplier" variant="secondary" onPress={() => setSupplierVisible(true)} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Import CSV"
                variant="secondary"
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  setImportText(text);
                  setImportVisible(true);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Export CSV" variant="secondary" onPress={() => void exportProductsCsv()} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Brands" variant="secondary" onPress={() => navigation.navigate("Brands")} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Suppliers" variant="secondary" onPress={() => navigation.navigate("Suppliers")} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Purchase orders" variant="secondary" onPress={() => navigation.navigate("PurchaseOrders")} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Stock transfers" variant="secondary" onPress={() => navigation.navigate("StockTransfers")} />
            </View>
          </View>
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Filter by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Tag label="All products" tone="primary" selected={selectedCategoryId === null} onPress={() => setSelectedCategoryId(null)} />
            {categories.map((category) => (
              <Tag
                key={category.id}
                label={category.name}
                tone="primary"
                selected={selectedCategoryId === category.id}
                onPress={() => setSelectedCategoryId(category.id)}
              />
            ))}
          </ScrollView>
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Filter by brand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Tag label="All brands" tone="primary" selected={selectedBrandId === null} onPress={() => setSelectedBrandId(null)} />
            {brands.map((brand) => (
              <Tag key={brand.id} label={brand.name} tone="primary" selected={selectedBrandId === brand.id} onPress={() => setSelectedBrandId(brand.id)} />
            ))}
          </ScrollView>
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Filter by supplier</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Tag label="All suppliers" tone="primary" selected={selectedSupplierId === null} onPress={() => setSelectedSupplierId(null)} />
            {suppliers.map((supplier) => (
              <Tag key={supplier.id} label={supplier.name} tone="primary" selected={selectedSupplierId === supplier.id} onPress={() => setSelectedSupplierId(supplier.id)} />
            ))}
          </ScrollView>
        </Card>
        {filtered.length ? (
          <>
            <View style={{ gap: 10 }}>
              {pageProducts.map((product) => {
                const categoryName = categories.find((category) => category.id === product.categoryId)?.name ?? "Uncategorized";
                const brandName = brands.find((brand) => brand.id === product.brandId)?.name ?? "No brand";
                const supplierName = suppliers.find((supplier) => supplier.id === product.supplierId)?.name ?? "No supplier";
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
                          <Text style={{ color: tokens.colors.textMuted, fontSize: 11, lineHeight: 15 }} numberOfLines={1}>
                            {brandName} • {supplierName}
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
                      {product.batchNumber || product.expiryDate || product.serialNumber ? (
                        <Text style={{ color: tokens.colors.textMuted, fontSize: 11, lineHeight: 15 }}>
                          {[product.batchNumber ? `Batch ${product.batchNumber}` : null, product.expiryDate ? `Expiry ${product.expiryDate}` : null, product.serialNumber ? `Serial ${product.serialNumber}` : null]
                            .filter(Boolean)
                            .join(" • ")}
                        </Text>
                      ) : null}
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
          <View style={{ gap: 8 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "700" }}>Quick units</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {INVENTORY_UNITS.map((unit) => (
                <Tag key={unit} label={unit} tone="primary" selected={currentUnit === unit} onPress={() => setValue("unit", unit)} />
              ))}
            </ScrollView>
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "700" }}>Brand</Text>
              <Pressable onPress={() => setBrandVisible(true)}>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "700" }}>Add brand</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Tag label="No brand" tone="primary" selected={!currentBrandId} onPress={() => setValue("brandId", null)} />
              {brands.map((brand) => (
                <Tag key={brand.id} label={brand.name} tone="primary" selected={currentBrandId === brand.id} onPress={() => setValue("brandId", brand.id)} />
              ))}
            </ScrollView>
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "700" }}>Supplier</Text>
              <Pressable onPress={() => setSupplierVisible(true)}>
                <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "700" }}>Add supplier</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Tag label="No supplier" tone="primary" selected={!currentSupplierId} onPress={() => setValue("supplierId", null)} />
              {suppliers.map((supplier) => (
                <Tag key={supplier.id} label={supplier.name} tone="primary" selected={currentSupplierId === supplier.id} onPress={() => setValue("supplierId", supplier.id)} />
              ))}
            </ScrollView>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="batchNumber"
                render={({ field: { value, onChange } }) => (
                  <InputField label="Batch number" value={(value as string) ?? ""} onChangeText={onChange} helperText="Use for grouped stock or production runs." />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="expiryDate"
                render={({ field: { value, onChange } }) => (
                  <InputField label="Expiry date" value={(value as string) ?? ""} onChangeText={onChange} placeholder="YYYY-MM-DD" helperText="Leave blank if the item does not expire." />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name="serialNumber"
            render={({ field: { value, onChange } }) => <InputField label="Serial number" value={(value as string) ?? ""} onChangeText={onChange} helperText="Optional serialized item tracking." />}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Tag label="No category" tone="primary" selected={!currentCategoryId} onPress={() => setValue("categoryId", null)} />
            {categories.map((category) => (
              <Tag
                key={category.id}
                label={category.name}
                tone="primary"
                selected={currentCategoryId === category.id}
                onPress={() => setValue("categoryId", category.id)}
              />
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
                  brandId: values.brandId ?? null,
                  supplierId: values.supplierId ?? null,
                  name: values.name,
                  sku: values.sku ? values.sku : null,
                  barcode: values.barcode ? values.barcode : null,
                  batchNumber: values.batchNumber ? values.batchNumber : null,
                  expiryDate: values.expiryDate ?? null,
                  serialNumber: values.serialNumber ? values.serialNumber : null,
                  unit: values.unit,
                  buyingPrice: values.buyingPrice,
                  sellingPrice: values.sellingPrice,
                  stockOnHand: values.stockOnHand,
                  lowStockThreshold: values.lowStockThreshold,
                  isActive: values.isActive
                });
                reset({
                  businessId: business?.id ?? "",
                  categoryId: null,
                  brandId: null,
                  supplierId: null,
                  name: "",
                  sku: "",
                  barcode: "",
                  batchNumber: "",
                  expiryDate: null,
                  serialNumber: "",
                  unit: "pcs",
                  buyingPrice: 0,
                  sellingPrice: 0,
                  stockOnHand: 0,
                  lowStockThreshold: 5,
                  isActive: true
                });
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
      <SimpleModal visible={brandVisible} title="Add brand" onClose={() => setBrandVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Brand name" value={brandName} onChangeText={setBrandName} placeholder="Acme" helperText="Use the manufacturer's or product line name." />
          <InputField
            label="Description"
            value={brandDescription}
            onChangeText={setBrandDescription}
            helperText="Optional note about the brand."
            multiline
            numberOfLines={3}
          />
          <PrimaryButton
            title="Save brand"
            onPress={async () => {
              setSavingBrand(true);
              try {
                if (!brandName.trim()) {
                  Alert.alert("Missing name", "Enter a brand name.");
                  return;
                }
                await addBrand({ businessId: business?.id ?? "", name: brandName.trim(), description: brandDescription.trim() || null });
                setBrandName("");
                setBrandDescription("");
                setBrandVisible(false);
                Alert.alert("Brand created", "Brand created successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save brand");
              } finally {
                setSavingBrand(false);
              }
            }}
            loading={savingBrand}
          />
        </View>
      </SimpleModal>
      <SimpleModal visible={supplierVisible} title="Add supplier" onClose={() => setSupplierVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField label="Supplier name" value={supplierName} onChangeText={setSupplierName} placeholder="Global Supplies Ltd" helperText="Use the vendor or wholesaler name." />
          <InputField label="Supplier code" value={supplierCode} onChangeText={setSupplierCode} helperText="Optional internal supplier code." />
          <InputField label="Contact name" value={supplierContact} onChangeText={setSupplierContact} helperText="Who staff should call or email." />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <InputField label="Phone" value={supplierPhone} onChangeText={setSupplierPhone} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Email" value={supplierEmail} onChangeText={setSupplierEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <InputField label="Notes" value={supplierNotes} onChangeText={setSupplierNotes} helperText="Optional delivery or account notes." multiline numberOfLines={3} />
          <PrimaryButton
            title="Save supplier"
            onPress={async () => {
              setSavingSupplier(true);
              try {
                if (!supplierName.trim()) {
                  Alert.alert("Missing name", "Enter a supplier name.");
                  return;
                }
                await addSupplier({
                  businessId: business?.id ?? "",
                  code: supplierCode.trim() || null,
                  name: supplierName.trim(),
                  phone: supplierPhone.trim() || null,
                  email: supplierEmail.trim() || null,
                  contactName: supplierContact.trim() || null,
                  notes: supplierNotes.trim() || null
                });
                setSupplierName("");
                setSupplierCode("");
                setSupplierEmail("");
                setSupplierPhone("");
                setSupplierContact("");
                setSupplierNotes("");
                setSupplierVisible(false);
                Alert.alert("Supplier created", "Supplier created successfully.");
              } catch (error) {
                Alert.alert("Save failed", error instanceof Error ? error.message : "Failed to save supplier");
              } finally {
                setSavingSupplier(false);
              }
            }}
            loading={savingSupplier}
          />
        </View>
      </SimpleModal>
      <SimpleModal visible={importVisible} title="Import products" onClose={() => setImportVisible(false)}>
        <View style={{ gap: 12 }}>
          <InputField
            label="CSV content"
            value={importText}
            onChangeText={setImportText}
            helperText="Paste CSV with headers like name,sku,barcode,brand,supplier,category,unit,buyingPrice,sellingPrice."
            multiline
            numberOfLines={10}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title="Paste clipboard"
                variant="secondary"
                onPress={async () => {
                  const text = await Clipboard.getStringAsync();
                  setImportText(text);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Import" onPress={() => void importProductsCsv()} loading={importingProducts} />
            </View>
          </View>
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
