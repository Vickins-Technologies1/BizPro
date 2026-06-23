import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Customer, CustomerDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument, SaleItem, StockMovement, StockMovementDocument } from "../schemas";

export interface CreateSaleInput {
  businessId: string;
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
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>
  ) {}

  list(businessId: string) {
    return this.saleModel.find({ businessId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async create(input: CreateSaleInput) {
    const sale = await this.saleModel.create({
      ...input,
      deletedAt: null
    });
    for (const item of input.items) {
      const product = await this.productModel.findById(item.productId);
      if (!product) continue;
      product.stockOnHand = Math.max(0, product.stockOnHand - item.quantity);
      await product.save();
      await this.movementModel.create({
        businessId: input.businessId,
        productId: item.productId,
        referenceType: "sale",
        referenceId: sale._id.toString(),
        quantityDelta: -item.quantity,
        unitCost: item.costPrice,
        note: `Sale ${input.receiptNumber}`
      });
    }
    if (input.customerId && input.balanceDue > 0) {
      const customer = await this.customerModel.findById(input.customerId);
      if (!customer) throw new NotFoundException("Customer not found");
      customer.balance += input.balanceDue;
      await customer.save();
    }
    await this.paymentModel.create({
      businessId: input.businessId,
      customerId: input.customerId ?? null,
      saleId: sale._id.toString(),
      debtPaymentId: null,
      method: input.paymentMethod,
      status: input.paymentStatus,
      amount: input.amountPaid,
      reference: null,
      note: input.notes ?? null,
      provider: input.paymentMethod === "mpesa" ? "tuma" : null,
      reconciledAt: input.paymentMethod === "mpesa" && input.paymentStatus === "paid" ? new Date() : null
    });
    return sale.toObject();
  }
}
