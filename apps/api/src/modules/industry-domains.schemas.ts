import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

class TenantRecord {
  @Prop({ type: String, index: true, default: null }) externalId?: string | null;
  @Prop({ required: true, index: true }) businessId!: string;
  @Prop({ type: String, index: true, default: null }) branchId?: string | null;
  @Prop({ type: Date, default: null }) deletedAt?: Date | null;
}

@Schema({ timestamps: true, collection: "room_types" })
export class RoomType extends TenantRecord {
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) description?: string | null;
  @Prop({ required: true, min: 1 }) capacity!: number;
  @Prop({ required: true, min: 0 }) baseRate!: number;
  @Prop({ type: String, enum: ["active", "inactive"], default: "active", index: true }) status!: string;
  @Prop({ type: [String], default: [] }) amenities!: string[];
}
export type RoomTypeDocument = HydratedDocument<RoomType>;
export const RoomTypeSchema = SchemaFactory.createForClass(RoomType);
RoomTypeSchema.index({ businessId: 1, externalId: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true, collection: "rooms" })
export class Room extends TenantRecord {
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) roomTypeId?: string | null;
  @Prop({ type: String, default: null }) floor?: string | null;
  @Prop({ type: String, enum: ["available", "occupied", "reserved", "maintenance", "out_of_service"], default: "available", index: true }) status!: string;
  @Prop({ type: String, enum: ["clean", "dirty", "inspected", "out_of_order"], default: "clean" }) housekeepingStatus!: string;
  @Prop({ type: String, enum: ["operational", "maintenance", "out_of_service"], default: "operational" }) maintenanceStatus!: string;
  @Prop({ type: Boolean, default: true, index: true }) active!: boolean;
}
export type RoomDocument = HydratedDocument<Room>;
export const RoomSchema = SchemaFactory.createForClass(Room);
RoomSchema.index({ businessId: 1, externalId: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true, collection: "reservations" })
export class Reservation extends TenantRecord {
  @Prop({ required: true, index: true }) guestId!: string;
  @Prop({ required: true, index: true }) roomTypeId!: string;
  @Prop({ type: String, default: null, index: true }) roomId?: string | null;
  @Prop({ required: true, index: true }) arrivalDate!: Date;
  @Prop({ required: true, index: true }) departureDate!: Date;
  @Prop({ required: true, min: 1 }) guestCount!: number;
  @Prop({ required: true, min: 0 }) rate!: number;
  @Prop({ type: String, enum: ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"], default: "pending", index: true }) status!: string;
  @Prop({ type: String, default: null }) notes?: string | null;
}
export type ReservationDocument = HydratedDocument<Reservation>;
export const ReservationSchema = SchemaFactory.createForClass(Reservation);
ReservationSchema.index({ businessId: 1, roomId: 1, arrivalDate: 1, departureDate: 1, status: 1 });

@Schema({ timestamps: true, collection: "stays" })
export class Stay extends TenantRecord {
  @Prop({ required: true, index: true }) guestId!: string;
  @Prop({ required: true, index: true }) reservationId!: string;
  @Prop({ required: true, index: true }) roomId!: string;
  @Prop({ required: true }) checkInAt!: Date;
  @Prop({ required: true }) expectedCheckOutAt!: Date;
  @Prop({ type: Date, default: null }) checkOutAt?: Date | null;
  @Prop({ type: String, enum: ["active", "checked_out", "cancelled"], default: "active", index: true }) status!: string;
}
export type StayDocument = HydratedDocument<Stay>;
export const StaySchema = SchemaFactory.createForClass(Stay);

@Schema({ timestamps: true, collection: "room_charges" })
export class RoomCharge extends TenantRecord {
  @Prop({ required: true, index: true }) stayId!: string;
  @Prop({ required: true, index: true }) reservationId!: string;
  @Prop({ required: true, index: true }) roomId!: string;
  @Prop({ required: true }) chargeType!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ required: true, min: 0 }) quantity!: number;
  @Prop({ required: true, min: 0 }) unitAmount!: number;
  @Prop({ required: true, min: 0 }) total!: number;
  @Prop({ required: true }) chargeDate!: Date;
  @Prop({ type: String, default: null }) invoiceId?: string | null;
}
export type RoomChargeDocument = HydratedDocument<RoomCharge>;
export const RoomChargeSchema = SchemaFactory.createForClass(RoomCharge);
RoomChargeSchema.index({ businessId: 1, stayId: 1, chargeDate: -1 });

