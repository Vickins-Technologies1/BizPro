import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "platform_admin_audit_logs" })
export class PlatformAdminAuditLog {
  @Prop({ required: true, index: true }) actorId!: string;
  @Prop({ required: true }) actorEmail!: string;
  @Prop({ required: true }) actorRole!: string;
  @Prop({ required: true, index: true }) action!: string;
  @Prop({ required: true, index: true }) targetType!: string;
  @Prop({ type: String, default: null, index: true }) targetId?: string | null;
  @Prop({ type: String, default: null, index: true }) requestId?: string | null;
  @Prop({ type: Object, default: {} }) metadata!: Record<string, unknown>;
}
export type PlatformAdminAuditLogDocument = HydratedDocument<PlatformAdminAuditLog>;
export const PlatformAdminAuditLogSchema = SchemaFactory.createForClass(PlatformAdminAuditLog);
PlatformAdminAuditLogSchema.index({ createdAt: -1 });

@Schema({ timestamps: true, collection: "platform_admin_login_events" })
export class PlatformAdminLoginEvent {
  @Prop({ type: String, default: null, index: true }) adminId?: string | null;
  @Prop({ required: true, index: true }) email!: string;
  @Prop({ required: true, enum: ["success", "failure"] }) outcome!: "success" | "failure";
  @Prop({ required: true }) reason!: string;
  @Prop({ type: String, default: null }) ipHash?: string | null;
  @Prop({ type: String, default: null }) userAgent?: string | null;
}
export type PlatformAdminLoginEventDocument = HydratedDocument<PlatformAdminLoginEvent>;
export const PlatformAdminLoginEventSchema = SchemaFactory.createForClass(PlatformAdminLoginEvent);
PlatformAdminLoginEventSchema.index({ email: 1, createdAt: -1 });
PlatformAdminLoginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31_536_000 });

export type PlatformErrorSeverity = "critical" | "high" | "medium" | "low";
export type PlatformErrorSource = "api" | "mobile" | "admin" | "database" | "sync" | "background" | "payment" | "integration";
export type PlatformIncidentStatus = "open" | "investigating" | "resolved";

@Schema({ timestamps: true, collection: "platform_system_errors" })
export class PlatformSystemError {
  @Prop({ required: true, unique: true, index: true }) errorId!: string;
  @Prop({ required: true, index: true }) fingerprint!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ required: true }) message!: string;
  @Prop({ required: true, enum: ["critical", "high", "medium", "low"], index: true }) severity!: PlatformErrorSeverity;
  @Prop({ required: true, enum: ["api", "mobile", "admin", "database", "sync", "background", "payment", "integration"], index: true }) source!: PlatformErrorSource;
  @Prop({ required: true, default: "production", index: true }) environment!: string;
  @Prop({ type: String, default: null, index: true }) module?: string | null;
  @Prop({ type: String, default: null }) endpoint?: string | null;
  @Prop({ type: Number, default: null }) httpStatus?: number | null;
  @Prop({ type: String, default: null }) stackTrace?: string | null;
  @Prop({ type: String, default: null, index: true }) businessId?: string | null;
  @Prop({ type: String, default: null, index: true }) deviceId?: string | null;
  @Prop({ type: String, default: null }) appVersion?: string | null;
  @Prop({ type: String, default: null, index: true }) requestId?: string | null;
  @Prop({ required: true, default: 1 }) occurrenceCount!: number;
  @Prop({ required: true, default: Date.now, index: true }) firstOccurrence!: Date;
  @Prop({ required: true, default: Date.now }) lastOccurrence!: Date;
  @Prop({ required: true, enum: ["open", "investigating", "resolved"], default: "open", index: true }) status!: PlatformIncidentStatus;
  @Prop({ type: String, default: null, index: true }) assignedTo?: string | null;
  @Prop({ type: String, default: null }) resolutionComment?: string | null;
  @Prop({ type: [Object], default: [] }) internalNotes!: Array<{ adminId: string; email: string; body: string; createdAt: Date }>;
}
export type PlatformSystemErrorDocument = HydratedDocument<PlatformSystemError>;
export const PlatformSystemErrorSchema = SchemaFactory.createForClass(PlatformSystemError);
PlatformSystemErrorSchema.index({ fingerprint: 1, environment: 1 }, { unique: true });
PlatformSystemErrorSchema.index({ status: 1, severity: 1, lastOccurrence: -1 });
PlatformSystemErrorSchema.index({ lastOccurrence: 1 }, { expireAfterSeconds: 15_552_000 });

