import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type EmailTemplate = "welcome" | "password_reset" | "security_alert" | "invitation" | "receipt" | "invoice" | "payment" | "subscription" | "report" | "admin_notice";
export type EmailDeliveryState = "pending" | "processing" | "retrying" | "sent" | "failed";

@Schema({ timestamps: true, collection: "email_outbox" })
export class EmailOutbox {
  @Prop({ required: true, unique: true, index: true }) idempotencyKey!: string;
  @Prop({ required: true, index: true }) to!: string;
  @Prop({ required: true, enum: ["welcome", "password_reset", "security_alert", "invitation", "receipt", "invoice", "payment", "subscription", "report", "admin_notice"] }) template!: EmailTemplate;
  @Prop({ type: Object, required: true, default: {} }) variables!: Record<string, unknown>;
  @Prop({ type: String, default: null, index: true }) businessId?: string | null;
  @Prop({ required: true, enum: ["pending", "processing", "retrying", "sent", "failed"], default: "pending", index: true }) state!: EmailDeliveryState;
  @Prop({ type: Number, default: 0 }) attempts!: number;
  @Prop({ type: Date, default: Date.now, index: true }) availableAt!: Date;
  @Prop({ type: Date, default: null }) sentAt?: Date | null;
  @Prop({ type: Date, default: null, index: true }) lockedAt?: Date | null;
  @Prop({ type: String, default: null }) lastError?: string | null;
  @Prop({ type: Date, default: null, index: { expireAfterSeconds: 0 } }) expiresAt?: Date | null;
}

export type EmailOutboxDocument = HydratedDocument<EmailOutbox>;
export const EmailOutboxSchema = SchemaFactory.createForClass(EmailOutbox);
EmailOutboxSchema.index({ state: 1, availableAt: 1 });
