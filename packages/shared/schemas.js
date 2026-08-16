"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncEventSchema = exports.stockAdjustmentCreateSchema = exports.stockTransferCreateSchema = exports.stockTransferLineSchema = exports.purchaseOrderCreateSchema = exports.purchaseOrderLineSchema = exports.supplierPaymentCreateSchema = exports.supplierDocumentCreateSchema = exports.supplierContactCreateSchema = exports.supplierCategoryCreateSchema = exports.supplierCreateSchema = exports.brandCreateSchema = exports.productCreateSchema = exports.creditNoteCreateSchema = exports.pettyCashEntryCreateSchema = exports.bankAccountCreateSchema = exports.expenseCreateSchema = exports.saleCreateSchema = exports.saleItemSchema = exports.loginSchema = exports.businessSetupSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("./constants");
const industries_1 = require("./industries");
const isoDate = zod_1.z.string().min(1);
const nullableText = zod_1.z.preprocess((value) => (value === "" ? null : value), zod_1.z.string().nullable().optional());
const nullableIsoDate = zod_1.z.preprocess((value) => (value === "" ? null : value), isoDate.nullable().optional());
exports.businessSetupSchema = zod_1.z.object({
    ownerName: zod_1.z.string().min(2, "Enter the business owner's full name."),
    phone: zod_1.z.string().min(7, "Enter a valid phone number."),
    password: zod_1.z.string().min(6, "Use at least 6 characters for the password."),
    businessName: zod_1.z.string().min(2, "Enter the business name."),
    industryKey: zod_1.z.enum(industries_1.INDUSTRY_KEYS).optional(),
    businessType: zod_1.z.enum(constants_1.BUSINESS_TYPES),
    planTier: zod_1.z.enum(constants_1.PLAN_TIERS),
    currency: zod_1.z.string().min(3, "Use a 3-letter currency code, like KES.").max(3, "Use a 3-letter currency code, like KES.").default("KES"),
    branchName: zod_1.z.string().min(2, "Enter the first branch name."),
    cashierPin: zod_1.z.string().min(4, "PINs must be 4 to 8 digits.").max(8, "PINs must be 4 to 8 digits.").optional().or(zod_1.z.literal("")),
});
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(2, "Enter a phone number or account name."),
    passwordOrPin: zod_1.z.string().min(4, "Enter the password or PIN."),
    role: zod_1.z.enum(constants_1.USER_ROLES).optional(),
});
exports.saleItemSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unitPrice: zod_1.z.number().nonnegative(),
    costPrice: zod_1.z.number().nonnegative().default(0),
    discount: zod_1.z.number().nonnegative().default(0),
});
exports.saleCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    branchId: zod_1.z.string().optional(),
    customerId: zod_1.z.string().nullable().optional(),
    cashierId: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.enum(constants_1.PAYMENT_METHODS),
    paymentStatus: zod_1.z.enum(constants_1.PAYMENT_STATUSES),
    items: zod_1.z.array(exports.saleItemSchema).min(1),
    notes: zod_1.z.string().optional(),
    discountTotal: zod_1.z.number().nonnegative().default(0),
    taxTotal: zod_1.z.number().nonnegative().default(0),
    amountPaid: zod_1.z.number().nonnegative().default(0),
});
exports.expenseCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1, "Select the business before saving."),
    categoryId: zod_1.z.string().nullable().optional(),
    amount: zod_1.z.number().positive("Enter an amount greater than zero."),
    note: zod_1.z.string().min(1, "Add a short expense note."),
    expenseDate: isoDate.min(1, "Choose an expense date."),
    recordedById: zod_1.z.string().optional(),
});
exports.bankAccountCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1, "Select the business before saving."),
    bankName: zod_1.z.string().min(2, "Enter a bank name."),
    accountName: zod_1.z.string().min(2, "Enter an account name."),
    accountNumber: zod_1.z.string().nullable().optional(),
    currency: zod_1.z.string().min(3, "Use a 3-letter currency code.").max(3, "Use a 3-letter currency code."),
    openingBalance: zod_1.z.number().default(0),
    currentBalance: zod_1.z.number().default(0),
    isPrimary: zod_1.z.boolean().default(false),
    notes: zod_1.z.string().nullable().optional(),
});
exports.pettyCashEntryCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1, "Select the business before saving."),
    label: zod_1.z.string().min(2, "Enter a label."),
    amount: zod_1.z.number().positive("Enter an amount greater than zero."),
    direction: zod_1.z.enum(["in", "out"]),
    category: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
    recordedById: zod_1.z.string().optional(),
    entryDate: isoDate.min(1, "Choose a date."),
});
exports.creditNoteCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1, "Select the business before saving."),
    reference: zod_1.z.string().min(2, "Enter a reference."),
    amount: zod_1.z.number().positive("Enter an amount greater than zero."),
    reason: zod_1.z.string().min(2, "Describe the credit note."),
    relatedSaleId: zod_1.z.string().nullable().optional(),
    customerId: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
    creditDate: isoDate.min(1, "Choose a date."),
    status: zod_1.z.enum(["draft", "issued", "void"]).default("draft"),
});
exports.productCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1, "Select the business before saving."),
    categoryId: nullableText,
    brandId: nullableText,
    supplierId: nullableText,
    name: zod_1.z.string().min(2, "Enter a product name."),
    sku: nullableText,
    barcode: nullableText,
    batchNumber: nullableText,
    expiryDate: nullableIsoDate,
    serialNumber: nullableText,
    unit: zod_1.z.string().min(1, "Enter a unit of measure."),
    buyingPrice: zod_1.z.number().nonnegative("Buying price cannot be negative."),
    sellingPrice: zod_1.z.number().nonnegative("Selling price cannot be negative."),
    stockOnHand: zod_1.z.number().nonnegative().default(0),
    lowStockThreshold: zod_1.z.number().nonnegative().default(5),
    isActive: zod_1.z.boolean().default(true),
});
exports.brandCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(2, "Enter a brand name."),
    description: zod_1.z.string().nullable().optional(),
});
exports.supplierCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().nullable().optional(),
    code: zod_1.z.string().nullable().optional(),
    name: zod_1.z.string().min(2, "Enter a supplier name."),
    phone: zod_1.z.string().nullable().optional(),
    email: zod_1.z.string().email().nullable().optional().or(zod_1.z.literal("")),
    contactName: zod_1.z.string().nullable().optional(),
    notes: zod_1.z.string().nullable().optional(),
});
exports.supplierCategoryCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(2, "Enter a supplier category name."),
    description: zod_1.z.string().nullable().optional(),
    color: zod_1.z.string().nullable().optional(),
    sortOrder: zod_1.z.number().int().default(0),
    isActive: zod_1.z.boolean().default(true),
});
exports.supplierContactCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    supplierId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(2, "Enter a contact name."),
    role: zod_1.z.string().nullable().optional(),
    phone: zod_1.z.string().nullable().optional(),
    email: zod_1.z.string().email().nullable().optional().or(zod_1.z.literal("")),
    isPrimary: zod_1.z.boolean().default(false),
    notes: zod_1.z.string().nullable().optional(),
});
exports.supplierDocumentCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    supplierId: zod_1.z.string().min(1),
    title: zod_1.z.string().min(2, "Enter a document title."),
    url: zod_1.z.string().url("Enter a valid document URL."),
    fileName: zod_1.z.string().nullable().optional(),
    documentType: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
    uploadedById: zod_1.z.string().nullable().optional(),
});
exports.supplierPaymentCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    supplierId: zod_1.z.string().min(1),
    purchaseOrderId: zod_1.z.string().nullable().optional(),
    amount: zod_1.z.number().positive("Enter an amount greater than zero."),
    method: zod_1.z.enum(constants_1.PAYMENT_METHODS),
    reference: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
    paymentDate: isoDate.min(1, "Choose a payment date."),
    recordedById: zod_1.z.string().nullable().optional(),
});
exports.purchaseOrderLineSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    productName: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unitCost: zod_1.z.number().nonnegative(),
    batchNumber: zod_1.z.string().nullable().optional(),
    expiryDate: isoDate.nullable().optional(),
});
exports.purchaseOrderCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    supplierId: zod_1.z.string().nullable().optional(),
    orderNumber: zod_1.z.string().min(1),
    status: zod_1.z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]).default("draft"),
    orderDate: isoDate,
    expectedDate: isoDate.nullable().optional(),
    receivedAt: isoDate.nullable().optional(),
    subtotal: zod_1.z.number().nonnegative().default(0),
    taxTotal: zod_1.z.number().nonnegative().default(0),
    total: zod_1.z.number().nonnegative().default(0),
    notes: zod_1.z.string().nullable().optional(),
    items: zod_1.z.array(exports.purchaseOrderLineSchema).default([]),
});
exports.stockTransferLineSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unitCost: zod_1.z.number().nonnegative().default(0),
    batchNumber: zod_1.z.string().nullable().optional(),
    serialNumbers: zod_1.z.array(zod_1.z.string().min(1)).default([]),
});
exports.stockTransferCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    fromBranchId: zod_1.z.string().nullable().optional(),
    toBranchId: zod_1.z.string().nullable().optional(),
    transferNumber: zod_1.z.string().min(1),
    status: zod_1.z.enum(["draft", "in_transit", "received", "cancelled"]).default("draft"),
    transferDate: isoDate,
    receivedAt: isoDate.nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
    items: zod_1.z.array(exports.stockTransferLineSchema).default([]),
});
exports.stockAdjustmentCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    productId: zod_1.z.string().min(1),
    adjustmentNumber: zod_1.z.string().min(1),
    quantityDelta: zod_1.z.number(),
    unitCost: zod_1.z.number().nonnegative().default(0),
    reason: zod_1.z.string().min(1),
    referenceId: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().nullable().optional(),
});
exports.syncEventSchema = zod_1.z.object({
    eventId: zod_1.z.string().min(1),
    businessId: zod_1.z.string().min(1),
    deviceId: zod_1.z.string().min(1),
    entityType: zod_1.z.string().min(1),
    entityId: zod_1.z.string().min(1),
    action: zod_1.z.string().min(1),
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    createdAt: isoDate,
});
