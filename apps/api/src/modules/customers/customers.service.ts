import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Customer, CustomerDocument } from "../schemas";

@Injectable()
export class CustomersService {
  constructor(@InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>) {}

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
}
