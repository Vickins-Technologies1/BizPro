import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Model } from "mongoose";
import { Business, BusinessDocument, Customer, CustomerDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument, SaleItem, StockMovement, StockMovementDocument } from "../schemas";
import { calculateSale, calculateTax, FINANCIAL_CALCULATION_VERSION } from "@vbo/shared";
import { runInTransaction } from "../../common/mongo-transaction";
import { buildBranchMatch, resolveReadBranchId, resolveWriteBranchId, type BranchScope } from "../../common/branch-scope";
import {
  buildProductLookupQuery,
  invalidProductIdException,
  isMongoObjectId,
  productNotFoundException
} from "../products/product-identity";
import { NotificationsService } from "../notifications/notifications.service";
import { buildBusinessLookup } from "../../common/business-lookup";

export interface CreateSaleInput {
  businessId: string;
  externalId?: string | null;
  branchId?: string | null;
  customerId?: string | null;
  cashierId?: string | null;
  receiptNumber: string;
  amountPaid: number;
  paymentStatus: Sale["paymentStatus"];
  paymentMethod: Sale["paymentMethod"];
  notes?: string | null;
  items: Array<{ productId: string; quantity: number; discount?: number; tax?: number }>;
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
    @InjectModel(Business.name) private readonly businessModel?: Model<BusinessDocument>,
    private readonly notifications?: NotificationsService
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
      const resolvedItems: Array<{ item: SaleItem; product: ProductDocument; productId: string; requestedTax: number }> = [];
      const business = this.businessModel
        ? await this.businessModel.findOne({ ...buildBusinessLookup(input.businessId), deletedAt: null }).session(session).lean()
        : { currency: "KES" };
      if (!business) throw new NotFoundException("Business not found");
      const serverTaxRate = Number((business as { taxSettings?: { defaultTaxRate?: number } }).taxSettings?.defaultTaxRate ?? 0);
      for (const item of input.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new BadRequestException("Sale quantity must be greater than zero");
        const product = await this.productModel.findOne(buildProductLookupQuery({ businessId: input.businessId, identifier: item.productId, branchId })).session(session);
        if (!product) {
          throw isMongoObjectId(item.productId) ? productNotFoundException() : invalidProductIdException();
        }
        resolvedItems.push({
          item: {
            productId: product.externalId ?? String(product._id),
            productName: product.name,
            quantity: item.quantity,
            unitPrice: product.sellingPrice,
            costPrice: product.buyingPrice,
            lineDiscount: item.discount ?? 0,
            lineTotal: 0
          },
          product,
          productId: product.externalId ?? String(product._id),
          requestedTax: item.tax ?? 0
        });
      }
      let calculation;
      try {
        calculation = calculateSale(
          resolvedItems.map(({ item }) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.costPrice,
            discount: item.lineDiscount,
            tax: calculateTax(Math.max(0, item.unitPrice * item.quantity - item.lineDiscount), Math.max(0, serverTaxRate))
          })),
          input.amountPaid
        );
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Invalid sale financial values");
      }
      resolvedItems.forEach(({ item }, index) => {
        item.unitPrice = calculation.lines[index]!.unitPrice;
        item.costPrice = calculation.lines[index]!.unitCost;
        item.lineDiscount = calculation.lines[index]!.lineDiscount;
        item.lineTax = calculation.lines[index]!.lineTax;
        item.lineTotal = calculation.lines[index]!.lineTotal;
        item.calculationVersion = FINANCIAL_CALCULATION_VERSION;
      });
      const sale = (await this.saleModel.create(
        [
          {
            ...input,
            subtotal: calculation.subtotal,
            discountTotal: calculation.discountTotal,
            taxTotal: calculation.taxTotal,
            grandTotal: calculation.grandTotal,
            amountPaid: calculation.amountPaid,
            balanceDue: calculation.balanceDue,
            paymentStatus: calculation.balanceDue === 0 ? "paid" : calculation.amountPaid > 0 ? "partial" : "credit",
            currency: business.currency ?? "KES",
            items: resolvedItems.map(({ item, productId }) => ({
              ...item,
              productId,
              currency: business.currency ?? "KES"
            })),
            branchId,
            deletedAt: null
          }
        ],
        { session }
      ))[0]!;
      for (const { item, product, productId } of resolvedItems) {
        const updatedProduct = await this.productModel.findOneAndUpdate(
          { _id: product._id, businessId: input.businessId, ...buildBranchMatch(branchId), $expr: { $gte: [{ $ifNull: ["$stockOnHand", 0] }, item.quantity] } } as never,
          { $inc: { stockOnHand: -item.quantity } },
          { new: true, session }
        ).lean();
        if (!updatedProduct) throw new NotFoundException("Insufficient stock");
        const freshStock = updatedProduct.stockOnHand;
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
      if (input.customerId && calculation.balanceDue > 0) {
        const customer = await this.customerModel.findOne({ _id: input.customerId, businessId: input.businessId, deletedAt: null, ...buildBranchMatch(branchId) }).session(session);
        if (!customer) throw new NotFoundException({ success: false, code: "CUSTOMER_NOT_FOUND", message: "Customer not found" });
        customer.balance += calculation.balanceDue;
        await customer.save({ session });
      }
      if (calculation.amountPaid > 0) await this.paymentModel.create(
        [{
            businessId: input.businessId,
            branchId,
            customerId: input.customerId ?? null,
            saleId: sale._id.toString(),
            debtPaymentId: null,
            externalId: input.externalId ?? null,
            method: input.paymentMethod,
            status: calculation.balanceDue === 0 ? "paid" : "partial",
            amount: calculation.amountPaid,
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
      void this.notifications?.createLowStockNotification({
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
