"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ACCESS_PERMISSIONS, PAYMENT_METHODS, hasPermission, type AccessPermission, type PurchaseOrder, type Supplier, type SupplierCategory, type SupplierContact, type SupplierDocument, type SupplierPayment, type SupplierPerformanceReport, type SupplierStatement } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";

type Row = Record<string, unknown>;
type EditorKind = "supplier" | "category" | "contact" | "document" | "payment";
type SupplierTab = "overview" | "payments" | "contacts" | "documents" | "statement";
type EditorState = { kind: EditorKind; id: string; values: Record<string, string> };

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => { const value = new Date(); value.setDate(1); return value.toISOString().slice(0, 10); };
const money = (amount: unknown, currency: string) => `${currency} ${Number(amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const value = (input: unknown, fallback = "—") => input === null || input === undefined || input === "" ? fallback : String(input);
const humanize = (input: string) => input.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());

function normalizeSupplier(row: Supplier | Row): Supplier { return { ...row, id: String(row.id ?? (row as Row)._id ?? (row as Row).externalId ?? ""), isActive: (row as Supplier).isActive !== false } as Supplier; }
function asList<T>(items: T[] | undefined) { return Array.isArray(items) ? items : []; }

export function DesktopSuppliers({ session }: { session: Session }) {
  const permissions = session.user.permissions?.filter((permission): permission is AccessPermission => ACCESS_PERMISSIONS.includes(permission as AccessPermission)) ?? null;
  const canManage = hasPermission({ role: session.user.role, permissions }, "manageSuppliers");
  const branchId = session.branches?.[0]?.id;
  const currency = session.business.currency || "KES";
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [performance, setPerformance] = useState<SupplierPerformanceReport | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tab, setTab] = useState<SupplierTab>("overview");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const selected = suppliers.find((supplier) => supplier.id === selectedId) ?? null;
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const visible = useMemo(() => suppliers.filter((supplier) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesQuery = !query || [supplier.name, supplier.code, supplier.contactName, supplier.phone, supplier.email].some((field) => String(field ?? "").toLocaleLowerCase().includes(query));
    return matchesQuery && (categoryFilter === "all" || supplier.categoryId === categoryFilter);
  }), [suppliers, search, categoryFilter]);
  const selectedOrders = useMemo(() => selected ? orders.filter((order) => String(order.supplierId ?? "") === selected.id) : [], [orders, selected]);

  async function loadDirectory() {
    setLoading(true); setError("");
    try {
      const [supplierRows, categoryRows, orderRows] = await Promise.all([api.suppliers(), api.supplierCategories(), api.purchaseOrders(branchId).catch(() => [])]);
      const nextSuppliers = supplierRows.map(normalizeSupplier);
      setSuppliers(nextSuppliers); setCategories(categoryRows); setOrders(orderRows);
      setSelectedId((current) => nextSuppliers.some((supplier) => supplier.id === current) ? current : nextSuppliers[0]?.id ?? "");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load suppliers."); }
    finally { setLoading(false); }
  }

  async function loadDetails(supplierId: string) {
    if (!supplierId) { setContacts([]); setDocuments([]); setPayments([]); setStatement(null); setPerformance(null); return; }
    if (from > to) { setError("Start date must be on or before the end date."); return; }
    setDetailsLoading(true); setError("");
    try {
      const results = await Promise.allSettled([
        api.supplierContacts(supplierId), api.supplierDocuments(supplierId), api.supplierPayments(supplierId, from, to),
        api.supplierStatement(supplierId, from, to), api.supplierPerformance(supplierId, from, to)
      ]);
      const [contactResult, documentResult, paymentResult, statementResult, performanceResult] = results;
      setContacts(contactResult.status === "fulfilled" ? contactResult.value : []);
      setDocuments(documentResult.status === "fulfilled" ? documentResult.value : []);
      setPayments(paymentResult.status === "fulfilled" ? paymentResult.value : []);
      setStatement(statementResult.status === "fulfilled" ? statementResult.value : null);
      setPerformance(performanceResult.status === "fulfilled" ? performanceResult.value : null);
      const detailNames = ["contacts", "documents", "payments", "statement", "performance"];
      const failed = results.flatMap((result, index) => result.status === "rejected" ? [detailNames[index]] : []);
      if (failed.length) setError("Could not load supplier " + failed.join(", ") + ".");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load supplier details."); }
    finally { setDetailsLoading(false); }
  }

  useEffect(() => { void loadDirectory(); }, [branchId]);
  useEffect(() => { void loadDetails(selectedId); }, [selectedId, from, to]);

  function openEditor(kind: EditorKind, record?: Row | Supplier | SupplierCategory | SupplierContact | SupplierDocument | SupplierPayment) {
    const row = (record ?? {}) as Row;
    const values: Record<string, string> = {};
    if (kind === "payment") {
      Object.assign(values, { amount: "", method: "cash", purchaseOrderId: "", reference: "", note: "", paymentDate: today() });
    } else if (kind === "category") {
      Object.assign(values, { name: value(row.name, ""), description: value(row.description, ""), color: value(row.color, "#155eef"), sortOrder: value(row.sortOrder, "0") });
    } else if (kind === "supplier") {
      Object.assign(values, { name: value(row.name, ""), categoryId: value(row.categoryId, ""), code: value(row.code, ""), contactName: value(row.contactName, ""), phone: value(row.phone, ""), email: value(row.email, ""), notes: value(row.notes, "") });
    } else if (kind === "contact") {
      Object.assign(values, { name: value(row.name, ""), role: value(row.role, ""), phone: value(row.phone, ""), email: value(row.email, ""), notes: value(row.notes, ""), isPrimary: String(Boolean(row.isPrimary)) });
    } else {
      Object.assign(values, { title: value(row.title, ""), url: value(row.url, ""), fileName: value(row.fileName, ""), documentType: value(row.documentType, ""), note: value(row.note, "") });
    }
    setError(""); setEditor({ kind, id: String(row.id ?? ""), values });
  }

  async function saveEditor(event: FormEvent) {
    event.preventDefault(); if (!editor || saving || !canManage) return;
    const fields = editor.values; const field = (name: string) => (fields[name] ?? "").trim();
    if (editor.kind === "supplier" || editor.kind === "category" || editor.kind === "contact") if (field("name").length < 2) { setError("Enter a name with at least two characters."); return; }
    if (editor.kind === "document") {
      if (field("title").length < 2) { setError("Enter a document title."); return; }
      try { const url = new URL(field("url")); if (!/[a-zA-Z]/.test(url.protocol.slice(0, -1))) throw new Error(); } catch { setError("Enter a valid document URL."); return; }
    }
    if (editor.kind === "payment" && (!Number.isFinite(Number(field("amount"))) || Number(field("amount")) <= 0)) { setError("Enter a payment amount greater than zero."); return; }
    if (editor.kind === "category" && (!Number.isInteger(Number(field("sortOrder"))) || Number(field("sortOrder")) < 0)) { setError("Sort order must be a non-negative whole number."); return; }
    if (editor.kind === "payment" && (field("paymentDate") > today() || !field("paymentDate"))) { setError("Choose a valid payment date no later than today."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      if (editor.kind === "supplier") {
        const body = { name: field("name"), categoryId: field("categoryId") || null, code: field("code") || null, contactName: field("contactName") || null, phone: field("phone") || null, email: field("email") || null, notes: field("notes") || null };
        const saved = editor.id ? await api.updateSupplier(editor.id, body) : await api.createSupplier({ ...body, businessId: session.user.businessId, externalId: crypto.randomUUID() });
        const next = normalizeSupplier(saved); setSuppliers((current) => editor.id ? current.map((supplier) => supplier.id === editor.id ? next : supplier) : [next, ...current]); setSelectedId(next.id);
      } else if (editor.kind === "category") {
        const body = { name: field("name"), description: field("description") || null, color: field("color") || null, sortOrder: Number(field("sortOrder")), isActive: true };
        const saved = editor.id ? await api.updateSupplierCategory(editor.id, body) : await api.createSupplierCategory({ ...body, businessId: session.user.businessId, externalId: crypto.randomUUID() });
        setCategories((current) => editor.id ? current.map((category) => category.id === editor.id ? saved : category) : [...current, saved]);
      } else if (!selected) throw new Error("Select a supplier first.");
      else if (editor.kind === "contact") {
        const body = { name: field("name"), role: field("role") || null, phone: field("phone") || null, email: field("email") || null, notes: field("notes") || null, isPrimary: fields.isPrimary === "true" };
        const saved = editor.id ? await api.updateSupplierContact(selected.id, editor.id, body) : await api.createSupplierContact(selected.id, body);
        setContacts((current) => editor.id ? current.map((contact) => contact.id === editor.id ? saved : contact) : [saved, ...current]);
      } else if (editor.kind === "document") {
        const body = { title: field("title"), url: field("url"), fileName: field("fileName") || null, documentType: field("documentType") || null, note: field("note") || null };
        const saved = editor.id ? await api.updateSupplierDocument(selected.id, editor.id, body) : await api.createSupplierDocument(selected.id, body);
        setDocuments((current) => editor.id ? current.map((document) => document.id === editor.id ? saved : document) : [saved, ...current]);
      } else {
        const body = { externalId: crypto.randomUUID(), purchaseOrderId: field("purchaseOrderId") || null, amount: Number(field("amount")), method: field("method"), reference: field("reference") || null, note: field("note") || null, paymentDate: field("paymentDate") };
        const saved = await api.createSupplierPayment(selected.id, body); setPayments((current) => [saved, ...current]); void loadDetails(selected.id);
      }
      setEditor(null); setNotice(`${humanize(editor.kind)} ${editor.id ? "updated" : "saved"}.`);
      if (editor.kind === "supplier") void loadDirectory();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : `Could not save ${editor.kind}.`); }
    finally { setSaving(false); }
  }

  async function archive(kind: "supplier" | "category" | "contact" | "document" | "payment", id: string, name: string) {
    if (!canManage || !id || !window.confirm(`Archive ${name}?`)) return;
    setError(""); setNotice("");
    try {
      if (kind === "supplier") {
        const archived = normalizeSupplier(await api.archiveSupplier(id)); setSuppliers((current) => current.map((supplier) => supplier.id === id ? archived : supplier));
      } else if (kind === "category") {
        await api.archiveSupplierCategory(id); setCategories((current) => current.filter((category) => category.id !== id));
      } else if (kind === "contact" && selected) { await api.archiveSupplierContact(selected.id, id); setContacts((current) => current.filter((contact) => contact.id !== id)); }
      else if (kind === "document" && selected) { await api.archiveSupplierDocument(selected.id, id); setDocuments((current) => current.filter((document) => document.id !== id)); }
      else if (kind === "payment" && selected) { await api.archiveSupplierPayment(selected.id, id); setPayments((current) => current.filter((payment) => payment.id !== id)); void loadDetails(selected.id); }
      setNotice(`${humanize(kind)} archived.`);
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : `Could not archive ${kind}.`); }
  }

  const tabs: Array<[SupplierTab, string]> = [["overview", "Overview"], ["payments", "Payments"], ["contacts", "Contacts"], ["documents", "Documents"], ["statement", "Statement"]];
  return <>
    <div className="page-heading"><div><span className="eyebrow">PURCHASING</span><h1>Suppliers</h1><p>Manage vendor relationships, payment history, documents, and statements.</p></div><div className="heading-actions">{canManage ? <><button className="secondary" onClick={() => openEditor("category")}>+ Category</button><button className="primary" onClick={() => openEditor("supplier")}>+ Supplier</button></> : null}</div></div>
    {error ? <div className="error-banner" role="alert">{error}</div> : null}{notice ? <div className="success-banner" role="status">{notice}</div> : null}
    <div className="supplier-layout"><aside className="panel supplier-directory"><div className="panel-heading"><h2>Directory</h2><span className="badge">{visible.length}</span></div><input aria-label="Search suppliers" placeholder="Search name, code, contact…" value={search} onChange={(event) => setSearch(event.target.value)} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{categories.length && canManage ? <div className="supplier-category-list">{categories.map((category) => <div className="supplier-category-row" key={category.id}><button className="text-button" onClick={() => setCategoryFilter(category.id)}>{category.name}</button><button className="text-button" onClick={() => openEditor("category", category)}>Edit</button><button className="text-button" onClick={() => void archive("category", category.id, category.name)}>×</button></div>)}</div> : null}{loading ? <div className="empty">Loading suppliers…</div> : visible.length ? visible.map((supplier) => <button type="button" className={`supplier-list-item ${selectedId === supplier.id ? "selected" : ""}`} key={supplier.id} onClick={() => setSelectedId(supplier.id)}><strong>{supplier.name}</strong><small>{supplier.code || "No code"} · {supplier.contactName || supplier.phone || "No contact"}</small><span className={`badge ${supplier.isActive ? "success" : "warning"}`}>{supplier.isActive ? "Active" : "Archived"}</span></button>) : <div className="empty">No suppliers match this search.</div>}</aside>
      <main className="supplier-workspace">{selected ? <><section className="panel supplier-summary"><div className="panel-heading"><div><span className="eyebrow">SUPPLIER</span><h2>{selected.name}</h2><p>{[selected.code, selected.contactName, selected.phone, selected.email].filter(Boolean).join(" · ") || "Contact details not provided"}</p></div><div className="heading-actions">{canManage ? <><button className="secondary" onClick={() => openEditor("supplier", selected)}>Edit</button>{selected.isActive ? <button className="text-button" onClick={() => void archive("supplier", selected.id, selected.name)}>Archive</button> : null}<button className="primary" onClick={() => openEditor("payment")}>+ Record payment</button></> : null}</div></div><div className="metric-grid"><Metric label="Outstanding" amount={performance?.outstandingBalance ?? statement?.outstandingBalance ?? 0} currency={currency} tone="amber" /><Metric label="Purchase orders" amount={performance?.ordersCount ?? selectedOrders.length} currency="" tone="blue" /><Metric label="Paid this period" amount={performance?.paidTotal ?? statement?.paidTotal ?? 0} currency={currency} tone="green" /><Metric label="Payment coverage" amount={`${Number(performance?.paymentCoveragePercent ?? 0).toFixed(1)}%`} currency="" tone="purple" /></div><div className="supplier-range"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} max={today()} onChange={(event) => setTo(event.target.value)} /></label><button className="secondary" onClick={() => void loadDetails(selected.id)} disabled={detailsLoading}>{detailsLoading ? "Loading…" : "Refresh range"}</button></div><nav className="supplier-tabs" aria-label="Supplier detail sections">{tabs.map(([key, label]) => <button type="button" className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)}>{label}{key === "payments" ? ` · ${payments.length}` : key === "contacts" ? ` · ${contacts.length}` : key === "documents" ? ` · ${documents.length}` : ""}</button>)}</nav></section>
      {tab === "overview" ? <div className="supplier-detail-grid"><section className="panel"><div className="panel-heading"><h2>Performance</h2><span>{from} – {to}</span></div><div className="finance-breakdown">{[["Orders", String(performance?.ordersCount ?? 0)], ["Billed", money(performance?.billedTotal, currency)], ["Paid", money(performance?.paidTotal, currency)], ["Average order", money(performance?.averageOrderValue, currency)]].map(([label, amount]) => <div className="finance-row" key={label}><strong>{label}</strong><span>{amount}</span></div>)}</div></section><section className="panel"><div className="panel-heading"><h2>Purchase orders</h2><span>{selectedOrders.length} linked</span></div>{selectedOrders.length ? selectedOrders.slice(0, 8).map((order) => <div className="supplier-row" key={order.id}><div><strong>{order.orderNumber}</strong><small>{new Date(order.orderDate).toLocaleDateString()} · {order.status.replaceAll("_", " ")}</small></div><b>{money(order.total, currency)}</b></div>) : <div className="empty">No purchase orders are linked to this supplier.</div>}</section></div> : null}
      {tab === "payments" ? <section className="panel"><div className="panel-heading"><h2>Payments</h2>{canManage ? <button className="primary" onClick={() => openEditor("payment")}>+ Record payment</button> : null}</div>{payments.length ? payments.map((payment) => <div className="supplier-row" key={payment.id}><div><strong>{money(payment.amount, currency)} · {payment.method.toUpperCase()}</strong><small>{new Date(payment.paymentDate).toLocaleDateString()}{payment.reference ? ` · ${payment.reference}` : ""}{payment.note ? ` · ${payment.note}` : ""}</small></div>{canManage ? <button className="text-button" onClick={() => void archive("payment", payment.id, "payment")}>Archive</button> : null}</div>) : <div className="empty">No payments in the selected date range.</div>}</section> : null}
      {tab === "contacts" ? <section className="panel"><div className="panel-heading"><h2>Contacts</h2>{canManage ? <button className="primary" onClick={() => openEditor("contact")}>+ Add contact</button> : null}</div>{contacts.length ? contacts.map((contact) => <div className="supplier-row" key={contact.id}><div><strong>{contact.name}{contact.isPrimary ? " · Primary" : ""}</strong><small>{[contact.role, contact.phone, contact.email, contact.notes].filter(Boolean).join(" · ") || "No additional details"}</small></div>{canManage ? <div className="heading-actions"><button className="text-button" onClick={() => openEditor("contact", contact)}>Edit</button><button className="text-button" onClick={() => void archive("contact", contact.id, contact.name)}>Archive</button></div> : null}</div>) : <div className="empty">No supplier contacts recorded.</div>}</section> : null}
      {tab === "documents" ? <section className="panel"><div className="panel-heading"><h2>Documents</h2>{canManage ? <button className="primary" onClick={() => openEditor("document")}>+ Add document</button> : null}</div>{documents.length ? documents.map((document) => <div className="supplier-row" key={document.id}><div><strong>{document.title}</strong><small>{[document.documentType, document.fileName, document.note].filter(Boolean).join(" · ")}</small><a href={document.url} target="_blank" rel="noreferrer">Open document ↗</a></div>{canManage ? <div className="heading-actions"><button className="text-button" onClick={() => openEditor("document", document)}>Edit</button><button className="text-button" onClick={() => void archive("document", document.id, document.title)}>Archive</button></div> : null}</div>) : <div className="empty">No supplier documents recorded.</div>}</section> : null}
      {tab === "statement" ? <section className="panel"><div className="panel-heading"><h2>Statement</h2><span>{statement?.range.label ?? `${from} – ${to}`}</span></div>{statement ? <><div className="metric-grid"><Metric label="Opening balance" amount={statement.openingBalance} currency={currency} tone="blue"/><Metric label="Billed" amount={statement.billedTotal} currency={currency} tone="amber"/><Metric label="Paid" amount={statement.paidTotal} currency={currency} tone="green"/><Metric label="Outstanding" amount={statement.outstandingBalance} currency={currency} tone="red"/></div><div className="table-panel"><table><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{statement.entries.map((entry, index) => <tr key={`${entry.reference}-${entry.date}-${index}`}><td>{new Date(entry.date).toLocaleDateString()}</td><td>{entry.reference}</td><td>{entry.description}</td><td>{money(entry.debit, currency)}</td><td>{money(entry.credit, currency)}</td><td>{money(entry.balance, currency)}</td></tr>)}</tbody></table>{!statement.entries.length ? <div className="empty">No ledger activity in this period.</div> : null}</div></> : <div className="empty">{detailsLoading ? "Loading statement…" : "Statement unavailable."}</div>}</section> : null}
      </> : <section className="panel"><div className="empty">{loading ? "Loading suppliers…" : "Select a supplier to see its purchasing and payment workspace."}</div></section>}</main></div>
    {editor ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null); }}><form className="modal-card supplier-editor" onSubmit={(event) => void saveEditor(event)}><div className="panel-heading"><div><span className="eyebrow">SUPPLIER WORKSPACE</span><h2>{editor.id ? "Edit" : "Add"} {humanize(editor.kind)}</h2></div><button type="button" className="text-button" onClick={() => setEditor(null)} disabled={saving}>Close</button></div>{editor.kind === "supplier" ? <><label>Supplier name<input autoFocus required value={editor.values.name} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, name: event.target.value } })}/></label><label>Category<select value={editor.values.categoryId} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, categoryId: event.target.value } })}><option value="">Uncategorized</option>{categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{textInputs(["code", "contactName", "phone", "email", "notes"], editor, setEditor)}</> : null}{editor.kind === "category" ? textInputs(["name", "description", "color", "sortOrder"], editor, setEditor) : null}{editor.kind === "contact" ? <>{textInputs(["name", "role", "phone", "email", "notes"], editor, setEditor)}<label className="checkbox-row"><input type="checkbox" checked={editor.values.isPrimary === "true"} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, isPrimary: String(event.target.checked) } })}/> Primary contact</label></> : null}{editor.kind === "document" ? textInputs(["title", "url", "fileName", "documentType", "note"], editor, setEditor) : null}{editor.kind === "payment" ? <><label>Amount<input autoFocus type="number" min="0.01" step="0.01" required value={editor.values.amount} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, amount: event.target.value } })}/></label><label>Method<select value={editor.values.method} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, method: event.target.value } })}>{PAYMENT_METHODS.filter((method) => ["cash", "mpesa", "bank", "credit"].includes(method)).map((method) => <option key={method} value={method}>{method.toUpperCase()}</option>)}</select></label><label>Purchase order<select value={editor.values.purchaseOrderId} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, purchaseOrderId: event.target.value } })}><option value="">Unlinked payment</option>{selectedOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {money(order.total, currency)}</option>)}</select></label>{textInputs(["paymentDate", "reference", "note"], editor, setEditor)}</> : null}{error ? <div className="error-banner" role="alert">{error}</div> : null}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setEditor(null)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : editor.id ? "Save changes" : `Save ${editor.kind}`}</button></div></form></div> : null}
  </>;
}

function textInputs(keys: string[], editor: EditorState, setEditor: (next: EditorState) => void) {
  return keys.map((key) => <label key={key}>{humanize(key)}<input type={key === "paymentDate" ? "date" : key === "sortOrder" ? "number" : key === "email" ? "email" : key === "phone" ? "tel" : "text"} min={key === "sortOrder" ? 0 : undefined} step={key === "sortOrder" ? 1 : undefined} required={key === "name" || key === "title" || key === "url" || key === "paymentDate"} value={editor.values[key] ?? ""} onChange={(event) => setEditor({ ...editor, values: { ...editor.values, [key]: event.target.value } })}/></label>);
}

function Metric({ label, amount, currency, tone }: { label: string; amount: unknown; currency: string; tone: string }) { return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{currency ? money(amount, currency) : value(amount, "0")}</strong></div>; }
