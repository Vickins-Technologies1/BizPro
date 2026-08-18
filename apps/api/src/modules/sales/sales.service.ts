import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { Customer, CustomerDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument, SaleItem, StockMovement, StockMovementDocument } from "../schemas";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import {
  buildProductLookupQuery,
  invalidProductIdException,
  isMongoObjectId,
  productNotFoundException
} from "../products/product-identity";
import { NotificationsService } from "../notifications/notifications.service";

export interface CreateSaleInput {
  businessId: string;
  externalId?: string | null;
  branchId?: string | null;
  customerId?: string | null;
  cashierId?: string | null;
  receiptNumber: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: Sale["paymentStatus"];
  paymentMethod: Sale["paymentMethod"];
  notes?: string | null;
  items: SaleItem[];
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovementDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly notifications: NotificationsService
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: CreateSaleInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    const lowStockAlerts = new Map<string, { productId: string; productName: string; stockOnHand: number; threshold: number }>();
    if (input.externalId) {
      const existing = await this.saleModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    const sale = await runInTransaction(this.connection, async (session) => {
      const resolvedItems: Array<{ item: SaleItem; product: ProductDocument; productId: string }> = [];
      for (const item of input.items) {
        const product = await this.productModel.findOne(buildProductLookupQuery({ businessId: input.businessId, identifier: item.productId, branchId })).session(session);
        if (!product) {
          throw isMongoObjectId(item.productId) ? productNotFoundException() : invalidProductIdException();
        }
        resolvedItems.push({
          item,
          product,
          productId: product.externalId ?? String(product._id)
        });
      }
      const sale = (await this.saleModel.create(
        [
          {
            ...input,
            items: resolvedItems.map(({ item, productId }) => ({
              ...item,
              productId
            })),
            branchId,
            deletedAt: null
          }
        ],
        { session }
      ))[0]!;
      for (const { item, product, productId } of resolvedItems) {
        product.stockOnHand = Math.max(0, product.stockOnHand - item.quantity);
        await product.save({ session });
        const freshStock = product.stockOnHand;
        if (freshStock <= product.lowStockThreshold) {
          lowStockAlerts.set(String(productId), {
            productId: String(productId),
            productName: product.name,
            stockOnHand: freshStock,
            threshold: product.lowStockThreshold
          });
        }
        await this.movementModel.create(
          [
            {
              businessId: input.businessId,
              branchId,
              productId,
              referenceType: "sale",
              referenceId: sale._id.toString(),
              quantityDelta: -item.quantity,
              unitCost: item.costPrice,
              note: `Sale ${input.receiptNumber}`
            }
          ],
          { session }
        );
      }
      if (input.customerId && input.balanceDue > 0) {
        const customer = await this.customerModel.findOne({ _id: input.customerId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
        if (!customer) throw new NotFoundException({ success: false, code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
        customer.balance += input.balanceDue;
        await customer.save({ session });
      }
      await this.paymentModel.create(
        [
          {
            businessId: input.businessId,
            branchId,
            customerId: input.customerId ?? null,
            saleId: sale._id.toString(),
            debtPaymentId: null,
            externalId: input.externalId ?? null,
            method: input.paymentMethod,
            status: input.paymentStatus,
            amount: input.amountPaid,
            reference: null,
            note: input.notes ?? null,
            provider: input.paymentMethod === "mpesa" ? "tuma" : null,
            reconciledAt: input.paymentMethod === "mpesa" && input.paymentStatus === "paid" ? new Date() : null
          }
        ],
        { session }
      );
      return sale.toObject();
    });
    for (const alert of lowStockAlerts.values()) {
      void this.notifications
        .createLowStockNotification({
          businessId: input.businessId,
          productId: alert.productId,
          productName: alert.productName,
          stockOnHand: alert.stockOnHand,
          threshold: alert.threshold,
          routeParams: { productId: alert.productId }
        })
        .catch(() => undefined);
    }
    return sale;
  }
}
