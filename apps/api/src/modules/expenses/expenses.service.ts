import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Expense, ExpenseDocument } from "../schemas";

@Injectable()
export class ExpensesService {
  constructor(@InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>) {}

  list(businessId: string) {
    return this.expenseModel.find({ businessId, deletedAt: null }).sort({ expenseDate: -1 }).lean();
  }

  create(input: Partial<Expense> & { businessId: string; amount: number; note: string; expenseDate: Date }) {
    return this.expenseModel.create({ ...input, deletedAt: null });
  }
}
