import type { BUSINESS_TYPES, PAYMENT_METHODS, PAYMENT_STATUSES, PLAN_TIERS, SYNC_ACTIONS, USER_ROLES } from "./constants";

export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type PlanTier = (typeof PLAN_TIERS)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type SyncAction = (typeof SYNC_ACTIONS)[number];

export interface BaseEntity {
  id: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Branch extends BaseEntity {
  name: string;
  code: string;
  isDefault: boolean;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  currency: string;
  planTier: PlanTier;
  billingStatus: "trial" | "active" | "past_due" | "suspended";
  graceEndsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface User extends BaseEntity {
  branchId?: string | null;
  fullName: string;
  phone?: string | null;
  pinHash?: string | null;
  role: UserRole;
  isActive: boolean;
}

export interface Device extends BaseEntity {
  deviceName: string;
  platform: "android" | "ios" | "web";
  lastSeenAt?: string | null;
  trusted: boolean;
}

export interface Category extends BaseEntity {
  name: string;
  color?: string | null;
  sortOrder: number;
}

export interface Product extends BaseEntity {
  categoryId?: string | null;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  stockOnHand: number;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface Customer extends BaseEntity {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  balance: number;
}

export interface Supplier extends BaseEntity {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineDiscount: number;
  lineTotal: number;
}

export interface Payment {
  id: string;
  businessId: string;
  customerId?: string | null;
  saleId?: string | null;
  debtPaymentId?: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference?: string | null;
  note?: string | null;
  provider?: string | null;
  reconciledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sale extends BaseEntity {
  branchId?: string | null;
  customerId?: string | null;
  receiptNumber: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  cashierId?: string | null;
  notes?: string | null;
  items: SaleItem[];
}

export interface Expense extends BaseEntity {
  categoryId?: string | null;
  amount: number;
  note: string;
  expenseDate: string;
  recordedById?: string | null;
}

export interface StockMovement extends BaseEntity {
  productId: string;
  referenceType: "sale" | "purchase" | "adjustment" | "restock" | "refund";
  referenceId: string;
  quantityDelta: number;
  unitCost: number;
  note?: string | null;
}

export interface SyncEventPayload<T = any> {
  eventId: string;
  businessId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  action: SyncAction;
  payload: T;
  createdAt: string;
}

export interface SyncCheckpoint {
  businessId: string;
  deviceId: string;
  lastPulledAt?: string | null;
  lastPushedAt?: string | null;
  serverCursor?: string | null;
}

export interface DailySummary {
  date: string;
  salesTotal: number;
  expensesTotal: number;
  cogsTotal: number;
  estimatedProfit: number;
  debtTotal: number;
  lowStockCount: number;
}
