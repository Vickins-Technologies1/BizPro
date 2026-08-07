import type { Sale, SaleItem } from "@shared";
import { format } from "date-fns";
import { formatMoney } from "@/utils/money";

export type ReceiptArtifacts = {
  text: string;
  html: string;
  fileName: string;
  servedBy: string;
};

export function buildReceiptText(sale: Sale, items: SaleItem[], currency = "KES", servedBy = "Staff", businessName = "Biz Pro") {
  return buildReceiptArtifacts(sale, items, currency, servedBy, businessName).text;
}

export function buildReceiptArtifacts(sale: Sale, items: SaleItem[], currency = "KES", servedBy = "Staff", businessName = "Biz Pro"): ReceiptArtifacts {
  const saleDate = new Date(sale.createdAt);
  const formattedDate = format(saleDate, "MMM d, yyyy h:mm a");
  const servedByLabel = servedBy.trim() || "Staff";
  const receiptTitle = `Receipt #${sale.receiptNumber}`;
  const lines = [
    "Biz Pro",
    receiptTitle,
    `Date: ${formattedDate}`,
    `Served by: ${servedByLabel}`,
    "--------------------------------",
    ...items.map((item) => `${item.productName} x${item.quantity} ${formatMoney(item.lineTotal, currency)}`),
    "--------------------------------",
    `Subtotal: ${formatMoney(sale.subtotal, currency)}`,
    `Discount: ${formatMoney(sale.discountTotal, currency)}`,
    `Total: ${formatMoney(sale.grandTotal, currency)}`,
    `Paid: ${formatMoney(sale.amountPaid, currency)}`,
    `Balance: ${formatMoney(sale.balanceDue, currency)}`
  ];

  const html = renderReceiptHtml({
    businessName,
    receiptTitle,
    formattedDate,
    servedBy: servedByLabel,
    sale,
    items,
    currency
  });

  return {
    text: lines.join("\n"),
    html,
    fileName: buildReceiptFileName(sale.receiptNumber, servedByLabel),
    servedBy: servedByLabel
  };
}

function renderReceiptHtml({
  businessName,
  receiptTitle,
  formattedDate,
  servedBy,
  sale,
  items,
  currency
}: {
  businessName: string;
  receiptTitle: string;
  formattedDate: string;
  servedBy: string;
  sale: Sale;
  items: SaleItem[];
  currency: string;
}) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td class="item-name">${escapeHtml(item.productName)}</td>
          <td class="item-qty">${item.quantity}</td>
          <td class="item-total">${escapeHtml(formatMoney(item.lineTotal, currency))}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 20px;
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
          background: #ffffff;
        }
        .receipt {
          width: 100%;
          max-width: 360px;
          margin: 0 auto;
        }
        .brand {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.4px;
          margin-bottom: 4px;
        }
        .title {
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #1d4ed8;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .meta {
          font-size: 11px;
          line-height: 1.55;
          color: #475569;
          margin-bottom: 12px;
        }
        .rule {
          height: 1px;
          background: #cbd5e1;
          margin: 12px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        td {
          padding: 5px 0;
          vertical-align: top;
        }
        .item-name {
          width: 62%;
          padding-right: 8px;
        }
        .item-qty {
          width: 14%;
          text-align: center;
          color: #475569;
        }
        .item-total {
          width: 24%;
          text-align: right;
          font-weight: 700;
        }
        .totals {
          font-size: 11px;
          line-height: 1.7;
          color: #0f172a;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .totals-row strong {
          font-weight: 800;
        }
        .footer {
          margin-top: 14px;
          font-size: 10px;
          text-align: center;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="brand">${escapeHtml(businessName)}</div>
        <div class="title">${escapeHtml(receiptTitle)}</div>
        <div class="meta">
          <div>Date: ${escapeHtml(formattedDate)}</div>
          <div>Served by: ${escapeHtml(servedBy)}</div>
        </div>
        <div class="rule"></div>
        <table>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="rule"></div>
        <div class="totals">
          <div class="totals-row"><span>Subtotal</span><strong>${escapeHtml(formatMoney(sale.subtotal, currency))}</strong></div>
          <div class="totals-row"><span>Discount</span><strong>${escapeHtml(formatMoney(sale.discountTotal, currency))}</strong></div>
          <div class="totals-row"><span>Total</span><strong>${escapeHtml(formatMoney(sale.grandTotal, currency))}</strong></div>
          <div class="totals-row"><span>Paid</span><strong>${escapeHtml(formatMoney(sale.amountPaid, currency))}</strong></div>
          <div class="totals-row"><span>Balance</span><strong>${escapeHtml(formatMoney(sale.balanceDue, currency))}</strong></div>
        </div>
        <div class="footer">Thank you for your business</div>
      </div>
    </body>
  </html>`;
}

function buildReceiptFileName(receiptNumber: string, servedBy: string) {
  const safeServedBy = servedBy
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `receipt-${receiptNumber.toLowerCase()}-${safeServedBy || "staff"}.pdf`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
