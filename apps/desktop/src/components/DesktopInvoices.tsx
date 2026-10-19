"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";

type InvoiceDraft = { customerName: string; customerEmail: string; description: string; quantity: string; unitPrice: string; issueDate: string; dueDate: string; taxRate: string };
type PaymentDraft = { amount: string; method: string; paymentDate: string; reference: string };
const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => dateInput(new Date());
const inThirtyDays = () => { const date = new Date(); date.setDate(date.getDate() + 30); return dateInput(date); };
const money = (amount: unknown, currency = "KES") => `${currency} ${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (value: unknown, fallback = "—") => value === undefined || value === null || value === "" ? fallback : String(value);

export function DesktopInvoices({ session }: { session: Session }) {
  const branchId = session.branches?.[0]?.id;
  const [items, setItems] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
  const [reload, setReload] = useState(0);
  const currency = session.business?.currency || "KES";

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api.invoices(branchId, 1, search).then((response) => { if (active) setItems(response.items); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load invoices."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, search, reload]);

  async function createInvoice(draft: InvoiceDraft) {
    setError("");
    await api.createInvoice({
      businessId: session.user.businessId,
      branchId: branchId ?? null,
      externalId: crypto.randomUUID(),
      customerName: draft.customerName.trim(),
      customerEmail: draft.customerEmail.trim() || null,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      paymentTerms: "Due on the selected date",
      currency,
      amountPaid: 0,
      lineItems: [{
        description: draft.description.trim(),
        quantity: Number(draft.quantity),
        unit: "unit",
        unitPrice: Number(draft.unitPrice),
        discountType: "fixed",
        discountValue: 0,
        taxCategory: Number(draft.taxRate) > 0 ? "vat" : "non_taxable",
        taxRate: Number(draft.taxRate),
        taxInclusive: false
      }]
    });
    setShowCreate(false); setReload((value) => value + 1);
  }

  async function recordPayment(invoice: Invoice, draft: PaymentDraft) {
    setBusyId(invoice.id); setError("");
    try {
      await api.recordInvoicePayment(invoice.id, {
        amount: Number(draft.amount),
        method: draft.method,
        paymentDate: draft.paymentDate,
        reference: draft.reference.trim() || null,
        externalId: crypto.randomUUID()
      }, branchId);
      setPaymentFor(null); setReload((value) => value + 1);
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Could not record invoice payment."); }
    finally { setBusyId(""); }
  }

  async function action(invoice: Invoice, kind: "send" | "cancel" | "archive") {
    setBusyId(invoice.id); setError("");
    try {
      if (kind === "send") await api.sendInvoice(invoice.id);
      else if (kind === "cancel") await api.cancelInvoice(invoice.id);
      else await api.archiveInvoice(invoice.id);
      setReload((value) => value + 1);
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : `Could not ${kind} invoice.`); }
    finally { setBusyId(""); }
  }

  return <section className="panel invoice-panel">
    <div className="panel-heading"><div><span className="eyebrow">ACCOUNTS RECEIVABLE</span><h2>Invoices</h2></div><button className="primary" onClick={() => setShowCreate(true)}>+ New invoice</button></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="toolbar"><div className="search-field">⌕<input aria-label="Search invoices" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or customer…" /></div><button className="filter-button" onClick={() => setReload((value) => value + 1)}>Refresh</button><span className="toolbar-count">{items.length} shown</span></div>
    <div className="table-panel"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Status</th><th>Total</th><th>Balance</th><th>Actions</th></tr></thead><tbody>
      {items.map((invoice) => { const terminal = ["paid", "cancelled", "void", "refunded", "archived"].includes(invoice.status); const canArchive = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "refunded"].includes(invoice.status); const busy = busyId === invoice.id; return <tr key={invoice.id}>
        <td><strong>{label(invoice.invoiceNumber, invoice.id.slice(-8))}</strong><small>Due {new Date(invoice.dueDate).toLocaleDateString()}</small></td><td>{label(invoice.customerBusinessName || invoice.customerName)}</td><td>{new Date(invoice.issueDate).toLocaleDateString()}</td><td><span className={`badge ${invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "warning" : ""}`}>{label(invoice.status)}</span></td><td>{money(invoice.grandTotal, invoice.currency || currency)}</td><td>{money(invoice.balanceDue, invoice.currency || currency)}</td><td className="invoice-actions">
          {Number(invoice.balanceDue) > 0 && !terminal ? <button className="text-button" disabled={busy} onClick={() => setPaymentFor(invoice)}>Payment</button> : null}
          {invoice.status === "draft" ? <button className="text-button" disabled={busy} onClick={() => void action(invoice, "send")}>Send</button> : null}
          {["draft", "sent", "viewed", "partially_paid"].includes(invoice.status) ? <button className="text-button" disabled={busy} onClick={() => void action(invoice, "cancel")}>Cancel</button> : null}
          {canArchive ? <button className="text-button" disabled={busy} onClick={() => void action(invoice, "archive")}>Archive</button> : null}
        </td></tr>; })}
    </tbody></table>{loading ? <div className="empty"><p>Loading invoices…</p></div> : !items.length && <div className="empty"><span>◌</span><p>{error ? "Could not load invoices." : "No invoices found. Create a draft to start tracking receivables."}</p></div>}</div>
    {showCreate ? <InvoiceCreateModal currency={currency} onClose={() => setShowCreate(false)} onSave={createInvoice} /> : null}
    {paymentFor ? <InvoicePaymentModal invoice={paymentFor} currency={currency} onClose={() => setPaymentFor(null)} onSave={(draft) => recordPayment(paymentFor, draft)} /> : null}
  </section>;
}

function InvoiceCreateModal({ currency, onClose, onSave }: { currency: string; onClose: () => void; onSave: (draft: InvoiceDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<InvoiceDraft>({ customerName: "", customerEmail: "", description: "", quantity: "1", unitPrice: "", issueDate: today(), dueDate: inThirtyDays(), taxRate: "0" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return;
    if (draft.customerName.trim().length < 2) { setError("Enter the customer’s name."); return; }
    if (!draft.description.trim()) { setError("Enter an item or service description."); return; }
    if (draft.dueDate < draft.issueDate) { setError("The due date must be on or after the issue date."); return; }
    if (!Number.isFinite(Number(draft.quantity)) || Number(draft.quantity) <= 0 || !Number.isFinite(Number(draft.unitPrice)) || Number(draft.unitPrice) < 0 || !Number.isFinite(Number(draft.taxRate)) || Number(draft.taxRate) < 0 || Number(draft.taxRate) > 100) { setError("Check the quantity, price, and tax rate."); return; }
    setSaving(true); setError(""); try { await onSave(draft); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not create the invoice."); } finally { setSaving(false); }
  }
  function field(key: keyof InvoiceDraft, title: string, type = "text", min?: number, step?: string) { return <label>{title}<input type={type} min={min} step={step} required={!["customerEmail"].includes(key)} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>; }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card invoice-form" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">DRAFT RECEIVABLE</span><h2>New invoice</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {field("customerName", "Customer name")}{field("customerEmail", "Customer email", "email")}{field("description", "Item or service")}
    <div className="invoice-field-grid">{field("quantity", "Quantity", "number", 0.001, "0.001")}{field("unitPrice", `Unit price (${currency})`, "number", 0, "0.01")}</div>
    <div className="invoice-field-grid">{field("issueDate", "Issue date", "date")}{field("dueDate", "Due date", "date")}</div>
    {field("taxRate", "Tax rate (%)", "number", 0, "0.01")}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Creating…" : "Save draft"}</button></div>
  </form></div>;
}

function InvoicePaymentModal({ invoice, currency, onClose, onSave }: { invoice: Invoice; currency: string; onClose: () => void; onSave: (draft: PaymentDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<PaymentDraft>({ amount: String(invoice.balanceDue), method: "cash", paymentDate: today(), reference: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (saving) return;
    const amount = Number(draft.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > Number(invoice.balanceDue)) { setError(`Enter a payment from 0.01 to ${Number(invoice.balanceDue).toFixed(2)}.`); return; }
    setSaving(true); setError(""); try { await onSave(draft); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not record payment."); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">RECEIVE PAYMENT</span><h2>{label(invoice.invoiceNumber, "Invoice")}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    <p className="muted">Outstanding balance: <strong>{money(invoice.balanceDue, invoice.currency || currency)}</strong></p>
    <label>Amount<input type="number" inputMode="decimal" min="0.01" max={invoice.balanceDue} step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} required /></label>
    <label>Method<select value={draft.method} onChange={(event) => setDraft((current) => ({ ...current, method: event.target.value }))}>{["cash", "mpesa", "bank", "card", "cheque", "other", "credit"].map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}</select></label>
    <label>Payment date<input type="date" value={draft.paymentDate} onChange={(event) => setDraft((current) => ({ ...current, paymentDate: event.target.value }))} required /></label>
    <label>Reference (optional)<input value={draft.reference} onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))} /></label>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Recording…" : "Record payment"}</button></div>
  </form></div>;
}
