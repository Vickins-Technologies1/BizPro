import { z } from "zod";
import { BUSINESS_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, PLAN_TIERS, USER_ROLES } from "./constants";

const isoDate = z.string().min(1);

export const businessSetupSchema = z.object({
  ownerName: z.string().min(2),
  phone: z.string().min(7),
  password: z.string().min(6),
  businessName: z.string().min(2),
  businessType: z.enum(BUSINESS_TYPES),
  planTier: z.enum(PLAN_TIERS),
  currency: z.string().min(3).max(3).default("KES"),
  branchName: z.string().min(2),
  cashierPin: z.string().min(4).max(8).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  identifier: z.string().min(2),
  passwordOrPin: z.string().min(4),
  role: z.enum(USER_ROLES).optional(),
});

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
});

export const saleCreateSchema = z.object({
  businessId: z.string().min(1),
  branchId: z.string().optional(),
  customerId: z.string().nullable().optional(),
  cashierId: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  items: z.array(saleItemSchema).min(1),
  notes: z.string().optional(),
  discountTotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  amountPaid: z.number().nonnegative().default(0),
});

export const expenseCreateSchema = z.object({
  businessId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  amount: z.number().positive(),
  note: z.string().min(1),
  expenseDate: isoDate,
  recordedById: z.string().optional(),
});

export const productCreateSchema = z.object({
  businessId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  name: z.string().min(2),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  unit: z.string().min(1),
  buyingPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  stockOnHand: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().nonnegative().default(5),
  isActive: z.boolean().default(true),
});

export const syncEventSchema = z.object({
  eventId: z.string().min(1),
  businessId: z.string().min(1),
  deviceId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  action: z.string().min(1),
  payload: z.record(z.string(), z.any()),
  createdAt: isoDate,
});
