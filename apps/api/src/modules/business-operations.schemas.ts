import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class BusinessOperationItem {
  @Prop({ type: String, default: null })
  productId?: string | null;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;
}

export const BusinessOperationItemSchema = SchemaFactory.createForClass(BusinessOperationItem);

@Schema({ timestamps: true, collection: "business_operations" })
export class BusinessOperation {
  @Prop({ type: String, index: true, default: null })
  externalId?: string | null;

  @Prop({ required: true, index: true })
  businessId!: string;

  @Prop({ type: String, default: null, index: true })
  branchId?: string | null;

  @Prop({ required: true, enum: ["order", "appointment", "work_order"], index: true })
  kind!: "order" | "appointment" | "work_order";

  @Prop({ required: true, enum: ["draft", "open", "preparing", "ready", "confirmed", "in_progress", "completed", "cancelled"], index: true })
  status!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: String, default: null })
  customerId?: string | null;

  @Prop({ type: String, default: null })
  staffId?: string | null;

  @Prop({ type: Date, default: null, index: true })
  scheduledAt?: Date | null;

  @Prop({ type: Number, default: null })
  durationMinutes?: number | null;

  @Prop({ type: String, default: null })
  tableName?: string | null;

  @Prop({ type: String, default: null })
  vehiclePlate?: string | null;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: [BusinessOperationItemSchema], default: [] })
  items!: BusinessOperationItem[];

  @Prop({ type: Number, default: 0 })
  total!: number;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export type BusinessOperationDocument = HydratedDocument<BusinessOperation>;
export const BusinessOperationSchema = SchemaFactory.createForClass(BusinessOperation);
BusinessOperationSchema.index({ businessId: 1, externalId: 1 }, { unique: true, sparse: true });
BusinessOperationSchema.index({ businessId: 1, kind: 1, status: 1, scheduledAt: 1 });
