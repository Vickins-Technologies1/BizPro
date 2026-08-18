import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import type { BusinessType, IndustryKey, PlanTier, UserRole, PaymentMethod, PaymentStatus, AccessPermission } from "@vbo/shared";
import { BUSINESS_TYPES, INDUSTRY_KEYS, USER_ROLES } from "@vbo/shared";
import { buildBusinessSchemas } from "./business.schemas";
import { buildCatalogSchemas } from "./catalog.schemas";
import { buildFinanceSchemas } from "./finance.schemas";
import { buildSuppliersSchemas } from "./suppliers.schemas";
import { buildSyncSchemas } from "./sync.schemas";
import { buildSubscriptionSchemas } from "./subscription.schemas";
import { buildOpsSchemas } from "./ops.schemas";

@Schema({ timestamps: true, collection: "businesses" })
export class Business {
  @Prop({ type: String, index: true, unique: true, sparse: true, default: null })
  externalId?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true, enum: [...BUSINESS_TYPES] satisfies BusinessType[] })
  businessType!: BusinessType;

  @Prop({ type: String, enum: INDUSTRY_KEYS, default: null })
  industryKey?: IndustryKey | null;

  @Prop({ required: true, default: "KES" })
  currency!: string;

  @Prop({ required: true, enum: ["lite", "standard", "pro"] satisfies PlanTier[] })
  planTier!: PlanTier;

  @Prop({ required: true, default: "trial" })
  billingStatus!: "trial" | "active" | "past_due" | "suspended";

  @Prop({ type: Date })
  graceEndsAt?: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type BusinessDocument = HydratedDocument<Business>;
export const BusinessSchema = SchemaFactory.createForClass(Business);

@Schema({ timestamps: true, collection: "branches" })
export class Branch {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  code!: string;

  @Prop({ default: false })
  isDefault!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type BranchDocument = HydratedDocument<Branch>;
export const BranchSchema = SchemaFactory.createForClass(Branch);

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  ownerId?: string | null;

  @Prop({ type: String })
  branchId?: string | null;

  @Prop({ required: true })
  fullName!: string;

  @Prop({ type: String })
  phone?: string | null;

  @Prop({ type: String, select: false })
  passwordHash?: string | null;

  @Prop({ type: String, select: false })
  pinHash?: string | null;

  @Prop({ required: true, enum: [...USER_ROLES] satisfies UserRole[] })
  role!: UserRole;

  @Prop({ type: String, default: null })
  roleLabel?: string | null;

  @Prop({ type: [String], default: undefined })
  permissions?: AccessPermission[] | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  suspendedAt?: Date | null;

  @Prop({ type: String, default: null })
  suspensionReason?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

@Schema({ timestamps: true, collection: "devices" })
export class Device {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null, index: true })
  deviceKey?: string | null;

  @Prop({ required: true })
  deviceName!: string;

  @Prop({ required: true, enum: ["android", "ios", "web"] })
  platform!: "android" | "ios" | "web";

  @Prop({ type: String, default: null })
  userId?: string | null;

  @Prop({ type: String, default: null })
  pushToken?: string | null;

  @Prop({ type: Date, default: null })
  pushTokenUpdatedAt?: Date | null;

  @Prop({ default: false })
  trusted!: boolean;

  @Prop({ type: Date })
  lastSeenAt?: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type DeviceDocument = HydratedDocument<Device>;
export const DeviceSchema = SchemaFactory.createForClass(Device);
DeviceSchema.index({ businessId: 1, deviceKey: 1 }, { unique: true, sparse: true });
DeviceSchema.index({ businessId: 1, pushToken: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true, collection: "categories" })
export class Category {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String })
  color?: string | null;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

@Schema({ timestamps: true, collection: "brands" })
export class Brand {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type BrandDocument = HydratedDocument<Brand>;
export const BrandSchema = SchemaFactory.createForClass(Brand);

@Schema({ timestamps: true, collection: "products" })
export class Product {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ type: String })
  categoryId?: string | null;

  @Prop({ type: String })
  brandId?: string | null;

  @Prop({ type: String })
  supplierId?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String })
  sku?: string | null;

  @Prop({ type: String })
  barcode?: string | null;

  @Prop({ type: String })
  batchNumber?: string | null;

  @Prop({ type: Date })
  expiryDate?: Date | null;

  @Prop({ type: String })
  serialNumber?: string | null;

  @Prop({ required: true, default: "pcs" })
  unit!: string;

  @Prop({ required: true, default: 0 })
  buyingPrice!: number;

  @Prop({ required: true, default: 0 })
  sellingPrice!: number;

  @Prop({ required: true, default: 0 })
  stockOnHand!: number;

  @Prop({ required: true, default: 5 })
  lowStockThreshold!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

