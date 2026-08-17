import { z } from "zod";
export declare const businessSetupSchema: z.ZodObject<{
    ownerName: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
    businessName: z.ZodString;
    industryKey: z.ZodOptional<z.ZodEnum<["retail", "food_beverage", "beauty", "hospitality", "healthcare", "agriculture", "automotive", "services", "professional_services"]>>;
    businessType: z.ZodEnum<["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant", "cafe", "bakery", "bar", "salon", "spa", "hotel", "lodge", "clinic", "pharmacy", "dental_clinic", "farm", "feed_store", "garage", "auto_parts", "service_center", "general_service", "consultancy", "agency", "law_firm", "accounting_firm"]>;
    planTier: z.ZodEnum<["lite", "standard", "pro"]>;
    currency: z.ZodDefault<z.ZodString>;
    branchName: z.ZodString;
    cashierPin: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    ownerName: string;
    phone: string;
    password: string;
    businessName: string;
    businessType: "retail_shop" | "boutique" | "cosmetics" | "accessories" | "wines_spirits" | "hardware" | "agrovet" | "restaurant" | "cafe" | "bakery" | "bar" | "salon" | "spa" | "hotel" | "lodge" | "clinic" | "pharmacy" | "dental_clinic" | "farm" | "feed_store" | "garage" | "auto_parts" | "service_center" | "general_service" | "consultancy" | "agency" | "law_firm" | "accounting_firm";
    planTier: "lite" | "standard" | "pro";
    currency: string;
    branchName: string;
    industryKey?: "retail" | "food_beverage" | "beauty" | "hospitality" | "healthcare" | "agriculture" | "automotive" | "services" | "professional_services" | undefined;
    cashierPin?: string | undefined;
}, {
    ownerName: string;
    phone: string;
    password: string;
    businessName: string;
    businessType: "retail_shop" | "boutique" | "cosmetics" | "accessories" | "wines_spirits" | "hardware" | "agrovet" | "restaurant" | "cafe" | "bakery" | "bar" | "salon" | "spa" | "hotel" | "lodge" | "clinic" | "pharmacy" | "dental_clinic" | "farm" | "feed_store" | "garage" | "auto_parts" | "service_center" | "general_service" | "consultancy" | "agency" | "law_firm" | "accounting_firm";
    planTier: "lite" | "standard" | "pro";
    branchName: string;
    industryKey?: "retail" | "food_beverage" | "beauty" | "hospitality" | "healthcare" | "agriculture" | "automotive" | "services" | "professional_services" | undefined;
    currency?: string | undefined;
    cashierPin?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    identifier: z.ZodString;
    passwordOrPin: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["owner", "manager", "supervisor", "cashier", "waiter", "receptionist", "stylist", "mechanic", "pharmacist"]>>;
}, "strip", z.ZodTypeAny, {
    identifier: string;
    passwordOrPin: string;
    role?: "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "receptionist" | "stylist" | "mechanic" | "pharmacist" | undefined;
}, {
    identifier: string;
    passwordOrPin: string;
    role?: "owner" | "manager" | "supervisor" | "cashier" | "waiter" | "receptionist" | "stylist" | "mechanic" | "pharmacist" | undefined;
}>;
export declare const saleItemSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    costPrice: z.ZodDefault<z.ZodNumber>;
    discount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    discount: number;
}, {
    productId: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number | undefined;
    discount?: number | undefined;
}>;
export declare const saleCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    branchId: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cashierId: z.ZodOptional<z.ZodString>;
    paymentMethod: z.ZodEnum<["cash", "mpesa", "bank", "credit"]>;
    paymentStatus: z.ZodEnum<["paid", "partial", "pending_confirmation", "credit", "unpaid", "reconciled", "manual_mpesa"]>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        costPrice: z.ZodDefault<z.ZodNumber>;
        discount: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        discount: number;
    }, {
        productId: string;
        quantity: number;
        unitPrice: number;
        costPrice?: number | undefined;
        discount?: number | undefined;
    }>, "many">;
    notes: z.ZodOptional<z.ZodString>;
    discountTotal: z.ZodDefault<z.ZodNumber>;
    taxTotal: z.ZodDefault<z.ZodNumber>;
    amountPaid: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    paymentMethod: "cash" | "mpesa" | "bank" | "credit";
    paymentStatus: "credit" | "paid" | "partial" | "pending_confirmation" | "unpaid" | "reconciled" | "manual_mpesa";
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        discount: number;
    }[];
    discountTotal: number;
    taxTotal: number;
    amountPaid: number;
    branchId?: string | undefined;
    customerId?: string | null | undefined;
    cashierId?: string | undefined;
    notes?: string | undefined;
}, {
    businessId: string;
    paymentMethod: "cash" | "mpesa" | "bank" | "credit";
    paymentStatus: "credit" | "paid" | "partial" | "pending_confirmation" | "unpaid" | "reconciled" | "manual_mpesa";
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        costPrice?: number | undefined;
        discount?: number | undefined;
    }[];
    branchId?: string | undefined;
    customerId?: string | null | undefined;
    cashierId?: string | undefined;
    notes?: string | undefined;
    discountTotal?: number | undefined;
    taxTotal?: number | undefined;
    amountPaid?: number | undefined;
}>;
export declare const expenseCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodNumber;
    note: z.ZodString;
    expenseDate: z.ZodString;
    recordedById: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    amount: number;
    note: string;
    expenseDate: string;
    categoryId?: string | null | undefined;
    recordedById?: string | undefined;
}, {
    businessId: string;
    amount: number;
    note: string;
    expenseDate: string;
    categoryId?: string | null | undefined;
    recordedById?: string | undefined;
}>;
export declare const bankAccountCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    bankName: z.ZodString;
    accountName: z.ZodString;
    accountNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    currency: z.ZodString;
    openingBalance: z.ZodDefault<z.ZodNumber>;
    currentBalance: z.ZodDefault<z.ZodNumber>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    currency: string;
    businessId: string;
    bankName: string;
    accountName: string;
    openingBalance: number;
    currentBalance: number;
    isPrimary: boolean;
    notes?: string | null | undefined;
    accountNumber?: string | null | undefined;
}, {
    currency: string;
    businessId: string;
    bankName: string;
    accountName: string;
    notes?: string | null | undefined;
    accountNumber?: string | null | undefined;
    openingBalance?: number | undefined;
    currentBalance?: number | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const pettyCashEntryCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    label: z.ZodString;
    amount: z.ZodNumber;
    direction: z.ZodEnum<["in", "out"]>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    recordedById: z.ZodOptional<z.ZodString>;
    entryDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    amount: number;
    label: string;
    direction: "in" | "out";
    entryDate: string;
    note?: string | null | undefined;
    recordedById?: string | undefined;
    category?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    label: string;
    direction: "in" | "out";
    entryDate: string;
    note?: string | null | undefined;
    recordedById?: string | undefined;
    category?: string | null | undefined;
}>;
export declare const creditNoteCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    reference: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodString;
    relatedSaleId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    creditDate: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "issued", "void"]>>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "issued" | "void";
    businessId: string;
    amount: number;
    reference: string;
    reason: string;
    creditDate: string;
    customerId?: string | null | undefined;
    note?: string | null | undefined;
    relatedSaleId?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    reference: string;
    reason: string;
    creditDate: string;
    status?: "draft" | "issued" | "void" | undefined;
    customerId?: string | null | undefined;
    note?: string | null | undefined;
    relatedSaleId?: string | null | undefined;
}>;
export declare const productCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    brandId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    supplierId: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    name: z.ZodString;
    sku: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    barcode: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    batchNumber: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    expiryDate: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    serialNumber: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null | undefined, unknown>;
    unit: z.ZodString;
    buyingPrice: z.ZodNumber;
    sellingPrice: z.ZodNumber;
    stockOnHand: z.ZodDefault<z.ZodNumber>;
    lowStockThreshold: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    unit: string;
    buyingPrice: number;
    sellingPrice: number;
    stockOnHand: number;
    lowStockThreshold: number;
    isActive: boolean;
    categoryId?: string | null | undefined;
    brandId?: string | null | undefined;
    supplierId?: string | null | undefined;
    sku?: string | null | undefined;
    barcode?: string | null | undefined;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
    serialNumber?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    unit: string;
    buyingPrice: number;
    sellingPrice: number;
    categoryId?: unknown;
    brandId?: unknown;
    supplierId?: unknown;
    sku?: unknown;
    barcode?: unknown;
    batchNumber?: unknown;
    expiryDate?: unknown;
    serialNumber?: unknown;
    stockOnHand?: number | undefined;
    lowStockThreshold?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const brandCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    description?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    description?: string | null | undefined;
}>;
export declare const supplierCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodLiteral<"">]>;
    contactName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    phone?: string | null | undefined;
    code?: string | null | undefined;
    notes?: string | null | undefined;
    categoryId?: string | null | undefined;
    email?: string | null | undefined;
    contactName?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    phone?: string | null | undefined;
    code?: string | null | undefined;
    notes?: string | null | undefined;
    categoryId?: string | null | undefined;
    email?: string | null | undefined;
    contactName?: string | null | undefined;
}>;
export declare const supplierCategoryCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
    description?: string | null | undefined;
    color?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    isActive?: boolean | undefined;
    description?: string | null | undefined;
    color?: string | null | undefined;
    sortOrder?: number | undefined;
}>;
export declare const supplierContactCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodString;
    name: z.ZodString;
    role: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodLiteral<"">]>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    isPrimary: boolean;
    supplierId: string;
    name: string;
    phone?: string | null | undefined;
    role?: string | null | undefined;
    notes?: string | null | undefined;
    email?: string | null | undefined;
}, {
    businessId: string;
    supplierId: string;
    name: string;
    phone?: string | null | undefined;
    role?: string | null | undefined;
    notes?: string | null | undefined;
    isPrimary?: boolean | undefined;
    email?: string | null | undefined;
}>;
export declare const supplierDocumentCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodString;
    title: z.ZodString;
    url: z.ZodString;
    fileName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    documentType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    uploadedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    supplierId: string;
    title: string;
    url: string;
    note?: string | null | undefined;
    fileName?: string | null | undefined;
    documentType?: string | null | undefined;
    uploadedById?: string | null | undefined;
}, {
    businessId: string;
    supplierId: string;
    title: string;
    url: string;
    note?: string | null | undefined;
    fileName?: string | null | undefined;
    documentType?: string | null | undefined;
    uploadedById?: string | null | undefined;
}>;
export declare const supplierPaymentCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodString;
    purchaseOrderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodNumber;
    method: z.ZodEnum<["cash", "mpesa", "bank", "credit"]>;
    reference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    paymentDate: z.ZodString;
    recordedById: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    amount: number;
    supplierId: string;
    method: "cash" | "mpesa" | "bank" | "credit";
    paymentDate: string;
    note?: string | null | undefined;
    recordedById?: string | null | undefined;
    reference?: string | null | undefined;
    purchaseOrderId?: string | null | undefined;
}, {
    businessId: string;
    amount: number;
    supplierId: string;
    method: "cash" | "mpesa" | "bank" | "credit";
    paymentDate: string;
    note?: string | null | undefined;
    recordedById?: string | null | undefined;
    reference?: string | null | undefined;
    purchaseOrderId?: string | null | undefined;
}>;
export declare const purchaseOrderLineSchema: z.ZodObject<{
    productId: z.ZodString;
    productName: z.ZodString;
    quantity: z.ZodNumber;
    unitCost: z.ZodNumber;
    batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
    productName: string;
    unitCost: number;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
}, {
    productId: string;
    quantity: number;
    productName: string;
    unitCost: number;
    batchNumber?: string | null | undefined;
    expiryDate?: string | null | undefined;
}>;
export declare const purchaseOrderCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    supplierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    orderNumber: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "ordered", "partially_received", "received", "cancelled"]>>;
    orderDate: z.ZodString;
    expectedDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    receivedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    subtotal: z.ZodDefault<z.ZodNumber>;
    taxTotal: z.ZodDefault<z.ZodNumber>;
    total: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        productName: z.ZodString;
        quantity: z.ZodNumber;
        unitCost: z.ZodNumber;
        batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expiryDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        productName: string;
        unitCost: number;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }, {
        productId: string;
        quantity: number;
        productName: string;
        unitCost: number;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
    businessId: string;
    items: {
        productId: string;
        quantity: number;
        productName: string;
        unitCost: number;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }[];
    taxTotal: number;
    orderNumber: string;
    orderDate: string;
    subtotal: number;
    total: number;
    notes?: string | null | undefined;
    supplierId?: string | null | undefined;
    expectedDate?: string | null | undefined;
    receivedAt?: string | null | undefined;
}, {
    businessId: string;
    orderNumber: string;
    orderDate: string;
    status?: "draft" | "ordered" | "partially_received" | "received" | "cancelled" | undefined;
    items?: {
        productId: string;
        quantity: number;
        productName: string;
        unitCost: number;
        batchNumber?: string | null | undefined;
        expiryDate?: string | null | undefined;
    }[] | undefined;
    notes?: string | null | undefined;
    taxTotal?: number | undefined;
    supplierId?: string | null | undefined;
    expectedDate?: string | null | undefined;
    receivedAt?: string | null | undefined;
    subtotal?: number | undefined;
    total?: number | undefined;
}>;
export declare const stockTransferLineSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    unitCost: z.ZodDefault<z.ZodNumber>;
    batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serialNumbers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
    unitCost: number;
    serialNumbers: string[];
    batchNumber?: string | null | undefined;
}, {
    productId: string;
    quantity: number;
    batchNumber?: string | null | undefined;
    unitCost?: number | undefined;
    serialNumbers?: string[] | undefined;
}>;
export declare const stockTransferCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    fromBranchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    toBranchId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    transferNumber: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["draft", "in_transit", "received", "cancelled"]>>;
    transferDate: z.ZodString;
    receivedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        unitCost: z.ZodDefault<z.ZodNumber>;
        batchNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        serialNumbers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        unitCost: number;
        serialNumbers: string[];
        batchNumber?: string | null | undefined;
    }, {
        productId: string;
        quantity: number;
        batchNumber?: string | null | undefined;
        unitCost?: number | undefined;
        serialNumbers?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "received" | "cancelled" | "in_transit";
    businessId: string;
    items: {
        productId: string;
        quantity: number;
        unitCost: number;
        serialNumbers: string[];
        batchNumber?: string | null | undefined;
    }[];
    transferNumber: string;
    transferDate: string;
    note?: string | null | undefined;
    receivedAt?: string | null | undefined;
    fromBranchId?: string | null | undefined;
    toBranchId?: string | null | undefined;
}, {
    businessId: string;
    transferNumber: string;
    transferDate: string;
    status?: "draft" | "received" | "cancelled" | "in_transit" | undefined;
    items?: {
        productId: string;
        quantity: number;
        batchNumber?: string | null | undefined;
        unitCost?: number | undefined;
        serialNumbers?: string[] | undefined;
    }[] | undefined;
    note?: string | null | undefined;
    receivedAt?: string | null | undefined;
    fromBranchId?: string | null | undefined;
    toBranchId?: string | null | undefined;
}>;
export declare const stockAdjustmentCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    productId: z.ZodString;
    adjustmentNumber: z.ZodString;
    quantityDelta: z.ZodNumber;
    unitCost: z.ZodDefault<z.ZodNumber>;
    reason: z.ZodString;
    referenceId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    businessId: string;
    reason: string;
    unitCost: number;
    adjustmentNumber: string;
    quantityDelta: number;
    note?: string | null | undefined;
    referenceId?: string | null | undefined;
}, {
    productId: string;
    businessId: string;
    reason: string;
    adjustmentNumber: string;
    quantityDelta: number;
    note?: string | null | undefined;
    unitCost?: number | undefined;
    referenceId?: string | null | undefined;
}>;
export declare const syncEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    businessId: z.ZodString;
    deviceId: z.ZodString;
    entityType: z.ZodString;
    entityId: z.ZodString;
    action: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodAny>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    businessId: string;
    eventId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, any>;
    createdAt: string;
}, {
    businessId: string;
    eventId: string;
    deviceId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, any>;
    createdAt: string;
}>;
