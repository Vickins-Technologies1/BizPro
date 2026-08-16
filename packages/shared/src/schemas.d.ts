import { z } from "zod";
export declare const businessSetupSchema: z.ZodObject<{
    ownerName: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
    businessName: z.ZodString;
    businessType: z.ZodEnum<["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant"]>;
    planTier: z.ZodEnum<["lite", "standard", "pro"]>;
    currency: z.ZodDefault<z.ZodString>;
    branchName: z.ZodString;
    cashierPin: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    ownerName: string;
    phone: string;
    password: string;
    businessName: string;
    businessType: "retail_shop" | "boutique" | "cosmetics" | "accessories" | "wines_spirits" | "hardware" | "agrovet" | "restaurant";
    planTier: "lite" | "standard" | "pro";
    currency: string;
    branchName: string;
    cashierPin?: string | undefined;
}, {
    ownerName: string;
    phone: string;
    password: string;
    businessName: string;
    businessType: "retail_shop" | "boutique" | "cosmetics" | "accessories" | "wines_spirits" | "hardware" | "agrovet" | "restaurant";
    planTier: "lite" | "standard" | "pro";
    branchName: string;
    currency?: string | undefined;
    cashierPin?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    identifier: z.ZodString;
    passwordOrPin: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["owner", "manager", "cashier"]>>;
}, "strip", z.ZodTypeAny, {
    identifier: string;
    passwordOrPin: string;
    role?: "owner" | "manager" | "cashier" | undefined;
}, {
    identifier: string;
    passwordOrPin: string;
    role?: "owner" | "manager" | "cashier" | undefined;
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
export declare const productCreateSchema: z.ZodObject<{
    businessId: z.ZodString;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    barcode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
    sku?: string | null | undefined;
    barcode?: string | null | undefined;
}, {
    businessId: string;
    name: string;
    unit: string;
    buyingPrice: number;
    sellingPrice: number;
    categoryId?: string | null | undefined;
    sku?: string | null | undefined;
    barcode?: string | null | undefined;
    stockOnHand?: number | undefined;
    lowStockThreshold?: number | undefined;
    isActive?: boolean | undefined;
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
