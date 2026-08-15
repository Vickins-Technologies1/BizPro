import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { addMonths, eachMonthOfInterval, endOfDay, format, startOfDay, startOfMonth, subMonths } from "date-fns";
import { Customer, CustomerDocument, Expense, ExpenseDocument, Product, ProductDocument, Sale, SaleDocument, User, UserDocument } from "../schemas";
import type { EnterpriseAnalytics } from "@vbo/shared";
import { buildBranchMatch, resolveReadBranchId, type BranchScope } from "../../common/branch-scope";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Sale.name) private readonly saleModel: Model<SaleDocument>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>
  ) {}

  async enterprise(businessId: string, from?: string, to?: string, scope: BranchScope = {}) {
    const branchId = resolveReadBranchId(scope, scope.requestedBranchId ?? scope.branchId ?? null);
    const range = buildRange(from, to);
    const start = range?.from ?? startOfMonth(subMonths(new Date(), 11));
    const end = range?.to ?? endOfDay(new Date());
    const monthInterval = eachMonthOfInterval({ start: startOfMonth(start), end: startOfMonth(end) });
    const saleMatch: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId), createdAt: { $gte: start, $lte: end } };
    const expenseMatch: Record<string, unknown> = { businessId, deletedAt: null, ...buildBranchMatch(branchId), expenseDate: { $gte: start, $lte: end } };

    const [monthlySales, monthlyCosts, monthlyExpenses, peakHours, topProducts, topCustomers, staffPerformance, products, customers, users] = await Promise.all([
      this.saleModel.aggregate([
        { $match: saleMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            revenue: { $sum: "$grandTotal" },
            salesCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      this.saleModel.aggregate([
        { $match: saleMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            cogs: { $sum: { $multiply: ["$items.costPrice", "$items.quantity"] } },
            soldQuantity: { $sum: "$items.quantity" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      this.expenseModel.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$expenseDate" } },
            expenses: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      this.saleModel.aggregate([
        { $match: saleMatch },
        {
          $group: {
            _id: { $hour: "$createdAt" },
            revenue: { $sum: "$grandTotal" },
            salesCount: { $sum: 1 }
          }
        },
        { $sort: { salesCount: -1, _id: 1 } },
        { $limit: 8 }
      ]),
      this.saleModel.aggregate([
        { $match: saleMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.lineTotal" },
            cogs: { $sum: { $multiply: ["$items.costPrice", "$items.quantity"] } }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 }
      ]),
      this.saleModel.aggregate([
        { $match: saleMatch },
        { $match: { customerId: { $ne: null } } },
        {
          $group: {
            _id: "$customerId",
            revenue: { $sum: "$grandTotal" },
            visits: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 }
      ]),
      this.saleModel.aggregate([
        { $match: saleMatch },
        { $match: { cashierId: { $ne: null } } },
        {
          $group: {
            _id: "$cashierId",
            revenue: { $sum: "$grandTotal" },
            orders: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 }
      ]),
      this.productModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean(),
      this.customerModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean(),
      this.userModel.find({ businessId, deletedAt: null, ...buildBranchMatch(branchId) }).lean()
    ]);

    const monthRevenue = new Map(monthlySales.map((row: any) => [String(row._id), { revenue: Number(row.revenue ?? 0), salesCount: Number(row.salesCount ?? 0) }]));
    const monthCosts = new Map(monthlyCosts.map((row: any) => [String(row._id), Number(row.cogs ?? 0)]));
    const monthExpenseMap = new Map(monthlyExpenses.map((row: any) => [String(row._id), Number(row.expenses ?? 0)]));

    const revenueTrend = monthInterval.map((month) => {
      const key = format(month, "yyyy-MM");
      const revenue = monthRevenue.get(key)?.revenue ?? 0;
      const salesCount = monthRevenue.get(key)?.salesCount ?? 0;
      const expenses = monthExpenseMap.get(key) ?? 0;
      const profit = revenue - (monthCosts.get(key) ?? 0) - expenses;
      return {
        period: format(month, "MMM yyyy"),
        revenue,
        salesCount,
        expenses,
        profit
      };
    });

    const profitTrends = revenueTrend;
    const monthlyGrowth = revenueTrend.map((point, index) => {
      const previous = revenueTrend[index - 1]?.revenue ?? 0;
      const growthPercent = previous > 0 ? ((point.revenue - previous) / previous) * 100 : point.revenue > 0 ? 100 : 0;
      return {
        month: point.period,
        revenue: point.revenue,
        growthPercent: roundDecimal(growthPercent)
      };
    });
    const forecast = forecastRevenue(revenueTrend.map((point) => point.revenue)).map((revenue, index) => ({
      month: format(addMonths(end, index + 1), "MMM yyyy"),
      revenue: Number(revenue ?? 0)
    }));

    const revenueTotal = revenueTrend.reduce((sum, point) => sum + point.revenue, 0);
    const salesCount = revenueTrend.reduce((sum, point) => sum + point.salesCount, 0);
    const profitTotal = profitTrends.reduce((sum, point) => sum + point.profit, 0);
    const expenseTotal = revenueTrend.reduce((sum, point) => sum + point.expenses, 0);
    const inventoryValue = products.reduce((sum, product) => sum + Number(product.buyingPrice ?? 0) * Number(product.stockOnHand ?? 0), 0);
    const soldQuantity = monthlyCosts.reduce((sum, row) => sum + row.soldQuantity, 0);
    const totalStockOnHand = products.reduce((sum, product) => sum + Number(product.stockOnHand ?? 0), 0);
    const inventoryTurnover = inventoryValue > 0 ? profitSafe(monthlyCosts.reduce((sum, row) => sum + row.cogs, 0) / inventoryValue) : 0;
    const averageOrderValue = salesCount > 0 ? revenueTotal / salesCount : 0;
    const peakHourRow = peakHours[0] ?? null;
    const peakHour = peakHourRow ? formatHour(Number(peakHourRow._id)) : null;
    const peakHourSales = Number(peakHourRow?.salesCount ?? 0);
    const staffCount = users.filter((user) => user.role !== "owner" && !user.deletedAt).length;

    const customerMap = new Map(customers.map((customer) => [String(customer.externalId ?? customer._id), customer]));
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const productMap = new Map(products.map((product) => [String(product.externalId ?? product._id), product]));

    const productPerformance = topProducts.map((row: any) => ({
      productId: String(row._id),
      label: String(row.productName ?? row._id),
      value: Number(row.revenue ?? 0),
      secondaryValue: Number(row.quantity ?? 0),
      tertiaryValue: Number(row.cogs ?? 0),
      revenue: Number(row.revenue ?? 0)
    }));

    const customerPerformance = topCustomers.map((row: any) => {
      const customer = customerMap.get(String(row._id));
      return {
        customerId: String(row._id),
        label: customer?.name ?? String(row._id),
        value: Number(row.revenue ?? 0),
        secondaryValue: Number(row.visits ?? 0),
        tertiaryValue: Number(customer?.balance ?? 0),
        balance: Number(customer?.balance ?? 0)
      };
    });

    const staffPerformanceView = staffPerformance.map((row: any) => {
      const staff = userMap.get(String(row._id));
      const orders = Number(row.orders ?? 0);
      const revenue = Number(row.revenue ?? 0);
      return {
        staffId: String(row._id),
        label: staff?.roleLabel ?? staff?.fullName ?? String(row._id),
        value: revenue,
        secondaryValue: orders,
        tertiaryValue: orders > 0 ? revenue / orders : 0,
        averageTicket: orders > 0 ? revenue / orders : 0
      };
    });

    const inventoryTurnoverView = [...productMap.entries()]
      .map(([productId, product]) => {
        const sold = topProducts.find((row: any) => String(row._id) === productId);
        const soldQty = Number(sold?.quantity ?? 0);
        const stockOnHand = Number(product.stockOnHand ?? 0);
        const turnoverRate = stockOnHand > 0 ? soldQty / stockOnHand : soldQty;
        return {
          productId,
          label: product.name,
          value: turnoverRate,
          secondaryValue: soldQty,
          tertiaryValue: stockOnHand,
          stockOnHand
        };
      })
      .filter((entry) => entry.secondaryValue > 0)
      .sort((left, right) => Number(right.value) - Number(left.value))
      .slice(0, 8);

    const summary = {
      revenueTotal,
      salesCount,
      productCount: products.length,
      customerCount: customers.length,
      peakHour,
      peakHourSales,
      staffCount,
      averageOrderValue,
      profitTotal,
      monthlyGrowthPercent: monthlyGrowth.length ? monthlyGrowth[monthlyGrowth.length - 1]?.growthPercent ?? 0 : 0,
      forecastRevenue: forecast[0]?.revenue ?? 0,
      inventoryTurnover: inventoryTurnover > 0 ? inventoryTurnover : soldQuantity / Math.max(1, totalStockOnHand)
    };

    return {
      range: {
        from: start.toISOString(),
        to: end.toISOString(),
        label: buildRangeLabel(start, end)
      },
      summary,
      revenueTrend,
      salesTrend: revenueTrend.map((point) => ({
        label: point.period,
        value: point.salesCount,
        secondaryValue: point.revenue
      })),
      productPerformance,
      customerPerformance,
      peakHours: peakHours.map((row: any) => ({
        label: formatHour(Number(row._id)),
        value: Number(row.salesCount ?? 0),
        secondaryValue: Number(row.revenue ?? 0)
      })),
      staffPerformance: staffPerformanceView,
      inventoryTurnover: inventoryTurnoverView,
      profitTrends,
      monthlyGrowth,
      forecast
    } satisfies EnterpriseAnalytics;
  }
}

function buildRange(from?: string, to?: string) {
  if (!from && !to) return null;
  const start = from ? normalizeBound(from, "from") : startOfMonth(subMonths(new Date(), 11));
  const end = to ? normalizeBound(to, "to") : endOfDay(new Date());
  return { from: start, to: end };
}

function normalizeBound(value: string, bound: "from" | "to") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }
  if (value.includes("T")) return parsed;
  return bound === "from" ? startOfDay(parsed) : endOfDay(parsed);
}

function buildRangeLabel(start: Date, end: Date) {
  return format(start, "MMM d, yyyy") === format(end, "MMM d, yyyy")
    ? format(start, "MMM d, yyyy")
    : `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}

function formatHour(hour: number) {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function forecastRevenue(series: number[]) {
  if (!series.length) return [0, 0, 0];
  if (series.length === 1) return [series[0], series[0], series[0]];
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  const slope = (last - first) / Math.max(1, series.length - 1);
  return [1, 2, 3].map((step) => Math.max(0, roundDecimal(last + slope * step)));
}

function roundDecimal(value: number) {
  return Math.round(value * 100) / 100;
}

function profitSafe(value: number) {
  return Number.isFinite(value) ? roundDecimal(Math.max(0, value)) : 0;
}
