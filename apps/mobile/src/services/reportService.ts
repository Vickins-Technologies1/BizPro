import { allSql } from "@/storage/sqlite";

export async function getDashboardSummary(businessId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [sales] = await allSql<{ total: number }>(
    "SELECT COALESCE(SUM(grandTotal),0) as total FROM sales WHERE businessId = ? AND createdAt LIKE ?",
    [businessId, `${today}%`]
  );
  const [expenses] = await allSql<{ total: number }>(
    "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE businessId = ? AND expenseDate LIKE ?",
    [businessId, `${today}%`]
  );
  const [debts] = await allSql<{ total: number }>(
    "SELECT COALESCE(SUM(balanceDue),0) as total FROM sales WHERE businessId = ? AND balanceDue > 0",
    [businessId]
  );
  const [lowStock] = await allSql<{ total: number }>(
    "SELECT COUNT(*) as total FROM products WHERE businessId = ? AND stockOnHand <= lowStockThreshold AND isActive = 1",
    [businessId]
  );
  const [cogs] = await allSql<{ total: number }>(
    "SELECT COALESCE(SUM(si.costPrice * si.quantity),0) as total FROM sale_items si JOIN sales s ON s.id = si.saleId WHERE s.businessId = ? AND s.createdAt LIKE ?",
    [businessId, `${today}%`]
  );
  return {
    salesToday: sales?.total ?? 0,
    expensesToday: expenses?.total ?? 0,
    cogsTotal: cogs?.total ?? 0,
    estimatedProfit: (sales?.total ?? 0) - (expenses?.total ?? 0) - (cogs?.total ?? 0),
    debtTotal: debts?.total ?? 0,
    lowStockCount: lowStock?.total ?? 0
  };
}

export async function getTopProducts(businessId: string) {
  return allSql(
    `
    SELECT si.productId, si.productName, SUM(si.quantity) as quantity, SUM(si.lineTotal) as total
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    WHERE s.businessId = ?
    GROUP BY si.productId, si.productName
    ORDER BY quantity DESC
    LIMIT 5`,
    [businessId]
  );
}