@Schema({ timestamps: true, collection: "platform_request_metrics" })
export class PlatformRequestMetric {
  @Prop({ required: true, index: true }) route!: string;
  @Prop({ required: true }) method!: string;
  @Prop({ required: true, index: true }) bucketStart!: Date;
  @Prop({ required: true, default: 0 }) requestCount!: number;
  @Prop({ required: true, default: 0 }) errorCount!: number;
  @Prop({ required: true, default: 0 }) totalDurationMs!: number;
  @Prop({ required: true, default: 0 }) maxDurationMs!: number;
  @Prop({ type: Number, default: null }) lastStatusCode?: number | null;
}
export type PlatformRequestMetricDocument = HydratedDocument<PlatformRequestMetric>;
export const PlatformRequestMetricSchema = SchemaFactory.createForClass(PlatformRequestMetric);
PlatformRequestMetricSchema.index({ route: 1, method: 1, bucketStart: 1 }, { unique: true });
PlatformRequestMetricSchema.index({ bucketStart: -1 });
PlatformRequestMetricSchema.index({ bucketStart: 1 }, { expireAfterSeconds: 7_776_000 });

@Schema({ timestamps: true, collection: "platform_settings" })
export class PlatformSettings {
  @Prop({ required: true, unique: true, default: "platform" }) key!: string;
  @Prop({ default: false }) maintenanceMode!: boolean;
  @Prop({ type: String, default: null }) maintenanceMessage?: string | null;
  @Prop({ type: String, default: null }) latestAppVersion?: string | null;
  @Prop({ type: String, default: null }) minimumAppVersion?: string | null;
  @Prop({ type: String, default: null }) announcement?: string | null;
  @Prop({ type: Object, default: {} }) featureFlags!: Record<string, boolean>;
  @Prop({ type: Object, default: {} }) operationalLimits!: Record<string, number>;
  @Prop({ type: String, default: null }) updatedBy?: string | null;
}
export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;
export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);

export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";

@Schema({ timestamps: true, collection: "platform_support_tickets" })
export class PlatformSupportTicket {
  @Prop({ required: true, index: true }) ticketNumber!: string;
  @Prop({ type: String, default: null, index: true }) businessId?: string | null;
  @Prop({ required: true }) contactName!: string;
  @Prop({ type: String, default: null }) contactEmail?: string | null;
  @Prop({ required: true, enum: ["technical", "payment", "subscription", "complaint", "other"], index: true }) category!: string;
  @Prop({ required: true, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true }) priority!: string;
  @Prop({ required: true, enum: ["open", "in_progress", "waiting_customer", "resolved", "closed"], default: "open", index: true }) status!: TicketStatus;
  @Prop({ type: String, default: null, index: true }) assignedTo?: string | null;
  @Prop({ required: true }) subject!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ type: [Object], default: [] }) internalNotes!: Array<{ adminId: string; email: string; body: string; createdAt: Date }>;
  @Prop({ type: [Object], default: [] }) history!: Array<{ actorId: string; action: string; createdAt: Date; details?: string }>;
}
export type PlatformSupportTicketDocument = HydratedDocument<PlatformSupportTicket>;
export const PlatformSupportTicketSchema = SchemaFactory.createForClass(PlatformSupportTicket);
PlatformSupportTicketSchema.index({ createdAt: -1 });
PlatformSupportTicketSchema.index({ businessId: 1, status: 1, createdAt: -1 });
