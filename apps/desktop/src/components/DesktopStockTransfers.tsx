"use client";

import { useEffect, useMemo, useState } from "react";
import { ACCESS_PERMISSIONS, hasPermission, type Branch, type Product, type StockTransfer } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";
import { desktopStockTransfersApi } from "../lib/desktop-stock-transfers-api";
import styles from "./DesktopStockTransfers.module.css";

type TransferLine = { productId: string; productName: string; quantity: number; unitCost: number; batchNumber: string; serialNumbers: string };
const statuses: StockTransfer["status"][] = ["draft", "in_transit", "received", "cancelled"];

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number.isFinite(amount) ? amount : 0); }
  catch { return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`; }
}

export function DesktopStockTransfers({ session }: { session: Session }) {
  const currency = session.business.currency || "KES";
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<StockTransfer | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [note, setNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    Promise.all([api.stockTransfers(session.user.role === "owner" ? null : session.user.branchId), api.branches(), api.products()]).then(([nextTransfers, nextBranches, nextProducts]) => {
      if (!live) return;
      setTransfers(nextTransfers); setBranches(nextBranches); setProducts(nextProducts.filter((product) => product.isActive !== false));
    }).catch((loadError) => { if (live) setError(loadError instanceof Error ? loadError.message : "Could not load stock transfers."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [reload, session.user.branchId, session.user.role]);

  const filtered = useMemo(() => transfers.filter((transfer) => (statusFilter === "all" || transfer.status === statusFilter) && `${transfer.transferNumber} ${transfer.status} ${transfer.note ?? ""} ${transfer.fromBranchId ?? ""} ${transfer.toBranchId ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [transfers, statusFilter, query]);
  const matchingProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    return products.filter((product) => product.branchId === fromBranchId && Boolean(product.externalId) && `${product.name} ${product.sku ?? ""} ${product.barcode ?? ""}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [products, productSearch, fromBranchId]);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const permissions = session.user.permissions?.filter((permission): permission is typeof ACCESS_PERMISSIONS[number] => ACCESS_PERMISSIONS.includes(permission as typeof ACCESS_PERMISSIONS[number])) ?? null;
  const canManage = (session.user.role === "owner" || session.user.role === "manager") && hasPermission({ role: session.user.role, permissions }, "manageInventory");
  const canManageSource = (branchId?: string | null) => session.user.role === "owner" || Boolean(branchId && branchId === session.user.branchId);
  const branchName = (id?: string | null) => branches.find((branch) => branch.id === id)?.name ?? "—";

  function openEditor(transfer?: StockTransfer) {
    setEditing(transfer ?? null); setFromBranchId(transfer?.fromBranchId ?? ""); setToBranchId(transfer?.toBranchId ?? "");
    setTransferNumber(transfer?.transferNumber ?? `TR-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`);
    setTransferDate(transfer?.transferDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setNote(transfer?.note ?? ""); setProductSearch("");
    setLines((transfer?.items ?? []).map((item) => ({ productId: item.productId, productName: products.find((product) => product.id === item.productId)?.name ?? item.productId, quantity: Number(item.quantity), unitCost: Number(item.unitCost), batchNumber: item.batchNumber ?? "", serialNumbers: (item.serialNumbers ?? []).join(", ") })));
    setError(""); setMessage(""); setShowEditor(true);
  }

  function addProduct(product: Product) {
    const productId = product.externalId?.trim() || "";
    if (!productId) { setError("This product has no shared catalog ID and cannot be transferred between branch stock records."); return; }
    setLines((current) => current.some((line) => line.productId === productId) ? current : [...current, { productId, productName: product.name, quantity: 1, unitCost: Number(product.buyingPrice || 0), batchNumber: "", serialNumbers: "" }]);
  }
  function updateLine(index: number, patch: Partial<TransferLine>) { setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...patch } : line)); }

  async function saveTransfer(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!canManage) { setError("Your role cannot manage stock transfers."); return; }
    if (transferNumber.trim().length < 2) { setError("Enter a stock transfer number."); return; }
    if (!fromBranchId || !toBranchId) { setError("Select both a source and destination branch."); return; }
    if (fromBranchId === toBranchId) { setError("The source and destination branches must differ."); return; }
    if (!transferDate || Number.isNaN(Date.parse(transferDate))) { setError("Enter a valid transfer date."); return; }
    if (!lines.length) { setError("Add at least one product."); return; }
    if (lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) { setError("Each item needs a positive quantity and a non-negative unit cost."); return; }
    const body = {
      ...(editing ? {} : { businessId: session.user.businessId, externalId: crypto.randomUUID() }),
      fromBranchId, toBranchId, transferNumber: transferNumber.trim(), status: "draft" as const, transferDate,
      note: note.trim() || null,
      items: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost), batchNumber: line.batchNumber.trim() || null, serialNumbers: line.serialNumbers.split(",").map((value) => value.trim()).filter(Boolean) }))
    };
    setSaving(true);
    try {
      const saved = editing ? await desktopStockTransfersApi.update(editing.id, body) : await desktopStockTransfersApi.create(body);
      setTransfers((current) => editing ? current.map((item) => item.id === editing.id ? saved : item) : [saved, ...current.filter((item) => item.id !== saved.id)]);
      setMessage(editing ? "Transfer record updated." : "Transfer record created."); setShowEditor(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save transfer record."); }
    finally { setSaving(false); }
  }

  async function runTransferAction(transfer: StockTransfer, action: "dispatch" | "receive") {
    setError(""); setMessage("");
    try {
      const updated = action === "dispatch" ? await desktopStockTransfersApi.dispatch(transfer.id) : await desktopStockTransfersApi.receive(transfer.id);
      setTransfers((current) => current.map((item) => item.id === transfer.id ? updated : item));
      setMessage(action === "dispatch" ? `${transfer.transferNumber} dispatched; source stock was deducted.` : `${transfer.transferNumber} received; destination stock was updated.`);
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : `Could not ${action} transfer.`); }
  }

  async function archiveTransfer(transfer: StockTransfer) {
    if (!canManage || !window.confirm(`Archive transfer ${transfer.transferNumber}?`)) return;
    setError(""); setMessage("");
    try { await desktopStockTransfersApi.archive(transfer.id); setTransfers((current) => current.filter((item) => item.id !== transfer.id)); setMessage(`${transfer.transferNumber} archived.`); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive transfer."); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">INVENTORY</span><h1>Stock transfers</h1><p>Maintain a branch-to-branch transfer ledger and track its status.</p></div><div className="heading-actions"><button className="secondary" onClick={() => setReload((value) => value + 1)}>Refresh</button>{canManage && <button className="primary" onClick={() => openEditor()}>Create transfer</button>}</div></div>
    {error && !showEditor && <div className="error-banner" role="alert">{error}</div>}{message && !showEditor && <div className={styles.message}>{message}</div>}
    <div className={`toolbar ${styles.filters}`}><div className="search-field">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transfer, branch, or status" /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by transfer status"><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select><span className="toolbar-count">{filtered.length} transfers</span></div>
    <div className="table-panel panel"><table><thead><tr><th>Transfer</th><th>From</th><th>To</th><th>Date</th><th>Lines</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice(0, 100).map((transfer) => <tr key={transfer.id}><td><strong>{transfer.transferNumber}</strong></td><td>{branchName(transfer.fromBranchId)}</td><td>{branchName(transfer.toBranchId)}</td><td>{new Date(transfer.transferDate).toLocaleDateString()}</td><td>{transfer.items.length}</td><td>{money(transfer.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0), currency)}</td><td><span className={`badge ${transfer.status === "received" ? "success" : transfer.status === "cancelled" ? "warning" : "info"}`}>{transfer.status.replace(/_/g, " ")}</span></td><td className="record-actions">{canManage && <>{transfer.status === "draft" && canManageSource(transfer.fromBranchId) && <><button className="text-button" onClick={() => openEditor(transfer)}>Edit</button><button className="text-button" onClick={() => void runTransferAction(transfer, "dispatch")}>Dispatch</button><button className="text-button" onClick={() => void archiveTransfer(transfer)}>Archive</button></>}{transfer.status === "in_transit" && transfer.dispatchedAt && (session.user.role === "owner" || session.user.branchId === transfer.toBranchId) && <button className="text-button" onClick={() => void runTransferAction(transfer, "receive")}>Receive</button>}</>}</td></tr>)}</tbody></table>{!loading && !filtered.length && <div className="empty">{error ? "Could not load transfers." : "No transfers match your search."}</div>}{loading && <div className="empty">Loading transfers…</div>}</div>
    {showEditor && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowEditor(false); }}><form className={`modal-card ${styles.editor}`} onSubmit={(event) => void saveTransfer(event)}><div className="panel-heading"><div><span className="eyebrow">TRANSFER LEDGER</span><h2>{editing ? "Edit transfer" : "Create transfer"}</h2></div><button type="button" className="text-button" onClick={() => setShowEditor(false)} disabled={saving}>Close</button></div>
      <div className={styles.formGrid}><label>Transfer number<input value={transferNumber} onChange={(event) => setTransferNumber(event.target.value)} required /></label><label>Source branch<select value={fromBranchId} onChange={(event) => { setFromBranchId(event.target.value); setLines([]); }}><option value="">Choose source</option>{branches.filter((branch) => canManageSource(branch.id)).map((branch) => <option value={branch.id} key={branch.id}>{branch.name} · {branch.code}</option>)}</select></label><label>Destination branch<select value={toBranchId} onChange={(event) => setToBranchId(event.target.value)}><option value="">Choose destination</option>{branches.filter((branch) => branch.id !== fromBranchId).map((branch) => <option value={branch.id} key={branch.id}>{branch.name} · {branch.code}</option>)}</select></label><label>Transfer date<input type="date" value={transferDate} onChange={(event) => setTransferDate(event.target.value)} required /></label></div>
      <label className={styles.notes}>Note<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label><label className={styles.productSearch}>Add source branch product<input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search name, SKU, or barcode" /></label><div className={styles.productResults}>{matchingProducts.map((product) => <button type="button" className="secondary" key={product.id} disabled={lines.some((line) => line.productId === product.externalId)} onClick={() => addProduct(product)}>{product.name} · {product.sku || "No SKU"}</button>)}</div>
      <div className={styles.orderLines}>{lines.map((line, index) => <div className={styles.orderLine} key={`${line.productId}-${index}`}><div className={styles.lineName}><strong>{line.productName}</strong><button type="button" className="text-button" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button></div><label>Qty<input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></label><label>Unit cost<input type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: Number(event.target.value) })} /></label><label>Batch<input value={line.batchNumber} onChange={(event) => updateLine(index, { batchNumber: event.target.value })} /></label><label>Serials<input value={line.serialNumbers} onChange={(event) => updateLine(index, { serialNumbers: event.target.value })} placeholder="Comma separated" /></label><strong>{money(line.quantity * line.unitCost, currency)}</strong></div>)}</div><div className="basket-total"><span>Transfer value</span><strong>{money(subtotal, currency)}</strong></div>{error && <div className="error-banner" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save transfer"}</button></div>
    </form></div>}
  </>;
}
