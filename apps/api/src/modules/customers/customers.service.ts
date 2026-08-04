import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Customer, CustomerDocument, Payment, PaymentDocument } from "../schemas";

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>
  ) {}

  list(businessId: string) {
    return this.customerModel.find({ businessId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  create(input: Partial<Customer> & { businessId: string; name: string }) {
    return this.customerModel.create({ ...input, balance: input.balance ?? 0, deletedAt: null });
  }

  async addBalance(id: string, delta: number) {
    const customer = await this.customerModel.findById(id);
    if (!customer) throw new NotFoundException("Customer not found");
    customer.balance = Math.max(0, customer.balance + delta);
    await customer.save();
    return customer.toObject();
  }

  payments(businessId: string, customerId: string) {
    return this.paymentModel.find({ businessId, customerId }).sort({ createdAt: -1 }).limit(20).lean();
  }

  async recordPayment(input: {
    businessId: string;
    customerId: string;
    amount: number;
    method: Payment["method"];
    reference?: string | null;
    note?: string | null;
    recordedById?: string | null;
  }) {
    const payment = await this.paymentModel.create({
      businessId: input.businessId,
      customerId: input.customerId,
      saleId: null,
      debtPaymentId: `${input.customerId}-${Date.now()}`,
      method: input.method,
      status: "paid",
      amount: input.amount,
      reference: input.reference ?? null,
      note: input.note ?? null,
      provider: input.method === "mpesa" ? "tuma" : null,
      reconciledAt: input.method === "mpesa" ? new Date() : null
    });
    await this.addBalance(input.customerId, -Math.abs(input.amount));
    return payment.toObject();
  }
}
