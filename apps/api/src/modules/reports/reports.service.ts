import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Customer, CustomerDocument, Expense, ExpenseDocument, Product, ProductDocument, Sale, SaleDocument } from "../schemas";

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>
  ) {}

  async summary(businessId: string, from?: string, to?: string) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    const filter: Record<string, unknown> = { businessId };
    if (Object.keys(range).length) filter.createdAt = range;
    const [salesDocs, expenses, lowStockItems, debtors] = await Promise.all([
      this.saleModel.find(filter).lean(),
      this.expenseModel.aggregate([
        { $match: { businessId, ...(from || to ? { expenseDate: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}) } },
        { $group: { _id: null, expensesTotal: { $sum: "$amount" } } }
      ]),
      this.productModel.find({ businessId, deletedAt: null }).lean(),
      this.customerModel.aggregate([
        { $match: { businessId, balance: { $gt: 0 } } },
        { $group: { _id: null, debtTotal: { $sum: "$balance" } } }
      ])
    ]);
    const salesTotal = salesDocs.reduce((sum, sale) => sum + (sale.grandTotal ?? 0), 0);
    const cogsTotal = salesDocs.reduce(
      (sum, sale) =>
        sum +
        (Array.isArray(sale.items)
          ? sale.items.reduce((lineSum: number, item: { costPrice: number; quantity: number }) => lineSum + item.costPrice * item.quantity, 0)
          : 0),
      0
    );
    const expensesTotal = expenses[0]?.expensesTotal ?? 0;
    const debtTotal = debtors[0]?.debtTotal ?? 0;
    return {
      salesTotal,
      expensesTotal,
      estimatedProfit: salesTotal - cogsTotal - expensesTotal,
      debtTotal,
      lowStockCount: lowStockItems.filter((product) => product.stockOnHand <= product.lowStockThreshold).length
    };
  }

  topProducts(businessId: string) {
    return this.saleModel.aggregate([
      { $match: { businessId } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          quantity: { $sum: "$items.quantity" },
          total: { $sum: "$items.lineTotal" }
        }
      },
      { $sort: { quantity: -1 } },
      { $limit: 10 }
    ]);
  }

  paymentBreakdown(businessId: string) {
    return this.saleModel.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);
  }
}
