import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { Schema as MongooseSchema } from "mongoose";

export type CommerceProductSource = "INTERNAL" | "VENDOR" | "IMPORTED";
export type CommerceProductVisibility = "PRIVATE" | "INTERNAL" | "EXTERNAL" | "MARKETPLACE";
export type VendorProductAvailability = "available" | "unavailable" | "backorder" | "discontinued";
export type VendorProductStatus = "active" | "inactive";
export type ReservationStatus = "RESERVED" | "RELEASED" | "COMMITTED" | "EXPIRED";

@Schema({ timestamps: true, collection: "vendor_products" })
export class VendorProduct {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  vendorId!: string;

  @Prop({ required: true, index: true })
  productId!: string;

  @Prop({ type: String, default: null })
  branchId?: string | null;

  @Prop({ type: String, default: null })
  vendorSku?: string | null;

  @Prop({ required: true, min: 0 })
  vendorCost!: number;

  @Prop({ required: true, default: "KES" })
  currency!: string;

  @Prop({ required: true, min: 1, default: 1 })
  minimumOrderQuantity!: number;

  @Prop({ required: true, min: 0, default: 0 })
  leadTimeDays!: number;

  @Prop({ type: String, required: true, enum: ["available", "unavailable", "backorder", "discontinued"], default: "available" })
  availability!: VendorProductAvailability;

  @Prop({ type: String, required: true, enum: ["active", "inactive"], default: "active" })
  status!: VendorProductStatus;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type VendorProductDocument = HydratedDocument<VendorProduct>;
export const VendorProductSchema = SchemaFactory.createForClass(VendorProduct);
VendorProductSchema.index({ businessId: 1, productId: 1, vendorId: 1, branchId: 1 }, { unique: true });
VendorProductSchema.index({ businessId: 1, vendorId: 1, status: 1 });

@Schema({ timestamps: true, collection: "commerce_inventory_reservations" })
export class InventoryReservation {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  productId!: string;

  @Prop({ required: true, index: true })
  branchId!: string;

  @Prop({ required: true, min: 0.000001 })
  quantity!: number;

  @Prop({ required: true })
  referenceType!: string;

  @Prop({ required: true, index: true })
  referenceId!: string;

  @Prop({ type: String, required: true, enum: ["RESERVED", "RELEASED", "COMMITTED", "EXPIRED"], default: "RESERVED" })
  status!: ReservationStatus;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: String, default: null, index: true })
  credentialId?: string | null;

  @Prop({ type: String, default: null })
  idempotencyKey?: string | null;

  @Prop({ type: Date, default: null })
  releasedAt?: Date | null;

  @Prop({ type: Date, default: null })
  committedAt?: Date | null;
}
export type InventoryReservationDocument = HydratedDocument<InventoryReservation>;
export const InventoryReservationSchema = SchemaFactory.createForClass(InventoryReservation);
InventoryReservationSchema.index({ businessId: 1, referenceType: 1, referenceId: 1, status: 1 });
InventoryReservationSchema.index({ businessId: 1, expiresAt: 1, status: 1 });

@Schema({ _id: false })
export class CommerceOrderItem {
  @Prop({ required: true })
  productId!: string;

  @Prop({ required: true })
  productNameSnapshot!: string;

  @Prop({ type: String, default: null })
  skuSnapshot?: string | null;

  @Prop({ required: true, min: 0.000001 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ type: Number, default: null, min: 0 })
  vendorCostSnapshot?: number | null;

  @Prop({ required: true, default: 0, min: 0 })
  discount!: number;

  @Prop({ required: true, default: 0, min: 0 })
  tax!: number;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ type: String, default: null })
  vendorId?: string | null;
}
export const CommerceOrderItemSchema = SchemaFactory.createForClass(CommerceOrderItem);

@Schema({ _id: false })
export class VendorFulfillment {
  @Prop({ required: true })
  vendorId!: string;