@Schema({ timestamps: true, collection: "suppliers" })
export class Supplier {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  categoryId?: string | null;

  @Prop({ type: String })
  code?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String })
  phone?: string | null;

  @Prop({ type: String })
  email?: string | null;

  @Prop({ type: String })
  contactName?: string | null;

  @Prop({ type: String })
  notes?: string | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type SupplierDocument = HydratedDocument<Supplier>;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);

@Schema({ timestamps: true, collection: "supplier_categories" })
export class SupplierCategory {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: String, default: null })
  color?: string | null;

  @Prop({ required: true, default: 0 })
  sortOrder!: number;

  @Prop({ required: true, default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type SupplierCategoryDocument = HydratedDocument<SupplierCategory>;
export const SupplierCategorySchema = SchemaFactory.createForClass(SupplierCategory);

@Schema({ timestamps: true, collection: "supplier_contacts" })
export class SupplierContact {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  supplierId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  role?: string | null;

  @Prop({ type: String, default: null })
  phone?: string | null;

  @Prop({ type: String, default: null })
  email?: string | null;

  @Prop({ required: true, default: false })
  isPrimary!: boolean;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type SupplierContactDocument = HydratedDocument<SupplierContact>;
export const SupplierContactSchema = SchemaFactory.createForClass(SupplierContact);

@Schema({ timestamps: true, collection: "supplier_documents" })
export class SupplierFile {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  supplierId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: String, default: null })
  fileName?: string | null;

  @Prop({ type: String, default: null })
  documentType?: string | null;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ type: String, default: null })
  uploadedById?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type SupplierFileDocument = HydratedDocument<SupplierFile>;
export const SupplierFileSchema = SchemaFactory.createForClass(SupplierFile);

@Schema({ timestamps: true, collection: "supplier_payments" })
export class SupplierPayment {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  supplierId!: string;

  @Prop({ type: String, default: null })
  purchaseOrderId?: string | null;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  method!: PaymentMethod;

  @Prop({ type: String, default: null })
  reference?: string | null;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ required: true })
  paymentDate!: Date;

  @Prop({ type: String, default: null })
  recordedById?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type SupplierPaymentDocument = HydratedDocument<SupplierPayment>;
export const SupplierPaymentSchema = SchemaFactory.createForClass(SupplierPayment);

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

@Schema({ timestamps: true, collection: "purchase_orders" })
export class PurchaseOrder {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ type: String })
  supplierId?: string | null;

  @Prop({ required: true, index: true })
  orderNumber!: string;

  @Prop({ required: true, default: "draft" })
  status!: "draft" | "ordered" | "partially_received" | "received" | "cancelled";

  @Prop({ required: true })
  orderDate!: Date;

  @Prop({ type: Date })
  expectedDate?: Date | null;

  @Prop({ type: Date })
  receivedAt?: Date | null;

  @Prop({ required: true, default: 0 })
  subtotal!: number;

  @Prop({ required: true, default: 0 })
  taxTotal!: number;

  @Prop({ required: true, default: 0 })
  total!: number;

  @Prop({ type: String })
  notes?: string | null;

  @Prop({ type: Array, default: [] })
  items!: PurchaseOrderItem[];

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type PurchaseOrderDocument = HydratedDocument<PurchaseOrder>;
export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);

export interface StockTransferItem {
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string | null;
  serialNumbers?: string[] | null;
}

@Schema({ timestamps: true, collection: "stock_transfers" })
export class StockTransfer {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String })
  fromBranchId?: string | null;

  @Prop({ type: String })
  toBranchId?: string | null;

  @Prop({ required: true, index: true })
  transferNumber!: string;

  @Prop({ required: true, default: "draft" })
  status!: "draft" | "in_transit" | "received" | "cancelled";

  @Prop({ required: true })
  transferDate!: Date;

  @Prop({ type: Date })
  receivedAt?: Date | null;

  @Prop({ type: String })
  note?: string | null;

  @Prop({ type: Array, default: [] })
  items!: StockTransferItem[];

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type StockTransferDocument = HydratedDocument<StockTransfer>;
export const StockTransferSchema = SchemaFactory.createForClass(StockTransfer);

@Schema({ timestamps: true, collection: "stock_adjustments" })
export class StockAdjustment {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  productId!: string;

