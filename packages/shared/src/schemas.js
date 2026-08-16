"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncEventSchema = exports.productCreateSchema = exports.expenseCreateSchema = exports.saleCreateSchema = exports.saleItemSchema = exports.loginSchema = exports.businessSetupSchema = void 0;
const zod_1 = require("zod");
const constants_1 = require("./constants");
const isoDate = zod_1.z.string().min(1);
exports.businessSetupSchema = zod_1.z.object({
    ownerName: zod_1.z.string().min(2),
    phone: zod_1.z.string().min(7),
    password: zod_1.z.string().min(6),
    businessName: zod_1.z.string().min(2),
    businessType: zod_1.z.enum(constants_1.BUSINESS_TYPES),
    planTier: zod_1.z.enum(constants_1.PLAN_TIERS),
    currency: zod_1.z.string().min(3).max(3).default("KES"),
    branchName: zod_1.z.string().min(2),
    cashierPin: zod_1.z.string().min(4).max(8).optional().or(zod_1.z.literal("")),
});
exports.loginSchema = zod_1.z.object({
    identifier: zod_1.z.string().min(2),
    passwordOrPin: zod_1.z.string().min(4),
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
    businessId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().nullable().optional(),
    amount: zod_1.z.number().positive(),
    note: zod_1.z.string().min(1),
    expenseDate: isoDate,
    recordedById: zod_1.z.string().optional(),
});
exports.productCreateSchema = zod_1.z.object({
    businessId: zod_1.z.string().min(1),
    categoryId: zod_1.z.string().nullable().optional(),
    name: zod_1.z.string().min(2),
    sku: zod_1.z.string().nullable().optional(),
    barcode: zod_1.z.string().nullable().optional(),
    unit: zod_1.z.string().min(1),
    buyingPrice: zod_1.z.number().nonnegative(),
    sellingPrice: zod_1.z.number().nonnegative(),
    stockOnHand: zod_1.z.number().nonnegative().default(0),
    lowStockThreshold: zod_1.z.number().nonnegative().default(5),
    isActive: zod_1.z.boolean().default(true),
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