  @Prop({ type: [String], default: [] })
  itemProductIds!: string[];

  @Prop({ type: String, required: true, enum: ["PENDING", "ACCEPTED", "PROCESSING", "READY", "SHIPPED", "DELIVERED", "CANCELLED"], default: "PENDING" })
  status!: "PENDING" | "ACCEPTED" | "PROCESSING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED";

  @Prop({ type: String, default: null })
  externalReference?: string | null;
}
export const VendorFulfillmentSchema = SchemaFactory.createForClass(VendorFulfillment);

@Schema({ timestamps: true, collection: "commerce_orders" })
export class CommerceOrder {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  orderNumber!: string;

  @Prop({ type: String, required: true, enum: ["INTERNAL", "EXTERNAL_API", "MARKETPLACE"], default: "EXTERNAL_API" })
  source!: "INTERNAL" | "EXTERNAL_API" | "MARKETPLACE";

  @Prop({ type: String, default: null, index: true })
  externalReference?: string | null;

  @Prop({ type: String, default: null })
  customerId?: string | null;

  @Prop({ type: Object, default: null })
  customerSnapshot?: Record<string, unknown> | null;

  @Prop({ type: String, default: null, index: true })
  branchId?: string | null;

  @Prop({ type: [CommerceOrderItemSchema], default: [] })
  items!: CommerceOrderItem[];

  @Prop({ required: true, min: 0, default: 0 })
  subtotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  discountTotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  taxTotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  total!: number;

  @Prop({ required: true, default: "KES" })
  currency!: string;

  @Prop({ type: String, required: true, enum: ["PENDING", "AUTHORIZED", "PAID", "FAILED", "REFUNDED"], default: "PENDING" })
  paymentStatus!: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "REFUNDED";

  @Prop({ type: String, required: true, enum: ["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"], default: "UNFULFILLED" })
  fulfillmentStatus!: "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CANCELLED";

  @Prop({ type: String, required: true, enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"], default: "PENDING" })
  orderStatus!: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

  @Prop({ type: [VendorFulfillmentSchema], default: [] })
  fulfillments!: VendorFulfillment[];

  @Prop({ type: String, default: null, index: true })
  credentialId?: string | null;

  @Prop({ type: String, default: null })
  idempotencyKey?: string | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}
export type CommerceOrderDocument = HydratedDocument<CommerceOrder>;
export const CommerceOrderSchema = SchemaFactory.createForClass(CommerceOrder);
CommerceOrderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true });
CommerceOrderSchema.index({ businessId: 1, createdAt: -1 });
CommerceOrderSchema.index({ businessId: 1, externalReference: 1 }, { sparse: true });

@Schema({ timestamps: true, collection: "commerce_api_credentials" })
export class CommerceApiCredential {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true })
  keyId!: string;

  @Prop({ required: true })
  keyPrefix!: string;

  @Prop({ required: true, select: false })
  secretHash!: string;

  @Prop({ required: true, type: [String] })
  scopes!: string[];

  @Prop({ type: [String], default: [] })
  branchIds!: string[];

  @Prop({ type: String, required: true, enum: ["ACTIVE", "REVOKED"], default: "ACTIVE" })
  status!: "ACTIVE" | "REVOKED";

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastUsedAt?: Date | null;

  @Prop({ required: true, min: 1, default: 60 })
  rateLimitPerMinute!: number;

  @Prop({ required: true, default: 1 })
  secretVersion!: number;
}
export type CommerceApiCredentialDocument = HydratedDocument<CommerceApiCredential>;
export const CommerceApiCredentialSchema = SchemaFactory.createForClass(CommerceApiCredential);
CommerceApiCredentialSchema.index({ businessId: 1, status: 1 });

@Schema({ timestamps: true, collection: "commerce_idempotency_keys" })
export class CommerceIdempotencyRecord {
  @Prop({ required: true })
  businessId!: string;

