import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { endOfDay, parseISO, startOfDay } from "date-fns";
import { Customer, CustomerDocument, Expense, ExpenseDocument, Invoice, InvoiceDocument, Payment, PaymentDocument, Product, ProductDocument, Sale, SaleDocument } from "../schemas";
import { calculateGrossProfit, calculateNetProfit, calculateOutstanding, roundMoney } from "@vbo/shared";
import { buildBranchMatch, resolveReadBranchId, type BranchScope } from "../../common/branch-scope";
import { eligiblePaymentMatch } from "../../common/payment-integrity";

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
    const paymentRange = buildDateRange(from, to);
    const filter: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId) };
    if (saleRange) filter.createdAt = saleRange;
    const [salesDocs, receivableSales, expenses, lowStockItems, invoices, customerCredits, collected, pending, failed] = await Promise.all([
      this.saleModel.find(filter).lean(),
      this.saleModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, balanceDue: 1, currency: 1 }).lean(),
      this.expenseModel.aggregate([
        { $match: { businessId, deletedAt: null, ...buildBranchMatch(branchId), ...(expenseRange ? { expenseDate: expenseRange } : {}) } },
        { $group: { _id: null, expensesTotal: { $sum: "$amount" } } }
      ]),
      this.productModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean(),
      this.invoiceModel.find({ businessId, deletedAt: null, status: { $nin: ["draft", "void", "cancelled", "archived"] }, ...buildBranchMatch(branchId) }).select({ _id: 1, externalId: 1, saleId: 1, balanceDue: 1, currency: 1 }).lean(),
      this.paymentModel.aggregate([{ $match: { businessId, method: { $ne: "credit" }, customerId: { $ne: null }, saleId: null, invoiceId: null, deletedAt: null, $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] } }, { $group: { _id: "$customerId", total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, deletedAt: null, method: { $ne: "credit" }, ...(paymentRange ? { createdAt: paymentRange } : {}), $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, deletedAt: null, ...(paymentRange ? { createdAt: paymentRange } : {}), $and: [{ $or: [{ paymentState: "reconciliation_pending" }, { paymentState: { $exists: false }, status: "pending_confirmation" }] }, buildBranchMatch(branchId)] } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      this.paymentModel.aggregate([{ $match: { businessId, deletedAt: null, ...(paymentRange ? { createdAt: paymentRange } : {}), $and: [{ $or: [{ paymentState: "failed" }, { paymentState: { $exists: false }, status: "failed" }] }, buildBranchMatch(branchId)] } }, { $group: { _id: null, total: { $sum: "$amount" } } }])
    ]);
    const salesTotal = roundMoney(salesDocs.reduce((sum, sale) => sum + Number(sale.grandTotal ?? 0) - Number(sale.taxTotal ?? 0), 0));
    const taxTotal = roundMoney(salesDocs.reduce((sum, sale) => sum + Number(sale.taxTotal ?? 0), 0));
    const itemsSold = salesDocs.reduce((sum, sale) =>
      sum + (Array.isArray(sale.items) ? sale.items.reduce((lineSum: number, item: { quantity: number }) => lineSum + Number(item.quantity ?? 0), 0) : 0), 0);
    const cogsTotal = roundMoney(salesDocs.reduce(
      (sum, sale) =>
        sum +
        (Array.isArray(sale.items)
          ? sale.items.reduce((lineSum: number, item: { costPrice: number; quantity: number }) => lineSum + Number(item.costPrice ?? 0) * Number(item.quantity ?? 0), 0)
          : 0),
      0
    ));
    const expensesTotal = expenses[0]?.expensesTotal ?? 0;
    const saleAliases = new Map<string, string>();
    for (const sale of receivableSales) {
      saleAliases.set(String(sale._id), String(sale._id));
      if (sale.externalId) saleAliases.set(String(sale.externalId), String(sale._id));
    }
    const receivables = [
      ...receivableSales.map((sale) => ({ id: String(sale.externalId ?? sale._id), source: "sale" as const, balanceDue: sale.balanceDue, currency: sale.currency, linkedReceivableId: String(sale._id) })),
      ...invoices.map((invoice) => ({ id: String(invoice.externalId ?? invoice._id), source: "invoice" as const, balanceDue: invoice.balanceDue, currency: invoice.currency, linkedReceivableId: invoice.saleId ? saleAliases.get(String(invoice.saleId)) ?? invoice.saleId : null }))
    ];
    const debtTotal = calculateOutstanding(receivables);
    const customerCreditTotal = customerCredits.reduce((sum, row) => sum + Math.max(0, Number(row.total ?? 0)), 0);
    return {
      salesTotal,
      transactionsCount: salesDocs.length,
      itemsSold,
      taxTotal,
      cogsTotal,
      grossProfit: calculateGrossProfit(salesTotal, cogsTotal),
      expensesTotal,
      estimatedProfit: calculateNetProfit(calculateGrossProfit(salesTotal, cogsTotal), expensesTotal),
      debtTotal,
      customerCreditTotal,
      collectedTotal: Number(collected[0]?.total ?? 0),
      pendingPaymentTotal: Number(pending[0]?.total ?? 0),
      failedPaymentTotal: Number(failed[0]?.total ?? 0),
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
          total: { $sum: { $subtract: [{ $ifNull: ["$items.lineTotal", 0] }, { $ifNull: ["$items.lineTax", 0] }] } }
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
    return this.paymentModel.aggregate([
      { $match: { ...filter, method: { $ne: "credit" }, $and: [eligiblePaymentMatch(), buildBranchMatch(branchId)] } },
      { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } },
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