  @Prop({ required: true, index: true })
  adjustmentNumber!: string;

  @Prop({ required: true })
  quantityDelta!: number;

  @Prop({ required: true, default: 0 })
  unitCost!: number;

  @Prop({ required: true })
  reason!: string;

  @Prop({ type: String })
  referenceId?: string | null;

  @Prop({ type: String })
  note?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type StockAdjustmentDocument = HydratedDocument<StockAdjustment>;
export const StockAdjustmentSchema = SchemaFactory.createForClass(StockAdjustment);

@Schema({ timestamps: true, collection: "customer_groups" })
export class CustomerGroup {
  @Prop({ type: String, index: true, unique: true, sparse: true, default: null })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  description?: string | null;

  @Prop({ type: String, default: null })
  color?: string | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type CustomerGroupDocument = HydratedDocument<CustomerGroup>;
export const CustomerGroupSchema = SchemaFactory.createForClass(CustomerGroup);

@Schema({ timestamps: true, collection: "customers" })
export class Customer {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ type: String, index: true, default: null })
  groupId?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String })
  phone?: string | null;

  @Prop({ type: String })
  email?: string | null;

  @Prop({ type: String })
  notes?: string | null;

  @Prop({ required: true, default: 0 })
  creditLimit!: number;

  @Prop({ required: true, default: 0 })
  loyaltyPoints!: number;

  @Prop({ required: true, default: 0 })
  balance!: number;

  @Prop({ type: [Object], default: [] })
  attachments!: Array<{
    id: string;
    label: string;
    url: string;
    note?: string | null;
    addedAt: string | Date;
  }>;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);

@Schema({ timestamps: true, collection: "expenses" })
export class Expense {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ type: String })
  categoryId?: string | null;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  note!: string;

  @Prop({ required: true })
  expenseDate!: Date;

  @Prop({ type: String })
  recordedById?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);

@Schema({ timestamps: true, collection: "bank_accounts" })
export class BankAccount {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  bankName!: string;

  @Prop({ required: true })
  accountName!: string;

  @Prop({ type: String, default: null })
  accountNumber?: string | null;

  @Prop({ required: true, default: "KES" })
  currency!: string;

  @Prop({ required: true, default: 0 })
  openingBalance!: number;

  @Prop({ required: true, default: 0 })
  currentBalance!: number;

  @Prop({ default: false })
  isPrimary!: boolean;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type BankAccountDocument = HydratedDocument<BankAccount>;
export const BankAccountSchema = SchemaFactory.createForClass(BankAccount);

@Schema({ timestamps: true, collection: "petty_cash_entries" })
export class PettyCashEntry {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, enum: ["in", "out"] })
  direction!: "in" | "out";

  @Prop({ type: String, default: null })
  category?: string | null;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ type: String, default: null })
  recordedById?: string | null;

  @Prop({ required: true })
  entryDate!: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type PettyCashEntryDocument = HydratedDocument<PettyCashEntry>;
export const PettyCashEntrySchema = SchemaFactory.createForClass(PettyCashEntry);

@Schema({ timestamps: true, collection: "credit_notes" })
export class CreditNote {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ required: true })
  reference!: string;

  @Prop({ type: String, default: null })
  relatedSaleId?: string | null;

  @Prop({ type: String, default: null })
  customerId?: string | null;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  reason!: string;

  @Prop({ type: String, default: null })
  note?: string | null;

  @Prop({ required: true, enum: ["draft", "issued", "void"], default: "draft" })
  status!: "draft" | "issued" | "void";

  @Prop({ required: true })
  creditDate!: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type CreditNoteDocument = HydratedDocument<CreditNote>;
export const CreditNoteSchema = SchemaFactory.createForClass(CreditNote);

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  lineDiscount: number;
  lineTotal: number;
}

@Schema({ timestamps: true, collection: "sales" })
export class Sale {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String })
  branchId?: string | null;

  @Prop({ type: String })
  customerId?: string | null;

  @Prop({ required: true, index: true })
  receiptNumber!: string;

  @Prop({ required: true, default: 0 })
  subtotal!: number;

  @Prop({ required: true, default: 0 })
  discountTotal!: number;

  @Prop({ required: true, default: 0 })
  taxTotal!: number;

  @Prop({ required: true, default: 0 })
  grandTotal!: number;

  @Prop({ required: true, default: 0 })
  amountPaid!: number;

  @Prop({ required: true, default: 0 })
  balanceDue!: number;

  @Prop({ required: true })
  paymentStatus!: PaymentStatus;

  @Prop({ required: true })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String })
  cashierId?: string | null;

  @Prop({ type: String })
  notes?: string | null;

  @Prop({ type: Array, default: [] })
  items!: SaleItem[];

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type SaleDocument = HydratedDocument<Sale>;
export const SaleSchema = SchemaFactory.createForClass(Sale);

