import type { Sale, SaleItem } from "@shared";
import { formatMoney } from "@/utils/money";

export function buildReceiptText(sale: Sale, items: SaleItem[], currency = "KES") {
  const lines = [
    "Vickins Business OS",
    `Receipt #${sale.receiptNumber}`,
    `Date: ${new Date(sale.createdAt).toLocaleString()}`,
    "--------------------------------",
    ...items.map(
      (item) =>
        `${item.productName} x${item.quantity} ${formatMoney(item.lineTotal, currency)}`
    ),
    "--------------------------------",
    `Subtotal: ${formatMoney(sale.subtotal, currency)}`,
    `Discount: ${formatMoney(sale.discountTotal, currency)}`,
    `Total: ${formatMoney(sale.grandTotal, currency)}`,
    `Paid: ${formatMoney(sale.amountPaid, currency)}`,
    `Balance: ${formatMoney(sale.balanceDue, currency)}`,
  ];
  return lines.join("\n");
}