  @Prop({ required: true })
  credentialId!: string;

  @Prop({ required: true })
  operation!: string;

  @Prop({ required: true })
  key!: string;

  @Prop({ required: true })
  requestHash!: string;

  @Prop({ type: String, required: true, enum: ["PENDING", "COMPLETED"], default: "PENDING" })
  status!: "PENDING" | "COMPLETED";

  @Prop({ type: Number, default: null })
  responseStatus?: number | null;

  @Prop({ type: Object, default: null })
  responseBody?: Record<string, unknown> | null;

  @Prop({ required: true })
  expiresAt!: Date;
}
export type CommerceIdempotencyRecordDocument = HydratedDocument<CommerceIdempotencyRecord>;
export const CommerceIdempotencyRecordSchema = SchemaFactory.createForClass(CommerceIdempotencyRecord);
CommerceIdempotencyRecordSchema.index({ businessId: 1, credentialId: 1, operation: 1, key: 1 }, { unique: true });
CommerceIdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

@Schema({ timestamps: true, collection: "commerce_webhook_endpoints" })
export class CommerceWebhookEndpoint {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true, type: [String] })
  events!: string[];

  @Prop({ required: true, select: false })
  secretCiphertext!: string;

  @Prop({ required: true, default: 1 })
  secretVersion!: number;

  @Prop({ type: String, required: true, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE" })
  status!: "ACTIVE" | "DISABLED";

  @Prop({ type: Date, default: null })
  disabledAt?: Date | null;
}
export type CommerceWebhookEndpointDocument = HydratedDocument<CommerceWebhookEndpoint>;
export const CommerceWebhookEndpointSchema = SchemaFactory.createForClass(CommerceWebhookEndpoint);
CommerceWebhookEndpointSchema.index({ businessId: 1, status: 1 });

@Schema({ timestamps: true, collection: "commerce_webhook_deliveries" })
export class CommerceWebhookDelivery {
  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ required: true, index: true })
  endpointId!: string;

  @Prop({ required: true, index: true })
  eventId!: string;

  @Prop({ required: true })
  eventType!: string;

  @Prop({ required: true, type: Object })
  payload!: Record<string, unknown>;

  @Prop({ type: String, required: true, enum: ["PENDING", "DELIVERED", "FAILED"], default: "PENDING" })
  status!: "PENDING" | "DELIVERED" | "FAILED";

  @Prop({ required: true, default: 0 })
  attemptCount!: number;

  @Prop({ type: Number, default: null })
  lastResponseStatus?: number | null;

  @Prop({ type: String, default: null })
  lastError?: string | null;

  @Prop({ type: Date, default: null })
  nextAttemptAt?: Date | null;

  @Prop({ type: Date, default: null })
  deliveredAt?: Date | null;
}
export type CommerceWebhookDeliveryDocument = HydratedDocument<CommerceWebhookDelivery>;
export const CommerceWebhookDeliverySchema = SchemaFactory.createForClass(CommerceWebhookDelivery);
CommerceWebhookDeliverySchema.index({ endpointId: 1, status: 1, nextAttemptAt: 1 });

type SchemaEntry = { name: string; schema: MongooseSchema };

export function buildCommerceSchemas(input: {
  VendorProduct: SchemaEntry;
  InventoryReservation: SchemaEntry;
  CommerceOrder: SchemaEntry;
  CommerceApiCredential: SchemaEntry;
  CommerceIdempotencyRecord: SchemaEntry;
  CommerceWebhookEndpoint: SchemaEntry;
  CommerceWebhookDelivery: SchemaEntry;
}) {
  return [
    input.VendorProduct,
    input.InventoryReservation,
    input.CommerceOrder,
    input.CommerceApiCredential,
    input.CommerceIdempotencyRecord,
    input.CommerceWebhookEndpoint,
    input.CommerceWebhookDelivery
  ] as const;
}
