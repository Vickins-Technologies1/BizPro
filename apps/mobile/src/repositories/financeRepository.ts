import type { Expense, Sale, Payment, StockMovement } from "@shared";
import { BaseRepository } from "./baseRepository";
import { createId } from "@/utils/id";
import { nowIso } from "@/utils/date";

export class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super("expenses");
  }

  async create(input: Omit<Expense, "id" | "createdAt" | "updatedAt"> & { businessId: string }) {
    return this.insert({
      ...input,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    });
  }
}

export class SaleRepository extends BaseRepository<Sale> {
  constructor() {
    super("sales");
  }

  async create(input: Omit<Sale, "id" | "createdAt" | "updatedAt"> & { businessId: string }) {
    return this.insert({
      ...input,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    });
  }
}

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super("payments");
  }
}

export class StockMovementRepository extends BaseRepository<StockMovement> {
  constructor() {
    super("stock_movements");
  }

  async create(input: Omit<StockMovement, "id" | "createdAt" | "updatedAt"> & { businessId: string }) {
    return this.insert({
      ...input,
      id: createId(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null
    });
  }
}
