import { z } from "zod";
import { BUSINESS_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, PLAN_TIERS, USER_ROLES } from "./constants";

const isoDate = z.string().min(1);

export const businessSetupSchema = z.object({
  ownerName: z.string().min(2, "Enter the business owner's full name."),
  phone: z.string().min(7, "Enter a valid phone number."),
  password: z.string().min(6, "Use at least 6 characters for the password."),
  businessName: z.string().min(2, "Enter the business name."),
  businessType: z.enum(BUSINESS_TYPES),
  planTier: z.enum(PLAN_TIERS),
  currency: z.string().min(3, "Use a 3-letter currency code, like KES.").max(3, "Use a 3-letter currency code, like KES.").default("KES"),
  branchName: z.string().min(2, "Enter the first branch name."),
  cashierPin: z.string().min(4, "PINs must be 4 to 8 digits.").max(8, "PINs must be 4 to 8 digits.").optional().or(z.literal("")),
});

export const loginSchema = z.object({
  identifier: z.string().min(2, "Enter a phone number or account name."),
  passwordOrPin: z.string().min(4, "Enter the password or PIN."),
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
  businessId: z.string().min(1, "Select the business before saving."),
  categoryId: z.string().nullable().optional(),
  amount: z.number().positive("Enter an amount greater than zero."),
  note: z.string().min(1, "Add a short expense note."),
  expenseDate: isoDate.min(1, "Choose an expense date."),
  recordedById: z.string().optional(),
});

export const productCreateSchema = z.object({
  businessId: z.string().min(1, "Select the business before saving."),
  categoryId: z.string().nullable().optional(),
  name: z.string().min(2, "Enter a product name."),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  unit: z.string().min(1, "Enter a unit of measure."),
  buyingPrice: z.number().nonnegative("Buying price cannot be negative."),
  sellingPrice: z.number().nonnegative("Selling price cannot be negative."),
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
