import type { Customer } from "@shared";
import { BaseRepository } from "./baseRepository";
import { createId } from "@/utils/id";
import { nowIso } from "@/utils/date";

export class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super("customers");
  }

  async create(input: Omit<Customer, "id" | "createdAt" | "updatedAt" | "balance"> & { businessId: string; balance?: number }) {
    const row: Customer = {
      ...input,
      balance: input.balance ?? 0,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    };
    return this.insert(row);
  }

  async applyBalanceDelta(customerId: string, delta: number) {
    const customer = await this.findById(customerId);
    if (!customer) return null;
    return this.update(customerId, {
      balance: Math.max(0, Number(customer.balance || 0) + delta),
      updatedAt: nowIso()
    } as Partial<Customer>);
  }
}
