import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { AuditLog, AuditLogDocument, Product, ProductDocument } from "../schemas";
import { InventoryReservation, InventoryReservationDocument } from "../commerce.schemas";
import type { CommercePrincipal } from "../../common/commerce-auth.decorator";
import { buildProductLookupQuery, isMongoObjectId } from "../products/product-identity";
import { runInTransaction } from "../../common/mongo-transaction";
import { assertBranchAccess, safeProductId } from "./commerce.helpers";
import { CommerceIdempotencyService } from "./idempotency.service";
import { CommerceWebhooksService } from "./webhooks.service";

export type ReserveInput = {
  productId: string;
  branchId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  expiresAt?: Date;
};

@Injectable()
export class CommerceInventoryService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(InventoryReservation.name) private readonly reservationModel: Model<InventoryReservationDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly idempotency: CommerceIdempotencyService,
    private readonly webhooks: CommerceWebhooksService
  ) {}

  async availability(principal: CommercePrincipal, input: { productId?: string; branchId?: string; page: number; limit: number }) {
    if (input.branchId) assertBranchAccess(principal, input.branchId);
    const branchId = input.branchId ?? (principal.branchIds.length === 1 ? principal.branchIds[0] : undefined);
    const filter: Record<string, unknown> = { businessId: principal.businessId, deletedAt: null, isActive: true, visibility: { $in: ["EXTERNAL", "MARKETPLACE"] } };
    if (branchId) filter.$or = [{ branchId }, { branchId: null }];
    else if (principal.branchIds.length) filter.$or = [{ branchId: { $in: principal.branchIds } }, { branchId: null }];
    if (input.productId) filter.$and = [{ $or: isMongoObjectId(input.productId) ? [{ _id: input.productId }, { externalId: input.productId }] : [{ externalId: input.productId }] }];
    const total = await this.productModel.countDocuments(filter);
    const rows = await this.productModel.find(filter).sort({ createdAt: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean();
    return {
      items: rows.map((row) => ({
        productId: safeProductId(row),
        branchId: branchId ?? row.branchId ?? null,
        availableQuantity: Number(row.stockOnHand ?? 0),
        reservedQuantity: Number(row.reservedQuantity ?? 0),
        sellableQuantity: Math.max(0, Number(row.stockOnHand ?? 0) - Number(row.reservedQuantity ?? 0)),
        stockStatus: Number(row.stockOnHand ?? 0) - Number(row.reservedQuantity ?? 0) > 0 ? "in_stock" : "out_of_stock"
      })),
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit))
    };
  }

  async reserve(principal: CommercePrincipal, input: ReserveInput, idempotencyKey?: string) {
    assertBranchAccess(principal, input.branchId);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new ConflictException("Reservation quantity must be positive");
    const result = await this.idempotency.execute(principal, "inventory.reserve", idempotencyKey, input, () => this.reserveAtomic(principal, input));
    void this.webhooks.publish({ businessId: principal.businessId, eventType: "inventory.updated", data: { productId: result.productId, branchId: result.branchId, reservationId: result.id, status: result.status } }).catch(() => undefined);
    return result;
  }

  async release(principal: CommercePrincipal, reservationId: string) {
    if (!isMongoObjectId(reservationId)) throw new NotFoundException("Inventory reservation not found");
    const result = await runInTransaction(this.connection, async (session) => {
      const reservation = await this.reservationModel.findOne({ _id: reservationId, businessId: principal.businessId, ...(principal.credentialId !== "system" ? { credentialId: principal.credentialId } : {}) }).session(session);
      if (!reservation) throw new NotFoundException("Inventory reservation not found");
      if (principal.branchIds.length && !principal.branchIds.includes(reservation.branchId)) throw new NotFoundException("Inventory reservation not found");
      if (reservation.status !== "RESERVED") return this.publicReservation(reservation.toObject());
      const product = await this.productModel.findOneAndUpdate(
        { ...buildProductLookupQuery({ businessId: principal.businessId, identifier: reservation.productId, branchId: reservation.branchId }), $expr: { $gte: [{ $ifNull: ["$reservedQuantity", 0] }, reservation.quantity] } } as never,
        { $inc: { reservedQuantity: -reservation.quantity } },
        { new: true, session }
      ).lean();
      if (!product) throw new ConflictException("Inventory reservation could not be released safely");
      reservation.status = new Date() >= reservation.expiresAt ? "EXPIRED" : "RELEASED";
      reservation.releasedAt = new Date();
      await reservation.save({ session });
      await this.auditModel.create([{ businessId: principal.businessId, actorId: principal.credentialId, entityType: "inventory_reservation", entityId: reservationId, action: reservation.status === "EXPIRED" ? "inventory.expired" : "inventory.released", payload: { productId: reservation.productId, branchId: reservation.branchId, quantity: reservation.quantity } }], { session });
      return this.publicReservation(reservation.toObject());
    });
    void this.webhooks.publish({ businessId: principal.businessId, eventType: "inventory.updated", data: { productId: result.productId, branchId: result.branchId, reservationId: result.id, status: result.status } }).catch(() => undefined);
    return result;
  }

  async commit(principal: CommercePrincipal, reservationId: string) {
    if (!isMongoObjectId(reservationId)) throw new NotFoundException("Active inventory reservation not found");
    const result = await runInTransaction(this.connection, async (session) => {
      const reservation = await this.reservationModel.findOne({ _id: reservationId, businessId: principal.businessId, status: "RESERVED", ...(principal.credentialId !== "system" ? { credentialId: principal.credentialId } : {}) }).session(session);
      if (!reservation) throw new NotFoundException("Active inventory reservation not found");
      if (principal.branchIds.length && !principal.branchIds.includes(reservation.branchId)) throw new NotFoundException("Active inventory reservation not found");
      if (reservation.expiresAt.getTime() <= Date.now()) throw new ConflictException("Inventory reservation has expired");
      const product = await this.productModel.findOneAndUpdate(
        { ...buildProductLookupQuery({ businessId: principal.businessId, identifier: reservation.productId, branchId: reservation.branchId }), $expr: { $and: [{ $gte: [{ $ifNull: ["$reservedQuantity", 0] }, reservation.quantity] }, { $gte: [{ $ifNull: ["$stockOnHand", 0] }, reservation.quantity] }] } } as never,
        { $inc: { reservedQuantity: -reservation.quantity, stockOnHand: -reservation.quantity } },
        { new: true, session }
      ).lean();
      if (!product) throw new ConflictException("Inventory reservation could not be committed safely");
      reservation.status = "COMMITTED";
      reservation.committedAt = new Date();
      await reservation.save({ session });
      await this.auditModel.create([{ businessId: principal.businessId, actorId: principal.credentialId, entityType: "inventory_reservation", entityId: reservationId, action: "inventory.committed", payload: { productId: reservation.productId, branchId: reservation.branchId, quantity: reservation.quantity } }], { session });
      return this.publicReservation(reservation.toObject());
    });
    void this.webhooks.publish({ businessId: principal.businessId, eventType: "inventory.updated", data: { productId: result.productId, branchId: result.branchId, reservationId: result.id, status: result.status } }).catch(() => undefined);
    return result;
  }

  async expireDue(businessId?: string) {
    const due = await this.reservationModel.find({ ...(businessId ? { businessId } : {}), status: "RESERVED", expiresAt: { $lte: new Date() } }).limit(500).lean();
    for (const reservation of due) {
      const principal: CommercePrincipal = { businessId: reservation.businessId, credentialId: "system", scopes: [], branchIds: [], rateLimitPerMinute: 1 };
      await this.release(principal, String(reservation._id)).catch(() => undefined);
    }
    return { expired: due.length };
  }

  private async reserveAtomic(principal: CommercePrincipal, input: ReserveInput) {
    return runInTransaction(this.connection, async (session) => {
      const product = await this.productModel.findOne(buildProductLookupQuery({ businessId: principal.businessId, identifier: input.productId, branchId: input.branchId })).session(session).lean();
      if (!product) throw new NotFoundException("Product not found");
      const canonicalProductId = safeProductId(product);
      const updated = await this.productModel.findOneAndUpdate(
        { ...buildProductLookupQuery({ businessId: principal.businessId, identifier: input.productId, branchId: input.branchId }), $expr: { $gte: [{ $subtract: [{ $ifNull: ["$stockOnHand", 0] }, { $ifNull: ["$reservedQuantity", 0] }] }, input.quantity] } } as never,
        { $inc: { reservedQuantity: input.quantity } },
        { new: true, session }
      ).lean();
      if (!updated) throw new ConflictException("Insufficient sellable inventory");
      const reservation = (await this.reservationModel.create([{
        businessId: principal.businessId,
        productId: canonicalProductId,
        branchId: input.branchId,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        expiresAt: input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000),
        status: "RESERVED",
        credentialId: principal.credentialId,
        idempotencyKey: null
      }], { session }))[0]!;
      await this.auditModel.create([{ businessId: principal.businessId, actorId: principal.credentialId, entityType: "inventory_reservation", entityId: reservation._id.toString(), action: "inventory.reserved", payload: { productId: canonicalProductId, branchId: input.branchId, quantity: input.quantity, referenceType: input.referenceType, referenceId: input.referenceId } }], { session });
      return this.publicReservation(reservation.toObject());
    });
  }

  private publicReservation(row: Partial<InventoryReservation> & { _id?: unknown }) {
    return { id: String(row._id), businessId: row.businessId, productId: row.productId, branchId: row.branchId, quantity: row.quantity, referenceType: row.referenceType, referenceId: row.referenceId, status: row.status, expiresAt: row.expiresAt };
  }
}
