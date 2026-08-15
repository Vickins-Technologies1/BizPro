import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { Customer, CustomerDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument, SaleItem, StockMovement, StockMovementDocument } from "../schemas";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";

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
    @InjectConnection() private readonly connection: Connection
  ) {}

  list(businessId: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    return this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).sort({ createdAt: -1 }).lean();
  }

  async create(input: CreateSaleInput, scope: BranchScope = {}) {
    const branchId = resolveWriteBranchId(scope, input.branchId ?? null);
    if (input.externalId) {
      const existing = await this.saleModel.findOne({ businessId: input.businessId, externalId: input.externalId, deletedAt: null }).lean();
      if (existing) {
        return existing;
      }
    }
    return runInTransaction(this.connection, async (session) => {
      const sale = (await this.saleModel.create(
        [
          {
            ...input,
            branchId,
            deletedAt: null
          }
        ],
        { session }
      ))[0]!;
      for (const item of input.items) {
        const product = await this.productModel.findOne({ _id: item.productId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
        if (!product) continue;
        product.stockOnHand = Math.max(0, product.stockOnHand - item.quantity);
        await product.save({ session });
        await this.movementModel.create(
          [
            {
              businessId: input.businessId,
              branchId,
              productId: item.productId,
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
        if (!customer) throw new NotFoundException("Customer not found");
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
  }
}
