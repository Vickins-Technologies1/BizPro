"use client";

import { useEffect, useMemo, useState } from "react";
import { PAYMENT_METHODS, PAYMENT_STATUSES, type Sale } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";
import styles from "./DesktopSalesHistory.module.css";

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number.isFinite(amount) ? amount : 0); }
  catch { return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`; }
}

function csv(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function saleDate(sale: Sale) { return new Date(sale.createdAt); }

export function DesktopSalesHistory({ session }: { session: Session }) {
  const branchId = session.user.branchId ?? session.branches?.find((branch) => branch.isDefault)?.id ?? session.branches?.[0]?.id ?? null;
  const currency = session.business.currency || "KES";
  const [sales, setSales] = useState<Sale[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Sale | null>(null);
  const pageSize = 25;

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    api.sales(branchId).then((next) => { if (live) setSales(next); })
      .catch((loadError) => { if (live) setError(loadError instanceof Error ? loadError.message : "Could not load sales history."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [branchId, reload]);

  const filtered = useMemo(() => sales.filter((sale) => {
    const search = `${sale.receiptNumber} ${sale.customerId ?? ""} ${sale.paymentMethod} ${sale.notes ?? ""} ${sale.items.map((item) => item.productName).join(" ")}`.toLowerCase();
    const date = saleDate(sale);
    const afterFrom = !from || date >= new Date(`${from}T00:00:00`);
    const beforeTo = !to || date < new Date(`${to}T23:59:59.999`);
    return search.includes(query.trim().toLowerCase()) && (status === "all" || sale.paymentStatus === status) && (method === "all" || sale.paymentMethod === method) && afterFrom && beforeTo;
  }).sort((a, b) => saleDate(b).getTime() - saleDate(a).getTime()), [sales, query, status, method, from, to]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalValue = filtered.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);

  function exportCsv() {
    const header = ["Date", "Receipt", "Customer ID", "Items", "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance", "Status", "Method"];
    const data = filtered.map((sale) => [saleDate(sale).toISOString(), sale.receiptNumber, sale.customerId ?? "", sale.items.map((item) => `${item.quantity} x ${item.productName}`).join("; "), sale.subtotal, sale.discountTotal, sale.taxTotal, sale.grandTotal, sale.amountPaid, sale.balanceDue, sale.paymentStatus, sale.paymentMethod]);
    const blob = new Blob([[header, ...data].map((row) => row.map(csv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `dira-sales-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">SALES</span><h1>Sales history</h1><p>Search, filter, review sale details, and print or export receipts.</p></div><div className="heading-actions"><button className="secondary" onClick={() => setReload((value) => value + 1)}>Refresh</button><button className="primary" onClick={exportCsv} disabled={!filtered.length}>Export CSV</button></div></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className={`toolbar ${styles.filters}`}><div className="search-field">⌕<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Receipt, product, customer ID…" /></div><select aria-label="Payment status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option>{PAYMENT_STATUSES.map((value) => <option value={value} key={value}>{value.replace(/_/g, " ")}</option>)}</select><select aria-label="Payment method" value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}><option value="all">All payment methods</option>{PAYMENT_METHODS.map((value) => <option value={value} key={value}>{value === "mpesa" ? "M-Pesa" : value}</option>)}</select><label>From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label><label>To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label><span className="toolbar-count">{filtered.length} records · {money(totalValue, currency)}</span></div>
    <div className="table-panel panel"><table><thead><tr><th>Date</th><th>Receipt</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th><th>Method</th><th>Actions</th></tr></thead><tbody>{rows.map((sale) => <tr key={sale.id}><td>{saleDate(sale).toLocaleString()}</td><td><strong>{sale.receiptNumber}</strong></td><td>{sale.customerId ?? "Walk-in"}</td><td>{sale.items.length} · {sale.items.slice(0, 2).map((item) => item.productName).join(", ")}{sale.items.length > 2 ? "…" : ""}</td><td>{money(sale.grandTotal, currency)}</td><td>{money(sale.amountPaid, currency)}</td><td><span className={`badge ${sale.paymentStatus === "paid" ? "success" : "warning"}`}>{sale.paymentStatus}</span></td><td>{sale.paymentMethod === "mpesa" ? "M-Pesa" : sale.paymentMethod}</td><td><button className="text-button" onClick={() => setSelected(sale)}>Details / receipt</button></td></tr>)}</tbody></table>{!loading && !rows.length && <div className="empty">{error ? "Could not load sales." : "No sales match these filters."}</div>}{loading && <div className="empty">Loading sales…</div>}</div>
    {pageCount > 1 && <div className={styles.pagination}><button className="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="secondary" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    {selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><div className={`modal-card ${styles.receipt} ${styles.salesReceipt}`} role="dialog" aria-modal="true" aria-labelledby="sale-detail-title" onClick={(event) => event.stopPropagation()}><div className="panel-heading"><div><span className="eyebrow">{saleDate(selected).toLocaleString()}</span><h2 id="sale-detail-title">Receipt {selected.receiptNumber}</h2></div><button className="text-button" onClick={() => setSelected(null)}>Close</button></div><div className={styles.itemList}>{selected.items.map((item, index) => <div className={styles.item} key={`${item.productId}-${index}`}><div><strong>{item.productName}</strong><small>{item.quantity} × {money(item.unitPrice, currency)}{item.lineDiscount ? ` · discount ${money(item.lineDiscount, currency)}` : ""}</small></div><b>{money(item.lineTotal, currency)}</b></div>)}</div><div className="basket-total"><span>Subtotal</span><b>{money(selected.subtotal, currency)}</b><span>Discount</span><b>{money(selected.discountTotal, currency)}</b><span>Tax</span><b>{money(selected.taxTotal, currency)}</b><strong>Total</strong><strong>{money(selected.grandTotal, currency)}</strong><span>Paid · {selected.paymentMethod}</span><b>{money(selected.amountPaid, currency)}</b><span>Balance due</span><b>{money(selected.balanceDue, currency)}</b></div>{selected.notes && <p className={styles.notes}>{selected.notes}</p>}<div className="modal-actions"><button className="secondary" onClick={() => window.print()}>Print receipt</button><button className="primary" onClick={() => setSelected(null)}>Done</button></div></div></div>}
  </>;
}
