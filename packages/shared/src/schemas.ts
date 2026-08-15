import { z } from "zod";
import { BUSINESS_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, PLAN_TIERS, USER_ROLES } from "./constants";
import { INDUSTRY_KEYS } from "./industries";

const isoDate = z.string().min(1);
const nullableText = z.preprocess((value) => (value === "" ? null : value), z.string().nullable().optional());
const nullableIsoDate = z.preprocess((value) => (value === "" ? null : value), isoDate.nullable().optional());

export const businessSetupSchema = z.object({
  ownerName: z.string().min(2, "Enter the business owner's full name."),
  phone: z.string().min(7, "Enter a valid phone number."),
  password: z.string().min(6, "Use at least 6 characters for the password."),
  businessName: z.string().min(2, "Enter the business name."),
  industryKey: z.enum(INDUSTRY_KEYS).optional(),
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

export const bankAccountCreateSchema = z.object({
  businessId: z.string().min(1, "Select the business before saving."),
  bankName: z.string().min(2, "Enter a bank name."),
  accountName: z.string().min(2, "Enter an account name."),
  accountNumber: z.string().nullable().optional(),
  currency: z.string().min(3, "Use a 3-letter currency code.").max(3, "Use a 3-letter currency code."),
  openingBalance: z.number().default(0),
  currentBalance: z.number().default(0),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export const pettyCashEntryCreateSchema = z.object({
  businessId: z.string().min(1, "Select the business before saving."),
  label: z.string().min(2, "Enter a label."),
  amount: z.number().positive("Enter an amount greater than zero."),
  direction: z.enum(["in", "out"]),
  category: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  recordedById: z.string().optional(),
  entryDate: isoDate.min(1, "Choose a date."),
});

export const creditNoteCreateSchema = z.object({
  businessId: z.string().min(1, "Select the business before saving."),
  reference: z.string().min(2, "Enter a reference."),
  amount: z.number().positive("Enter an amount greater than zero."),
  reason: z.string().min(2, "Describe the credit note."),
  relatedSaleId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  creditDate: isoDate.min(1, "Choose a date."),
  status: z.enum(["draft", "issued", "void"]).default("draft"),
});

export const productCreateSchema = z.object({
  businessId: z.string().min(1, "Select the business before saving."),
  categoryId: nullableText,
  brandId: nullableText,
  supplierId: nullableText,
  name: z.string().min(2, "Enter a product name."),
  sku: nullableText,
  barcode: nullableText,
  batchNumber: nullableText,
  expiryDate: nullableIsoDate,
  serialNumber: nullableText,
  unit: z.string().min(1, "Enter a unit of measure."),
  buyingPrice: z.number().nonnegative("Buying price cannot be negative."),
  sellingPrice: z.number().nonnegative("Selling price cannot be negative."),
  stockOnHand: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().nonnegative().default(5),
  isActive: z.boolean().default(true),
});

export const brandCreateSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(2, "Enter a brand name."),
  description: z.string().nullable().optional(),
});

export const supplierCreateSchema = z.object({
  businessId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().min(2, "Enter a supplier name."),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  contactName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const supplierCategoryCreateSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(2, "Enter a supplier category name."),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const supplierContactCreateSchema = z.object({
  businessId: z.string().min(1),
  supplierId: z.string().min(1),
  name: z.string().min(2, "Enter a contact name."),
  role: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export const supplierDocumentCreateSchema = z.object({
  businessId: z.string().min(1),
  supplierId: z.string().min(1),
  title: z.string().min(2, "Enter a document title."),
  url: z.string().url("Enter a valid document URL."),
  fileName: z.string().nullable().optional(),
  documentType: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  uploadedById: z.string().nullable().optional(),
});

export const supplierPaymentCreateSchema = z.object({
  businessId: z.string().min(1),
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().nullable().optional(),
  amount: z.number().positive("Enter an amount greater than zero."),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  paymentDate: isoDate.min(1, "Choose a payment date."),
  recordedById: z.string().nullable().optional(),
});

export const purchaseOrderLineSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  batchNumber: z.string().nullable().optional(),
  expiryDate: isoDate.nullable().optional(),
});

export const purchaseOrderCreateSchema = z.object({
  businessId: z.string().min(1),
  supplierId: z.string().nullable().optional(),
  orderNumber: z.string().min(1),
  status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]).default("draft"),
  orderDate: isoDate,
  expectedDate: isoDate.nullable().optional(),
  receivedAt: isoDate.nullable().optional(),
  subtotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  items: z.array(purchaseOrderLineSchema).default([]),
});

export const stockTransferLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().default(0),
  batchNumber: z.string().nullable().optional(),
  serialNumbers: z.array(z.string().min(1)).default([]),
});

export const stockTransferCreateSchema = z.object({
  businessId: z.string().min(1),
  fromBranchId: z.string().nullable().optional(),
  toBranchId: z.string().nullable().optional(),
  transferNumber: z.string().min(1),
  status: z.enum(["draft", "in_transit", "received", "cancelled"]).default("draft"),
  transferDate: isoDate,
  receivedAt: isoDate.nullable().optional(),
  note: z.string().nullable().optional(),
  items: z.array(stockTransferLineSchema).default([]),
});

export const stockAdjustmentCreateSchema = z.object({
  businessId: z.string().min(1),
  productId: z.string().min(1),
  adjustmentNumber: z.string().min(1),
  quantityDelta: z.number(),
  unitCost: z.number().nonnegative().default(0),
  reason: z.string().min(1),
  referenceId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
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
