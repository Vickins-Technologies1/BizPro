"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { bankAccountCreateSchema, creditNoteCreateSchema, hasPermission, pettyCashEntryCreateSchema, type AccessPermission, type BankAccount, type CreditNote, type Expense, type FinanceOverview, type FinancePayment, type PettyCashEntry } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";

type Preset = "today" | "week" | "month" | "year" | "custom";
type Range = { from: string; to: string };
type FinanceData = { overview: FinanceOverview; payments: FinancePayment[]; credits: CreditNote[]; accounts: BankAccount[]; petty: PettyCashEntry[]; expenses: Expense[] };
type FinanceProps = { session: Session };

const blankFinance: FinanceData = { overview: { incomeTotal: 0, expensesTotal: 0, profitLossTotal: 0, cashFlowTotal: 0, taxTotal: 0, invoiceCount: 0, invoiceTotal: 0, creditNoteCount: 0, creditNoteTotal: 0, paymentTotal: 0, bankBalanceTotal: 0, pettyCashBalance: 0 }, payments: [], credits: [], accounts: [], petty: [], expenses: [] };

export function DesktopFinance({ session }: FinanceProps) {
  const branchId = session.branches?.[0]?.id ?? null;
  const currency = session.business.currency || "KES";
  const canManage = hasPermission({ role: session.user.role, permissions: (session.user.permissions ?? []) as AccessPermission[] }, "manageExpenses");
  const initial = presetRange("month");
  const [preset, setPreset] = useState<Preset>("month");
  const [range, setRange] = useState<Range>(initial);
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<"bank" | "petty" | "credit" | "" > ("");
  const [bank, setBank] = useState({ bankName: "", accountName: "", accountNumber: "", currency, openingBalance: "0", isPrimary: false, notes: "" });
  const [petty, setPetty] = useState({ label: "", amount: "", direction: "out" as "in" | "out", category: "", note: "", entryDate: localDateKey(new Date()) });
  const [credit, setCredit] = useState({ reference: "", amount: "", reason: "", note: "", creditDate: localDateKey(new Date()), status: "draft" as "draft" | "issued" | "void" });
  const requestId = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const id = ++requestId.current;
    if (range.from > range.to) { setError("Start date must be on or before the end date."); setLoading(false); return; }
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [overview, payments, credits, accounts, pettyEntries, expenses] = await Promise.all([
        api.financeOverview(branchId, range.from, range.to),
        api.financePayments(branchId, range.from, range.to),
        api.financeCreditNotes(branchId, range.from, range.to),
        api.bankAccounts(),
        api.pettyCashEntries(branchId, range.from, range.to),
        api.expenses(branchId)
      ]);
      if (requestId.current !== id) return;
      setData({ overview, payments, credits, accounts, petty: pettyEntries, expenses: expenses.filter((item) => item.expenseDate.slice(0, 10) >= range.from && item.expenseDate.slice(0, 10) <= range.to) });
    } catch (loadError) {
      if (requestId.current === id) setError(loadError instanceof Error ? loadError.message : "Could not load finance records.");
    } finally { if (requestId.current === id) setLoading(false); }
  }, [branchId, range.from, range.to]);

  useEffect(() => { void load(); return () => { requestId.current += 1; }; }, [load]);

  function choosePreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") setRange(presetRange(next));
  }

  async function archive(kind: "bank" | "petty" | "credit", id: string) {
    if (!canManage || saving) return;
    setSaving(true); setError("");
    try {
      if (kind === "bank") await api.archiveBankAccount(id);
      else if (kind === "petty") await api.archivePettyCashEntry(id);
      else await api.archiveFinanceCreditNote(id);
      await load(true);
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Could not archive this finance record."); }
    finally { setSaving(false); }
  }

  async function submitBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage || saving) return;
    const parsed = bankAccountCreateSchema.safeParse({ businessId: session.user.businessId, bankName: bank.bankName.trim(), accountName: bank.accountName.trim(), accountNumber: bank.accountNumber.trim() || null, currency: bank.currency.trim().toUpperCase(), openingBalance: Number(bank.openingBalance), currentBalance: Number(bank.openingBalance), isPrimary: bank.isPrimary, notes: bank.notes.trim() || null });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the bank account fields."); return; }
    setSaving(true); setError("");
    try { await api.createBankAccount({ ...parsed.data, externalId: createExternalId() }); setForm(""); setBank({ bankName: "", accountName: "", accountNumber: "", currency, openingBalance: "0", isPrimary: false, notes: "" }); await load(true); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not add the bank account."); }
    finally { setSaving(false); }
  }

  async function submitPetty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage || saving) return;
    const parsed = pettyCashEntryCreateSchema.safeParse({ businessId: session.user.businessId, label: petty.label.trim(), amount: Number(petty.amount), direction: petty.direction, category: petty.category.trim() || null, note: petty.note.trim() || null, recordedById: session.user.id, entryDate: petty.entryDate });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the petty cash fields."); return; }
    setSaving(true); setError("");
    try { await api.createPettyCashEntry({ ...parsed.data, externalId: createExternalId() }); setForm(""); setPetty({ label: "", amount: "", direction: "out", category: "", note: "", entryDate: localDateKey(new Date()) }); await load(true); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not add the petty cash entry."); }
    finally { setSaving(false); }
  }

  async function submitCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage || saving) return;
    const parsed = creditNoteCreateSchema.safeParse({ businessId: session.user.businessId, reference: credit.reference.trim(), amount: Number(credit.amount), reason: credit.reason.trim(), note: credit.note.trim() || null, creditDate: credit.creditDate, status: credit.status });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the credit note fields."); return; }
    setSaving(true); setError("");
    try { await api.createFinanceCreditNote({ ...parsed.data, businessId: session.user.businessId, branchId, externalId: createExternalId() }); setForm(""); setCredit({ reference: "", amount: "", reason: "", note: "", creditDate: localDateKey(new Date()), status: "draft" }); await load(true); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not create the credit note."); }
    finally { setSaving(false); }
  }

  const scopedExpenses = data?.expenses ?? [];
  const reportHtml = useMemo(() => buildFinanceHtml(data, currency, range), [data, currency, range]);
  const overview = data?.overview;
  const dates = `${range.from} to ${range.to}`;

  function exportExcel() {
    if (!data) return;
    downloadHtml(reportHtml, `dira-os-finance-${range.from}-to-${range.to}.xls`, "application/vnd.ms-excel;charset=utf-8");
  }
  function exportPdf() {
    if (!data) return;
    const blobUrl = URL.createObjectURL(new Blob([reportHtml], { type: "text/html;charset=utf-8" }));
    const printWindow = window.open(blobUrl, "_blank");
    if (!printWindow) { URL.revokeObjectURL(blobUrl); setError("Allow the report window to open, then print or save it as a PDF."); return; }
    printWindow.addEventListener("load", () => { printWindow.focus(); printWindow.print(); window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000); }, { once: true });
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">FINANCE</span><h1>Finance overview</h1><p>Review income, outflow, invoices, cash, and payment records for a selected period.</p></div><div className="heading-actions"><button className="secondary" disabled={!data || loading} onClick={exportPdf}>Export PDF</button><button className="secondary" disabled={!data || loading} onClick={exportExcel}>Export Excel</button><button className="secondary" disabled={loading} onClick={() => void load()}>Refresh</button></div></div>
    <section className="panel report-filters"><div className="preference-list"><label>Reporting period<select value={preset} onChange={(event) => choosePreset(event.target.value as Preset)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom range</option></select></label><label>From<input type="date" max={range.to} value={range.from} onChange={(event) => { setPreset("custom"); setRange((current) => ({ ...current, from: event.target.value })); }} /></label><label>To<input type="date" min={range.from} max={localDateKey(new Date())} value={range.to} onChange={(event) => { setPreset("custom"); setRange((current) => ({ ...current, to: event.target.value })); }} /></label></div></section>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="metric-grid"><Metric label="Income" value={formatMoney(overview?.incomeTotal, currency)} delta={dates} tone="blue" /><Metric label="Expenses" value={formatMoney(overview?.expensesTotal, currency)} delta={dates} tone="amber" /><Metric label="Profit & loss" value={formatMoney(overview?.profitLossTotal, currency)} delta="Selected period" tone="green" /><Metric label="Cash flow" value={formatMoney(overview?.cashFlowTotal, currency)} delta="Selected period" tone="blue" /><Metric label="Tax" value={formatMoney(overview?.taxTotal, currency)} delta="Selected period" tone="red" /><Metric label="Payments" value={formatMoney(overview?.paymentTotal, currency)} delta={`${data?.payments.length ?? 0} records`} tone="green" /><Metric label="Open invoices" value={formatMoney(overview?.invoiceTotal, currency)} delta={`${overview?.invoiceCount ?? 0} invoices`} tone="amber" /><Metric label="Credit notes" value={formatMoney(overview?.creditNoteTotal, currency)} delta={`${overview?.creditNoteCount ?? 0} records`} tone="red" /><Metric label="Bank accounts" value={formatMoney(overview?.bankBalanceTotal, currency)} delta={`${data?.accounts.length ?? 0} accounts`} tone="blue" /><Metric label="Petty cash" value={formatMoney(overview?.pettyCashBalance, currency)} delta="Current balance" tone="amber" /></div>
    {loading && !data ? <section className="panel"><p className="muted">Loading finance records…</p></section> : !data ? <section className="panel"><p className="muted">Finance data is unavailable. Use Refresh to try again.</p><button className="secondary" onClick={() => void load()}>Try again</button></section> : <>
      <section className="dashboard-grid">
        <RecordsPanel title="Payments" empty="No payments were recorded in this period.">{data.payments.map((payment) => <FinanceRow key={payment.id} title={payment.method.replaceAll("_", " ")} subtitle={payment.note || payment.reference || payment.saleId || payment.invoiceId || "Payment record"} amount={payment.amount} currency={paymentCurrency(payment, currency)} badge={payment.status} />)}</RecordsPanel>
        <RecordsPanel title="Credit notes" empty="No credit notes were recorded in this period." action={canManage ? <button className="secondary" onClick={() => setForm(form === "credit" ? "" : "credit")}>+ Create credit note</button> : undefined}>{data.credits.map((note) => <FinanceRow key={note.id} title={note.reference} subtitle={`${note.reason} · ${note.creditDate.slice(0, 10)}`} amount={note.amount} currency={currency} badge={note.status} action={canManage ? <button className="text-button" disabled={saving} onClick={() => void archive("credit", note.id)}>Archive</button> : undefined} />)}</RecordsPanel>
      </section>
      {form === "credit" && canManage && <form className="panel finance-form" onSubmit={submitCredit}><div className="panel-heading"><h2>Create credit note</h2><button type="button" className="text-button" onClick={() => setForm("")}>Close</button></div><div className="finance-form-grid"><label>Reference<input required minLength={2} value={credit.reference} onChange={(event) => setCredit((value) => ({ ...value, reference: event.target.value }))} /></label><label>Amount<input required type="number" min="0.01" step="0.01" value={credit.amount} onChange={(event) => setCredit((value) => ({ ...value, amount: event.target.value }))} /></label><label>Credit date<input required type="date" value={credit.creditDate} onChange={(event) => setCredit((value) => ({ ...value, creditDate: event.target.value }))} /></label><label>Status<select value={credit.status} onChange={(event) => setCredit((value) => ({ ...value, status: event.target.value as typeof value.status }))}><option value="draft">Draft</option><option value="issued">Issued</option><option value="void">Void</option></select></label><label className="wide">Reason<input required minLength={2} value={credit.reason} onChange={(event) => setCredit((value) => ({ ...value, reason: event.target.value }))} /></label><label className="wide">Note<input value={credit.note} onChange={(event) => setCredit((value) => ({ ...value, note: event.target.value }))} /></label></div><button className="primary" disabled={saving}>{saving ? "Saving…" : "Create credit note"}</button></form>}
      <section className="dashboard-grid">
        <RecordsPanel title="Bank accounts" empty="No bank accounts have been added." action={canManage ? <button className="secondary" onClick={() => setForm(form === "bank" ? "" : "bank")}>+ Add bank account</button> : undefined}>{data.accounts.map((account) => <FinanceRow key={account.id} title={account.accountName} subtitle={`${account.bankName}${account.accountNumber ? ` · ${account.accountNumber}` : ""}`} amount={account.currentBalance} currency={account.currency || currency} badge={account.isPrimary ? "primary" : "account"} action={canManage ? <button className="text-button" disabled={saving} onClick={() => void archive("bank", account.id)}>Archive</button> : undefined} />)}</RecordsPanel>
        <RecordsPanel title="Petty cash" empty="No petty cash entries fall in this period." action={canManage ? <button className="secondary" onClick={() => setForm(form === "petty" ? "" : "petty")}>+ Add entry</button> : undefined}>{data.petty.map((entry) => <FinanceRow key={entry.id} title={entry.label} subtitle={`${entry.entryDate.slice(0, 10)} · ${entry.direction}${entry.category ? ` · ${entry.category}` : ""}`} amount={entry.direction === "in" ? entry.amount : -entry.amount} currency={currency} badge={entry.direction} action={canManage ? <button className="text-button" disabled={saving} onClick={() => void archive("petty", entry.id)}>Archive</button> : undefined} />)}</RecordsPanel>
      </section>
      {form === "bank" && canManage && <form className="panel finance-form" onSubmit={submitBank}><div className="panel-heading"><h2>Add bank account</h2><button type="button" className="text-button" onClick={() => setForm("")}>Close</button></div><div className="finance-form-grid"><label>Bank name<input required minLength={2} value={bank.bankName} onChange={(event) => setBank((value) => ({ ...value, bankName: event.target.value }))} /></label><label>Account name<input required minLength={2} value={bank.accountName} onChange={(event) => setBank((value) => ({ ...value, accountName: event.target.value }))} /></label><label>Account number<input value={bank.accountNumber} onChange={(event) => setBank((value) => ({ ...value, accountNumber: event.target.value }))} /></label><label>Currency<input required minLength={3} maxLength={3} value={bank.currency} onChange={(event) => setBank((value) => ({ ...value, currency: event.target.value }))} /></label><label>Opening balance<input required type="number" step="0.01" value={bank.openingBalance} onChange={(event) => setBank((value) => ({ ...value, openingBalance: event.target.value }))} /></label><label className="checkbox-field"><input type="checkbox" checked={bank.isPrimary} onChange={(event) => setBank((value) => ({ ...value, isPrimary: event.target.checked }))} />Primary account</label><label className="wide">Notes<input value={bank.notes} onChange={(event) => setBank((value) => ({ ...value, notes: event.target.value }))} /></label></div><button className="primary" disabled={saving}>{saving ? "Saving…" : "Add bank account"}</button></form>}
      {form === "petty" && canManage && <form className="panel finance-form" onSubmit={submitPetty}><div className="panel-heading"><h2>Add petty cash entry</h2><button type="button" className="text-button" onClick={() => setForm("")}>Close</button></div><div className="finance-form-grid"><label>Label<input required minLength={2} value={petty.label} onChange={(event) => setPetty((value) => ({ ...value, label: event.target.value }))} /></label><label>Amount<input required type="number" min="0.01" step="0.01" value={petty.amount} onChange={(event) => setPetty((value) => ({ ...value, amount: event.target.value }))} /></label><label>Direction<select value={petty.direction} onChange={(event) => setPetty((value) => ({ ...value, direction: event.target.value as typeof value.direction }))}><option value="out">Cash out</option><option value="in">Cash in</option></select></label><label>Entry date<input required type="date" value={petty.entryDate} onChange={(event) => setPetty((value) => ({ ...value, entryDate: event.target.value }))} /></label><label>Category<input value={petty.category} onChange={(event) => setPetty((value) => ({ ...value, category: event.target.value }))} /></label><label>Note<input value={petty.note} onChange={(event) => setPetty((value) => ({ ...value, note: event.target.value }))} /></label></div><button className="primary" disabled={saving}>{saving ? "Saving…" : "Add petty cash entry"}</button></form>}
      <RecordsPanel title="Expenses" empty="No expenses were recorded in this period.">{scopedExpenses.map((expense) => <FinanceRow key={expense.id} title={expense.note} subtitle={expense.expenseDate.slice(0, 10)} amount={-expense.amount} currency={currency} badge="expense" />)}</RecordsPanel>
      <div className="panel"><div className="panel-heading"><div><h2>Invoices</h2><p className="muted">{overview?.invoiceCount ?? 0} open invoices · {formatMoney(overview?.invoiceTotal, currency)} outstanding</p></div></div><p className="muted">Create, manage, send, and record invoice payments in the invoice workspace below.</p></div>
    </>}
  </>;
}

