import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import type { BusinessType, PlanTier, UserRole, PaymentMethod, PaymentStatus } from "@vbo/shared";

@Schema({ timestamps: true, collection: "businesses" })
export class Business {
  @Prop({ index: true, unique: true, sparse: true, default: null })
  externalId?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  slug!: string;

  @Prop({ required: true, enum: ["retail_shop", "boutique", "cosmetics", "accessories", "wines_spirits", "hardware", "agrovet", "restaurant"] satisfies BusinessType[] })
  businessType!: BusinessType;

  @Prop({ required: true, default: "KES" })
  currency!: string;

  @Prop({ required: true, enum: ["lite", "standard", "pro"] satisfies PlanTier[] })
  planTier!: PlanTier;

  @Prop({ required: true, default: "trial" })
  billingStatus!: "trial" | "active" | "past_due" | "suspended";

  @Prop()
  graceEndsAt?: Date | null;

  @Prop({ default: null })
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

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type BranchDocument = HydratedDocument<Branch>;
export const BranchSchema = SchemaFactory.createForClass(Branch);

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop()
  branchId?: string | null;

  @Prop({ required: true })
  fullName!: string;

  @Prop()
  phone?: string | null;

  @Prop()
  passwordHash?: string | null;

  @Prop()
  pinHash?: string | null;

  @Prop({ required: true, enum: ["owner", "manager", "cashier"] satisfies UserRole[] })
  role!: UserRole;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

@Schema({ timestamps: true, collection: "devices" })
export class Device {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  deviceName!: string;

  @Prop({ required: true, enum: ["android", "ios", "web"] })
  platform!: "android" | "ios" | "web";

  @Prop({ default: false })
  trusted!: boolean;

  @Prop()
  lastSeenAt?: Date | null;

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type DeviceDocument = HydratedDocument<Device>;
export const DeviceSchema = SchemaFactory.createForClass(Device);

@Schema({ timestamps: true, collection: "categories" })
export class Category {
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  color?: string | null;

  @Prop({ default: 0 })
  sortOrder!: number;

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

@Schema({ timestamps: true, collection: "products" })
export class Product {
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop()
  categoryId?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop()
  sku?: string | null;

  @Prop()
  barcode?: string | null;

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

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

@Schema({ timestamps: true, collection: "customers" })
export class Customer {
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  phone?: string | null;

  @Prop()
  email?: string | null;

  @Prop()
  notes?: string | null;

  @Prop({ required: true, default: 0 })
  balance!: number;

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);

@Schema({ timestamps: true, collection: "expenses" })
export class Expense {
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop()
  categoryId?: string | null;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  note!: string;

  @Prop({ required: true })
  expenseDate!: Date;

  @Prop()
  recordedById?: string | null;

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);

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
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop()
  branchId?: string | null;

  @Prop()
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

  @Prop()
  cashierId?: string | null;

  @Prop()
  notes?: string | null;

  @Prop({ type: Array, default: [] })
  items!: SaleItem[];

  @Prop({ default: null })
  deletedAt?: Date | null;
}
export type SaleDocument = HydratedDocument<Sale>;
export const SaleSchema = SchemaFactory.createForClass(Sale);

@Schema({ timestamps: true, collection: "payments" })
export class Payment {
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ index: true, default: null })
  customerId?: string | null;

  @Prop()
  saleId?: string | null;

  @Prop()
  debtPaymentId?: string | null;

  @Prop({ required: true })
  method!: PaymentMethod;

  @Prop({ required: true })
  status!: PaymentStatus;

  @Prop({ required: true })
  amount!: number;

  @Prop()
  reference?: string | null;

  @Prop()
  note?: string | null;

  @Prop()
  provider?: string | null;

  @Prop()
  reconciledAt?: Date | null;
}
export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ timestamps: true, collection: "stock_movements" })
export class StockMovement {
  @Prop({ index: true })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

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

  @Prop()
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

  @Prop()
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

  @Prop()
  lastPulledAt?: Date | null;

  @Prop()
  lastPushedAt?: Date | null;

  @Prop()
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

  @Prop()
  trialEndsAt?: Date | null;

  @Prop()
  expiresAt?: Date | null;

  @Prop()
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

  @Prop()
  error?: string | null;
}
export type WebhookLogDocument = HydratedDocument<WebhookLog>;
export const WebhookLogSchema = SchemaFactory.createForClass(WebhookLog);

@Schema({ timestamps: true, collection: "payment_reconciliation_logs" })
export class PaymentReconciliationLog {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop()
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

  @Prop()
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

export const allSchemas = [
  { name: Business.name, schema: BusinessSchema },
  { name: Branch.name, schema: BranchSchema },
  { name: User.name, schema: UserSchema },
  { name: Device.name, schema: DeviceSchema },
  { name: Category.name, schema: CategorySchema },
  { name: Product.name, schema: ProductSchema },
  { name: Customer.name, schema: CustomerSchema },
  { name: Expense.name, schema: ExpenseSchema },
  { name: Sale.name, schema: SaleSchema },
  { name: Payment.name, schema: PaymentSchema },
  { name: StockMovement.name, schema: StockMovementSchema },
  { name: SyncEvent.name, schema: SyncEventSchema },
  { name: SyncCheckpoint.name, schema: SyncCheckpointSchema },
  { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
  { name: Subscription.name, schema: SubscriptionSchema },
  { name: WebhookLog.name, schema: WebhookLogSchema },
  { name: PaymentReconciliationLog.name, schema: PaymentReconciliationLogSchema },
  { name: AuditLog.name, schema: AuditLogSchema }
] as const;

export type MongoId = Types.ObjectId;
