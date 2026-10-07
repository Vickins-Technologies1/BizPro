import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import { Customer, CustomerDocument, Expense, ExpenseDocument, Invoice, InvoiceDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument } from "../schemas";
import { calculateGrossProfit, calculateNetProfit, calculateOutstanding } from "@vbo/shared";
import { buildBranchMatch, resolveReadBranchId, type BranchScope } from "../../common/branch-scope";

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>
  ) {}

  async summary(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const saleRange = buildDateRange(from, to);
    const expenseRange = buildDateRange(from, to);
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    if (saleRange) filter.createdAt = saleRange;
    const [salesDocs, expenses, lowStockItems, debtors, invoices, standalonePayments] = await Promise.all([
      this.saleModel.find(filter).lean(),
      this.expenseModel.aggregate([
        { $match: { businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(expenseRange ? { expenseDate: expenseRange } : {}) } },
        { $group: { _id: null, expensesTotal: { $sum: "$amount" } } }
      ]),
      this.productModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean(),
      this.customerModel.aggregate([{ $match: { businessId, balance: { $gt: 0 }, ...buildBranchMatch(branchId) } }, { $group: { _id: null, debtTotal: { $sum: "$balance" } } }]),
      this.invoiceModel.find({ businessId, deletedAt: null, status: { $nin: ["void", "cancelled", "archived"] }, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, saleId: 1, balanceDue: 1, currency: 1 }).lean(),
      this.paymentModel.find({ businessId, saleId: null, invoiceId: null, deletedAt: null, ...buildBranchMatch(branchId) }).select({ amount: 1 }).lean()
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
    const receivables = [
      ...salesDocs.map((sale) => ({ id: String(sale.externalId ?? sale._id), source: "sale" as const, balanceDue: sale.balanceDue, currency: sale.currency, linkedReceivableId: String(sale.externalId ?? sale._id) })),
      ...invoices.map((invoice) => ({ id: String(invoice.externalId ?? invoice._id), source: "invoice" as const, balanceDue: invoice.balanceDue, currency: invoice.currency, linkedReceivableId: invoice.saleId ?? null }))
    ];
    const debtTotal = Math.max(0, calculateOutstanding(receivables) - standalonePayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0));
    return {
      salesTotal,
      expensesTotal,
      estimatedProfit: calculateNetProfit(calculateGrossProfit(salesTotal, cogsTotal), expensesTotal),
      debtTotal,
      lowStockCount: lowStockItems.filter((product) => product.stockOnHand <= product.lowStockThreshold).length
    };
  }

  topProducts(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    const range = buildDateRange(from, to);
    if (range) {
      filter.createdAt = range;
    }
    return this.saleModel.aggregate([
      { $match: filter },
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

  paymentBreakdown(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    const range = buildDateRange(from, to);
    if (range) {
      filter.createdAt = range;
    }
    return this.saleModel.aggregate([
      { $match: filter },
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

function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const range: Record<string, Date> = {};
  if (from) range.$gte = normalizeRangeBound(from, "from");
  if (to) range.$lte = normalizeRangeBound(to, "to");
  return range;
}

function normalizeRangeBound(value: string, bound: "from" | "to") {
  const parsed = parseISO(value);
  const date = Number.isNaN(parsed.getTime()) ? new Date(value) : parsed;
  if (Number.isNaN(date.getTime())) {
    return new Date(0);
  }
  if (value.includes("T")) {
    return date;
  }
  return bound === "from" ? startOfDay(date) : endOfDay(date);
}