function RecordsPanel({ title, empty, action, children }: { title: string; empty: string; action?: ReactNode; children: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action}</div><div className="finance-breakdown">{hasRows ? children : <p className="muted">{empty}</p>}</div></section>;
}

function FinanceRow({ title, subtitle, amount, currency, badge, action }: { title: string; subtitle: string; amount: number; currency: string; badge: string; action?: ReactNode }) {
  return <div className="finance-row"><div className="finance-record-copy"><strong>{title}</strong><small>{subtitle}</small></div><span>{formatMoney(amount, currency)}</span><small className="badge primary">{badge}</small>{action}</div>;
}

function Metric({ label, value, delta, tone }: { label: string; value: string; delta: string; tone: string }) {
  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{delta}</small></div>;
}

function formatMoney(value: number | null | undefined, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "KES", maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  catch { return `${currency} ${Number(value ?? 0).toLocaleString()}`; }
}
function paymentCurrency(_payment: FinancePayment, currency: string) { return currency; }
function localDateKey(date: Date) { const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return adjusted.toISOString().slice(0, 10); }
function presetRange(preset: Exclude<Preset, "custom">): Range {
  const end = new Date(); end.setHours(0, 0, 0, 0); const start = new Date(end);
  if (preset === "week") start.setDate(start.getDate() - 6);
  if (preset === "month") start.setDate(1);
  if (preset === "year") start.setMonth(0, 1);
  return { from: localDateKey(start), to: localDateKey(end) };
}
function createExternalId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `finance-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function downloadHtml(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
function buildFinanceHtml(data: FinanceData | null, currency: string, range: Range) {
  const escape = (input: unknown) => String(input ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
  const row = (label: string, detail: string, amount: number) => `<tr><td>${escape(label)}</td><td>${escape(detail)}</td><td>${escape(formatMoney(amount, currency))}</td></tr>`;
  const overview = data?.overview;
  const rows = [row("Income", range.from + " to " + range.to, overview?.incomeTotal ?? 0), row("Expenses", "Selected period", overview?.expensesTotal ?? 0), row("Profit and loss", "Selected period", overview?.profitLossTotal ?? 0), row("Cash flow", "Selected period", overview?.cashFlowTotal ?? 0), row("Tax", "Selected period", overview?.taxTotal ?? 0), row("Payments", "Recorded payment total", overview?.paymentTotal ?? 0), ...(data?.payments ?? []).map((item) => row(item.method, item.note ?? item.reference ?? item.status, item.amount)), ...(data?.credits ?? []).map((item) => row(`Credit note ${item.reference}`, `${item.status} · ${item.reason}`, item.amount)), ...(data?.accounts ?? []).map((item) => row(`Bank account ${item.accountName}`, item.bankName, item.currentBalance)), ...(data?.petty ?? []).map((item) => row(item.label, `${item.entryDate.slice(0, 10)} · ${item.direction}`, item.direction === "in" ? item.amount : -item.amount)), ...(data?.expenses ?? []).map((item) => row(item.note, item.expenseDate.slice(0, 10), -item.amount))].join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Dira OS Finance Report</title><style>body{font:14px Arial,sans-serif;padding:28px;color:#172033}h1{margin:0 0 6px}p{color:#667085;margin:0 0 24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d5dd;padding:9px;text-align:left}th{background:#f2f4f7}</style></head><body><h1>Dira OS Finance Report</h1><p>${escape(range.from)} to ${escape(range.to)}</p><table><thead><tr><th>Record</th><th>Details</th><th>Amount</th></tr></thead><tbody>${rows || "<tr><td colspan=\"3\">No records in this period</td></tr>"}</tbody></table></body></html>`;
}