@Schema({ timestamps: true, collection: "patients" })
export class Patient extends TenantRecord {
  @Prop({ required: true, index: true }) patientNumber!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) phone?: string | null;
  @Prop({ type: String, default: null }) email?: string | null;
  @Prop({ type: String, default: null }) address?: string | null;
  @Prop({ type: Date, default: null }) dateOfBirth?: Date | null;
  @Prop({ type: String, default: null }) gender?: string | null;
  @Prop({ type: String, default: null }) emergencyContact?: string | null;
  @Prop({ type: String, enum: ["active", "inactive"], default: "active", index: true }) status!: string;
  @Prop({ type: String, default: null }) notes?: string | null;
}
export type PatientDocument = HydratedDocument<Patient>;
export const PatientSchema = SchemaFactory.createForClass(Patient);
PatientSchema.index({ businessId: 1, externalId: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true, collection: "visits" })
export class Visit extends TenantRecord {
  @Prop({ required: true, index: true }) patientId!: string;
  @Prop({ type: String, default: null }) appointmentId?: string | null;
  @Prop({ type: String, default: null }) providerId?: string | null;
  @Prop({ type: String, default: null }) serviceId?: string | null;
  @Prop({ type: String, enum: ["scheduled", "waiting", "in_progress", "completed", "cancelled"], default: "waiting", index: true }) status!: string;
  @Prop({ type: Date, default: null, index: true }) startedAt?: Date | null;
  @Prop({ type: Date, default: null }) completedAt?: Date | null;
  @Prop({ type: String, default: null }) notes?: string | null;
}
export type VisitDocument = HydratedDocument<Visit>;
export const VisitSchema = SchemaFactory.createForClass(Visit);
VisitSchema.index({ businessId: 1, patientId: 1, createdAt: -1 });

@Schema({ timestamps: true, collection: "matters" })
export class Matter extends TenantRecord {
  @Prop({ required: true, index: true }) clientId!: string;
  @Prop({ required: true }) title!: string;
  @Prop({ type: String, default: null }) referenceNumber?: string | null;
  @Prop({ type: String, default: null }) description?: string | null;
  @Prop({ type: String, enum: ["draft", "active", "on_hold", "completed", "cancelled"], default: "draft", index: true }) status!: string;
  @Prop({ type: String, default: null }) assignedStaffId?: string | null;
  @Prop({ type: Date, default: null }) startDate?: Date | null;
  @Prop({ type: Date, default: null }) expectedCompletionDate?: Date | null;
  @Prop({ type: Date, default: null }) completionDate?: Date | null;
  @Prop({ type: String, enum: ["fixed_fee", "hourly", "recurring", "milestone", "custom"], default: "hourly" }) billingModel!: string;
}
export type MatterDocument = HydratedDocument<Matter>;
export const MatterSchema = SchemaFactory.createForClass(Matter);
MatterSchema.index({ businessId: 1, externalId: 1 }, { unique: true, sparse: true });

@Schema({ timestamps: true, collection: "matter_tasks" })
export class MatterTask extends TenantRecord {
  @Prop({ required: true, index: true }) matterId!: string;
  @Prop({ type: String, default: null }) clientId?: string | null;
  @Prop({ required: true }) title!: string;
  @Prop({ type: String, default: null }) description?: string | null;
  @Prop({ type: String, default: null }) assignedStaffId?: string | null;
  @Prop({ type: String, enum: ["pending", "in_progress", "completed", "cancelled"], default: "pending", index: true }) status!: string;
  @Prop({ type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" }) priority!: string;
  @Prop({ type: Date, default: null, index: true }) dueDate?: Date | null;
  @Prop({ type: Date, default: null }) completedDate?: Date | null;
}
export type MatterTaskDocument = HydratedDocument<MatterTask>;
export const MatterTaskSchema = SchemaFactory.createForClass(MatterTask);
MatterTaskSchema.index({ businessId: 1, matterId: 1, status: 1 });

@Schema({ timestamps: true, collection: "time_entries" })
export class TimeEntry extends TenantRecord {
  @Prop({ required: true, index: true }) matterId!: string;
  @Prop({ required: true, index: true }) staffId!: string;
  @Prop({ required: true, index: true }) date!: Date;
  @Prop({ required: true, min: 0 }) durationMinutes!: number;
  @Prop({ type: Number, default: null, min: 0 }) hourlyRate?: number | null;
  @Prop({ type: Boolean, default: true, index: true }) billable!: boolean;
  @Prop({ type: String, default: null }) description?: string | null;
  @Prop({ type: String, enum: ["unbilled", "billed", "written_off"], default: "unbilled", index: true }) billingStatus!: string;
  @Prop({ type: String, default: null, index: true }) invoiceId?: string | null;
}
export type TimeEntryDocument = HydratedDocument<TimeEntry>;
export const TimeEntrySchema = SchemaFactory.createForClass(TimeEntry);
TimeEntrySchema.index({ businessId: 1, matterId: 1, date: -1 });