@Schema({ timestamps: true, collection: "payments" })
export class Payment {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ type: String, index: true, default: null })
  customerId?: string | null;

  @Prop({ type: String })
  saleId?: string | null;

  @Prop({ type: String })
  debtPaymentId?: string | null;

  @Prop({ required: true })
  method!: PaymentMethod;

  @Prop({ required: true })
  status!: PaymentStatus;

  @Prop({ required: true })
  amount!: number;

  @Prop({ type: String })
  reference?: string | null;

  @Prop({ type: String })
  note?: string | null;

  @Prop({ type: String })
  provider?: string | null;

  @Prop({ type: Date })
  reconciledAt?: Date | null;
}
export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ timestamps: true, collection: "stock_movements" })
export class StockMovement {
  @Prop({ type: String, index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ required: true, index: true })
  productId!: string;

  @Prop({ required: true })
  referenceType!: "sale" | "purchase" | "adjustment" | "restock" | "refund";

  @Prop({ required: true })
  referenceId!: string;

  @Prop({ required: true })
  quantityDelta!: number;

  @Prop({ required: true })
  unitCost!: number;

  @Prop({ type: String })
  note?: string | null;
}
export type StockMovementDocument = HydratedDocument<StockMovement>;
export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

@Schema({ timestamps: true, collection: "sync_events" })
export class SyncEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId!: string;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  deviceId!: string;

  @Prop({ required: true })
  entityType!: string;

  @Prop({ required: true })
  entityId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true, default: "pending" })
  status!: "pending" | "sent" | "failed" | "applied";

  @Prop({ required: true, default: 0 })
  retryCount!: number;

  @Prop({ type: String })
  lastError?: string | null;
}
export type SyncEventDocument = HydratedDocument<SyncEvent>;
export const SyncEventSchema = SchemaFactory.createForClass(SyncEvent);

@Schema({ timestamps: true, collection: "sync_checkpoints" })
export class SyncCheckpoint {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  deviceId!: string;

  @Prop({ type: Date })
  lastPulledAt?: Date | null;

  @Prop({ type: Date })
  lastPushedAt?: Date | null;

  @Prop({ type: String })
  serverCursor?: string | null;
}
export type SyncCheckpointDocument = HydratedDocument<SyncCheckpoint>;
export const SyncCheckpointSchema = SchemaFactory.createForClass(SyncCheckpoint);

@Schema({ timestamps: true, collection: "subscription_plans" })
export class SubscriptionPlan {
  @Prop({ required: true, unique: true })
  code!: PlanTier;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  monthlyPrice!: number;

  @Prop({ default: true })
  active!: boolean;
}
export type SubscriptionPlanDocument = HydratedDocument<SubscriptionPlan>;
export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);

@Schema({ timestamps: true, collection: "subscriptions" })
export class Subscription {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, ref: "SubscriptionPlan" })
  planCode!: PlanTier;

  @Prop({ required: true })
  status!: "trial" | "active" | "past_due" | "suspended";

  @Prop({ type: Date })
  trialEndsAt?: Date | null;

  @Prop({ type: Date })
  expiresAt?: Date | null;

  @Prop({ type: Date })
  graceEndsAt?: Date | null;
}
export type SubscriptionDocument = HydratedDocument<Subscription>;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

@Schema({ timestamps: true, collection: "webhook_logs" })
export class WebhookLog {
  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  eventType!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true, default: "received" })
  status!: "received" | "processed" | "failed";

  @Prop({ type: String })
  error?: string | null;
}
export type WebhookLogDocument = HydratedDocument<WebhookLog>;
export const WebhookLogSchema = SchemaFactory.createForClass(WebhookLog);

@Schema({ timestamps: true, collection: "payment_reconciliation_logs" })
export class PaymentReconciliationLog {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String })
  paymentId?: string | null;

  @Prop({ required: true })
  reference!: string;

  @Prop({ required: true })
  status!: "matched" | "pending" | "manual" | "failed";

  @Prop({ type: Object })
  payload?: Record<string, unknown> | null;
}
export type PaymentReconciliationLogDocument = HydratedDocument<PaymentReconciliationLog>;
export const PaymentReconciliationLogSchema = SchemaFactory.createForClass(PaymentReconciliationLog);

