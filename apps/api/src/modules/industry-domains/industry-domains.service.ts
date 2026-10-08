import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { buildBranchMatch, resolveReadBranchId, type BranchScope } from "../../common/branch-scope";
import { Matter, MatterDocument, MatterTask, MatterTaskDocument, Patient, PatientDocument, Reservation, ReservationDocument, Room, RoomCharge, RoomChargeDocument, RoomDocument, RoomType, RoomTypeDocument, Stay, StayDocument, TimeEntry, TimeEntryDocument, Visit, VisitDocument } from "../industry-domains.schemas";

const MODELS = ["room-types", "rooms", "reservations", "stays", "room-charges", "patients", "visits", "matters", "tasks", "time-entries"] as const;
type DomainPath = typeof MODELS[number];

@Injectable()
export class IndustryDomainsService {
  constructor(
    @InjectModel(RoomType.name) private readonly roomType: Model<RoomTypeDocument>,
    @InjectModel(Room.name) private readonly room: Model<RoomDocument>,
    @InjectModel(Reservation.name) private readonly reservation: Model<ReservationDocument>,
    @InjectModel(Stay.name) private readonly stay: Model<StayDocument>,
    @InjectModel(RoomCharge.name) private readonly roomCharge: Model<RoomChargeDocument>,
    @InjectModel(Patient.name) private readonly patient: Model<PatientDocument>,
    @InjectModel(Visit.name) private readonly visit: Model<VisitDocument>,
    @InjectModel(Matter.name) private readonly matter: Model<MatterDocument>,
    @InjectModel(MatterTask.name) private readonly task: Model<MatterTaskDocument>,
    @InjectModel(TimeEntry.name) private readonly timeEntry: Model<TimeEntryDocument>
  ) {}

  private model(path: DomainPath): Model<any> {
    return ({ "room-types": this.roomType, rooms: this.room, reservations: this.reservation, stays: this.stay, "room-charges": this.roomCharge, patients: this.patient, visits: this.visit, matters: this.matter, tasks: this.task, "time-entries": this.timeEntry } as Record<DomainPath, Model<any>>)[path];
  }

  list(path: DomainPath, businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.model(path).find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(path: DomainPath, businessId: string, input: Record<string, unknown>) {
    if (!MODELS.includes(path)) throw new BadRequestException("Unsupported industry domain");
    if (input.externalId) {
      const existing = await this.model(path).findOne({ businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) return existing;
    }
    if (path === "reservations") {
      const roomId = typeof input.roomId === "string" ? input.roomId : null;
      if (roomId && await this.reservation.exists({ businessId, roomId, status: { $in: ["pending", "confirmed", "checked_in"] }, arrivalDate: { $lt: input.departureDate }, departureDate: { $gt: input.arrivalDate }, deletedAt: null })) {
        throw new BadRequestException("Room is already reserved for the selected dates");
      }
    }
    return this.model(path).create({ ...input, businessId, deletedAt: null });
  }

  async checkIn(businessId: string, reservationId: string) {
    const reservation = await this.reservation.findOne({ businessId, $or: [{ _id: reservationId }, { externalId: reservationId }], deletedAt: null });
    if (!reservation || !reservation.roomId) throw new NotFoundException("Assigned reservation not found");
    if (!["pending", "confirmed"].includes(reservation.status)) throw new BadRequestException("Reservation cannot be checked in");
    const room = await this.room.findOneAndUpdate({ businessId, _id: reservation.roomId, status: { $in: ["available", "reserved"] }, deletedAt: null }, { status: "occupied" }, { new: true }).lean();
    if (!room) throw new BadRequestException("Room is not available for check-in");
    const stay = await this.stay.create({ businessId, branchId: reservation.branchId, guestId: reservation.guestId, reservationId: String(reservation._id), roomId: String(room._id), checkInAt: new Date(), expectedCheckOutAt: reservation.departureDate, status: "active", deletedAt: null });
    reservation.status = "checked_in";
    await reservation.save();
    return { reservation: reservation.toObject(), stay: stay.toObject(), room };
  }

  async checkOut(businessId: string, stayId: string) {
    const stay = await this.stay.findOne({ businessId, $or: [{ _id: stayId }, { externalId: stayId }], status: "active", deletedAt: null });
    if (!stay) throw new NotFoundException("Active stay not found");
    const [updatedStay, room] = await Promise.all([
      this.stay.findByIdAndUpdate(stay._id, { status: "checked_out", checkOutAt: new Date() }, { new: true }).lean(),
      this.room.findOneAndUpdate({ businessId, _id: stay.roomId, deletedAt: null }, { status: "available", housekeepingStatus: "dirty" }, { new: true }).lean()
    ]);
    await this.reservation.findOneAndUpdate({ businessId, _id: stay.reservationId, deletedAt: null }, { status: "checked_out" });
    return { stay: updatedStay, room };
  }

  async update(path: DomainPath, businessId: string, id: string, input: Record<string, unknown>) {
    const { businessId: _businessId, externalId: _externalId, ...patch } = input;
    const identity = Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { externalId: id }] } : { externalId: id };
    const updated = await this.model(path).findOneAndUpdate({ ...identity, businessId, deletedAt: null }, patch, { new: true }).lean();
    if (!updated) throw new NotFoundException(`${path} record not found`);
    return updated;
  }

  async archive(path: DomainPath, businessId: string, id: string) {
    return this.update(path, businessId, id, { deletedAt: new Date() });
  }

  async summary(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const filter = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    const [rooms, patients, visits, matters, tasks, timeEntries] = await Promise.all([
      this.room.countDocuments(filter),
      this.patient.countDocuments(filter),
      this.visit.countDocuments(filter),
      this.matter.countDocuments(filter),
      this.task.countDocuments(filter),
      this.timeEntry.find(filter).select("durationMinutes billable status dueDate").lean()
    ]);
    const roomStatuses = await this.room.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = await this.task.countDocuments({ ...filter, dueDate: { $lt: today }, status: { $nin: ["completed", "cancelled"] } });
    return {
      rooms,
      roomStatuses: Object.fromEntries(roomStatuses.map((row: { _id: string; count: number }) => [row._id, row.count])),
      patients,
      visits,
      activeVisits: await this.visit.countDocuments({ ...filter, status: { $in: ["waiting", "in_progress"] } }),
      completedVisits: await this.visit.countDocuments({ ...filter, status: "completed" }),
      matters,
      activeMatters: await this.matter.countDocuments({ ...filter, status: "active" }),
      tasks,
      pendingTasks: await this.task.countDocuments({ ...filter, status: { $in: ["pending", "in_progress"] } }),
      overdueTasks,
      billableMinutes: timeEntries.filter((entry: { billable: boolean }) => entry.billable).reduce((sum: number, entry: { durationMinutes: number }) => sum + Number(entry.durationMinutes ?? 0), 0),
      nonBillableMinutes: timeEntries.filter((entry: { billable: boolean }) => !entry.billable).reduce((sum: number, entry: { durationMinutes: number }) => sum + Number(entry.durationMinutes ?? 0), 0)
    };
  }
}