@Schema({ timestamps: true, collection: "audit_logs" })
export class AuditLog {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String })
  actorId?: string | null;

  @Prop({ required: true })
  entityType!: string;

  @Prop({ required: true })
  entityId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;
}
export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

@Schema({ timestamps: true, collection: "notifications" })
export class BusinessNotification {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null, index: true })
  audienceUserId?: string | null;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, enum: ["low", "normal", "high", "critical"], default: "normal" })
  priority!: "low" | "normal" | "high" | "critical";

  @Prop({ type: String, default: null })
  routeName?: string | null;

  @Prop({ type: Object, default: null })
  routeParams?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  metadata?: Record<string, unknown> | null;

  @Prop({ type: String, default: null, index: true })
  dedupeKey?: string | null;

  @Prop({ type: Date, default: null })
  readAt?: Date | null;

  @Prop({ required: true })
  sentAt!: Date;
}
export type BusinessNotificationDocument = HydratedDocument<BusinessNotification>;
export const BusinessNotificationSchema = SchemaFactory.createForClass(BusinessNotification);
BusinessNotificationSchema.index({ businessId: 1, createdAt: -1 });
BusinessNotificationSchema.index({ businessId: 1, dedupeKey: 1 }, { unique: true, sparse: true });

export const businessSchemas = buildBusinessSchemas({
  Business: { name: Business.name, schema: BusinessSchema },
  Branch: { name: Branch.name, schema: BranchSchema },
  User: { name: User.name, schema: UserSchema },
  Device: { name: Device.name, schema: DeviceSchema }
});

export const catalogSchemas = buildCatalogSchemas({
  Category: { name: Category.name, schema: CategorySchema },
  Brand: { name: Brand.name, schema: BrandSchema },
  Product: { name: Product.name, schema: ProductSchema },
  CustomerGroup: { name: CustomerGroup.name, schema: CustomerGroupSchema },
  Customer: { name: Customer.name, schema: CustomerSchema },
  Supplier: { name: Supplier.name, schema: SupplierSchema },
  PurchaseOrder: { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
  StockTransfer: { name: StockTransfer.name, schema: StockTransferSchema },
  StockAdjustment: { name: StockAdjustment.name, schema: StockAdjustmentSchema }
});

export const supplierSchemas = buildSuppliersSchemas({
  SupplierCategory: { name: SupplierCategory.name, schema: SupplierCategorySchema },
  SupplierContact: { name: SupplierContact.name, schema: SupplierContactSchema },
  SupplierDocument: { name: SupplierFile.name, schema: SupplierFileSchema },
  SupplierPayment: { name: SupplierPayment.name, schema: SupplierPaymentSchema }
});

export const financeSchemas = buildFinanceSchemas({
  Expense: { name: Expense.name, schema: ExpenseSchema },
  BankAccount: { name: BankAccount.name, schema: BankAccountSchema },
  PettyCashEntry: { name: PettyCashEntry.name, schema: PettyCashEntrySchema },
  CreditNote: { name: CreditNote.name, schema: CreditNoteSchema },
  Sale: { name: Sale.name, schema: SaleSchema },
  Payment: { name: Payment.name, schema: PaymentSchema },
  StockMovement: { name: StockMovement.name, schema: StockMovementSchema }
});

export const syncSchemas = buildSyncSchemas({
  SyncEvent: { name: SyncEvent.name, schema: SyncEventSchema },
  SyncCheckpoint: { name: SyncCheckpoint.name, schema: SyncCheckpointSchema }
});

export const subscriptionSchemas = buildSubscriptionSchemas({
  SubscriptionPlan: { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
  Subscription: { name: Subscription.name, schema: SubscriptionSchema }
});

export const opsSchemas = buildOpsSchemas({
  WebhookLog: { name: WebhookLog.name, schema: WebhookLogSchema },
  PaymentReconciliationLog: { name: PaymentReconciliationLog.name, schema: PaymentReconciliationLogSchema },
  AuditLog: { name: AuditLog.name, schema: AuditLogSchema },
  BusinessNotification: { name: BusinessNotification.name, schema: BusinessNotificationSchema }
});

export const allSchemas = [...businessSchemas, ...catalogSchemas, ...financeSchemas, ...syncSchemas, ...subscriptionSchemas, ...opsSchemas] as const;

export type MongoId = Types.ObjectId;
