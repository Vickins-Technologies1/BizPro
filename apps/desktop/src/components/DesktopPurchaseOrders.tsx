"use client";

import { useEffect, useMemo, useState } from "react";
import { ACCESS_PERMISSIONS, hasPermission, type Product, type PurchaseOrder, type Supplier } from "@vbo/shared";
import { api, isOfflineError, queueOffline, type Session } from "../lib/desktop-api";
import styles from "./DesktopPurchaseOrders.module.css";

type OrderLine = { productId: string; productName: string; quantity: number; unitCost: number; batchNumber: string; expiryDate: string };
type ReceiptLine = { productId: string; productName: string; remaining: number; quantity: string };
type OrderStatus = PurchaseOrder["status"];
const statuses: OrderStatus[] = ["draft", "ordered", "partially_received", "received", "cancelled"];
const editableStatuses: OrderStatus[] = ["draft", "ordered", "cancelled"];

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number.isFinite(amount) ? amount : 0); }
  catch { return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`; }
}

export function DesktopPurchaseOrders({ session }: { session: Session }) {
  const branchId = session.user.branchId ?? session.branches?.find((branch) => branch.isDefault)?.id ?? session.branches?.[0]?.id ?? null;
  const currency = session.business.currency || "KES";
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receiptLines, setReceiptLines] = useState<ReceiptLine[]>([]);
  const [receiptId, setReceiptId] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [orderNumber, setOrderNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<OrderStatus>("draft");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxTotal, setTaxTotal] = useState("0");
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    Promise.all([api.purchaseOrders(branchId), api.suppliers(), api.products(branchId)]).then(([nextOrders, nextSuppliers, nextProducts]) => {
      if (!live) return;
      setOrders(nextOrders); setSuppliers(nextSuppliers as unknown as Supplier[]); setProducts(nextProducts.filter((product) => product.isActive !== false));
    }).catch((loadError) => { if (live) setError(loadError instanceof Error ? loadError.message : "Could not load purchase orders."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [branchId, reload]);

  const filtered = useMemo(() => orders.filter((order) => {
    const supplierName = suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? "";
    return (statusFilter === "all" || order.status === statusFilter) && `${order.orderNumber} ${order.status} ${order.notes ?? ""} ${supplierName}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [orders, suppliers, statusFilter, query]);
  const matchingProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    return products.filter((product) => `${product.name} ${product.sku ?? ""} ${product.barcode ?? ""}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [products, productSearch]);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);
  const tax = Math.max(0, Number(taxTotal) || 0);
  const total = subtotal + tax;
  const permissions = session.user.permissions?.filter((permission): permission is typeof ACCESS_PERMISSIONS[number] => ACCESS_PERMISSIONS.includes(permission as typeof ACCESS_PERMISSIONS[number])) ?? null;
  const canManage = (session.user.role === "owner" || session.user.role === "manager") && hasPermission({ role: session.user.role, permissions }, "manageInventory");

  function openEditor(order?: PurchaseOrder) {
    setEditing(order ?? null);
    setOrderNumber(order?.orderNumber ?? `PO-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`);
    setSupplierId(order?.supplierId ?? ""); setStatus(order?.status ?? "draft");
    setOrderDate(order?.orderDate ? order.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setExpectedDate(order?.expectedDate?.slice(0, 10) ?? ""); setNotes(order?.notes ?? ""); setTaxTotal(String(order?.taxTotal ?? 0)); setProductSearch("");
    setLines((order?.items ?? []).map((item) => ({ productId: item.productId, productName: item.productName, quantity: Number(item.quantity), unitCost: Number(item.unitCost), batchNumber: item.batchNumber ?? "", expiryDate: item.expiryDate?.slice(0, 10) ?? "" })));
    setError(""); setMessage(""); setShowEditor(true);
  }

  function addProduct(product: Product) {
    setLines((current) => current.some((line) => line.productId === product.id) ? current : [...current, { productId: product.serverId ?? product.id, productName: product.name, quantity: 1, unitCost: Number(product.buyingPrice || 0), batchNumber: "", expiryDate: "" }]);
  }

  function updateLine(index: number, patch: Partial<OrderLine>) { setLines((current) => current.map((line, currentIndex) => currentIndex === index ? { ...line, ...patch } : line)); }

  async function saveOrder(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!canManage) { setError("Your role cannot manage purchase orders."); return; }
    if (orderNumber.trim().length < 2) { setError("Enter a purchase order number."); return; }
    if (!orderDate || Number.isNaN(Date.parse(orderDate))) { setError("Enter a valid order date."); return; }
    if (!lines.length) { setError("Add at least one product."); return; }
    if (lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) { setError("Each item needs a positive quantity and a valid non-negative unit cost."); return; }
    if (!Number.isFinite(Number(taxTotal)) || Number(taxTotal) < 0) { setError("Tax must be a non-negative amount."); return; }
    const body = {
      businessId: session.user.businessId, branchId, supplierId: supplierId || null,
      ...(editing ? {} : { externalId: crypto.randomUUID() }), orderNumber: orderNumber.trim(), status,
      orderDate, expectedDate: expectedDate || null,
      subtotal, taxTotal: tax, total, notes: notes.trim() || null,
      items: lines.map((line) => ({ productId: line.productId, productName: line.productName, quantity: Number(line.quantity), unitCost: Number(line.unitCost), batchNumber: line.batchNumber.trim() || null, expiryDate: line.expiryDate || null }))
    };
    setSaving(true);
    try {
      const saved = editing ? await api.updatePurchaseOrder(editing.id, body) : await api.createPurchaseOrder(body);
      setOrders((current) => editing ? current.map((order) => order.id === editing.id ? saved : order) : [saved, ...current.filter((order) => order.id !== saved.id)]);
      setMessage(editing ? "Purchase order updated." : "Purchase order created."); setShowEditor(false);
    } catch (saveError) {
      if (!editing && isOfflineError(saveError)) {
        try {
          queueOffline("/purchase-orders", body);
          const pending: PurchaseOrder = { ...body, id: String(body.externalId), businessId: session.user.businessId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pendingSync: true } as unknown as PurchaseOrder;
          setOrders((current) => [pending, ...current]); setMessage("Purchase order saved on this device and will sync when online."); setShowEditor(false);
        } catch (queueError) { setError(queueError instanceof Error ? queueError.message : "Could not queue the purchase order."); }
      } else { setError(saveError instanceof Error ? saveError.message : "Could not save purchase order."); }
    } finally { setSaving(false); }
  }

  function openReceipt(order: PurchaseOrder) {
    const byProduct = new Map<string, ReceiptLine>();
    for (const item of order.items) {
      const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity ?? 0));
      if (remaining <= 0) continue;
      const current = byProduct.get(item.productId);
      if (current) {
        current.remaining += remaining;
        current.quantity = String(current.remaining);
      } else {
        byProduct.set(item.productId, { productId: item.productId, productName: item.productName, remaining, quantity: String(remaining) });
      }
    }
    setReceivingOrder(order);
    setReceiptLines([...byProduct.values()]);
    setReceiptId(crypto.randomUUID());
    setError(""); setMessage("");
  }

  async function saveReceipt(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!receivingOrder || !canManage || !receiptId) { setError("Select a purchase order and branch before receiving stock."); return; }
    const items = receiptLines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity || 0), remaining: line.remaining })).filter((line) => line.quantity > 0);
    if (!items.length) { setError("Enter a quantity for at least one product."); return; }
    if (items.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > line.remaining)) {
      setError("Each quantity must be positive and no greater than the outstanding amount."); return;
    }
    setReceiving(true);
    try {
      const saved = await api.receivePurchaseOrder(receivingOrder.id, {
        receiptId,
        items: items.map(({ productId, quantity }) => ({ productId, quantity }))
      }, branchId);
      setOrders((current) => current.map((order) => order.id === saved.id ? saved : order));
      setMessage(`${receivingOrder.orderNumber} receipt recorded.`);
      setReceivingOrder(null); setReceiptLines([]); setReceiptId("");
    } catch (receiptError) {
      setError(receiptError instanceof Error ? receiptError.message : "Could not record received stock.");
    } finally { setReceiving(false); }
  }

  async function archiveOrder(order: PurchaseOrder) {
    if (!canManage) return;
    if (!window.confirm(`Archive purchase order ${order.orderNumber}?`)) return;
    setError(""); setMessage("");
    try { await api.archivePurchaseOrder(order.id, branchId); setOrders((current) => current.filter((item) => item.id !== order.id)); setMessage(`${order.orderNumber} archived.`); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive purchase order."); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">INVENTORY</span><h1>Purchase orders</h1><p>Plan supplier orders and track expected inventory.</p></div><div className="heading-actions"><button className="secondary" onClick={() => setReload((value) => value + 1)}>Refresh</button>{canManage && <button className="primary" onClick={() => openEditor()}>Create order</button>}</div></div>
    {error && !showEditor && <div className="error-banner" role="alert">{error}</div>}{message && !showEditor && <div className={styles.message}>{message}</div>}
    <div className={`toolbar ${styles.filters}`}><div className="search-field">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, supplier, or status" /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by order status"><option value="all">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select><span className="toolbar-count">{filtered.length} orders</span></div>
    <div className="table-panel panel"><table><thead><tr><th>Order</th><th>Supplier</th><th>Order date</th><th>Expected</th><th>Lines</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice(0, 100).map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td>{suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? "No supplier"}</td><td>{new Date(order.orderDate).toLocaleDateString()}</td><td>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : "—"}</td><td>{order.items.length}</td><td>{money(order.total, currency)}</td><td><span className={`badge ${order.status === "received" ? "success" : order.status === "cancelled" ? "warning" : "info"}`}>{order.status.replace(/_/g, " ")}{(order as PurchaseOrder & { pendingSync?: boolean }).pendingSync ? " · pending sync" : ""}</span></td><td className="record-actions">{canManage && <>{(order.status === "ordered" || order.status === "partially_received") && <button className="text-button" onClick={() => openReceipt(order)}>Receive</button>}{order.status !== "partially_received" && order.status !== "received" && order.status !== "cancelled" && !(order.receipts?.length) && <button className="text-button" onClick={() => openEditor(order)}>Edit</button>}{order.status !== "partially_received" && order.status !== "received" && <button className="text-button" onClick={() => void archiveOrder(order)}>Archive</button>}</>}</td></tr>)}</tbody></table>{!loading && !filtered.length && <div className="empty">{error ? "Could not load purchase orders." : "No purchase orders match your search."}</div>}{loading && <div className="empty">Loading purchase orders…</div>}</div>
    {showEditor && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowEditor(false); }}><form className={`modal-card ${styles.editor}`} onSubmit={(event) => void saveOrder(event)}><div className="panel-heading"><div><span className="eyebrow">INBOUND STOCK</span><h2>{editing ? "Edit purchase order" : "Create purchase order"}</h2></div><button type="button" className="text-button" onClick={() => setShowEditor(false)} disabled={saving}>Close</button></div>
      <div className={styles.formGrid}><label>Order number<input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required /></label><label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{statuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label><label>Order date<input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required /></label><label>Expected date<input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></label><label>Tax total<input type="number" min="0" step="0.01" value={taxTotal} onChange={(event) => setTaxTotal(event.target.value)} /></label></div>
      <label className={styles.notes}>Notes<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <label className={styles.productSearch}>Add catalog product<input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search name, SKU, or barcode" /></label>
      <div className={styles.productResults}>{matchingProducts.map((product) => <button type="button" className="secondary" key={product.id} disabled={lines.some((line) => line.productId === (product.serverId ?? product.id))} onClick={() => addProduct(product)}>{product.name} · {product.sku || "No SKU"}</button>)}</div>
      <div className={styles.orderLines}>{lines.map((line, index) => <div className={styles.orderLine} key={`${line.productId}-${index}`}><div className={styles.lineName}><strong>{line.productName}</strong><button type="button" className="text-button" onClick={() => setLines((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Remove</button></div><label>Qty<input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></label><label>Unit cost<input type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: Number(event.target.value) })} /></label><label>Batch<input value={line.batchNumber} onChange={(event) => updateLine(index, { batchNumber: event.target.value })} /></label><label>Expiry<input type="date" value={line.expiryDate} onChange={(event) => updateLine(index, { expiryDate: event.target.value })} /></label><strong>{money(line.quantity * line.unitCost, currency)}</strong></div>)}</div>
      <div className="basket-total"><span>Subtotal</span><b>{money(subtotal, currency)}</b><span>Tax</span><b>{money(tax, currency)}</b><strong>Total</strong><strong>{money(total, currency)}</strong></div>{error && <div className="error-banner" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : "Save purchase order"}</button></div>
    </form></div>}
    {receivingOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !receiving) setReceivingOrder(null); }}><form className={`modal-card ${styles.receiptModal}`} onSubmit={(event) => void saveReceipt(event)}>
      <div className="panel-heading"><div><span className="eyebrow">INBOUND STOCK</span><h2>Receive {receivingOrder.orderNumber}</h2></div><button type="button" className="text-button" onClick={() => setReceivingOrder(null)} disabled={receiving}>Close</button></div>
      <p>Record the quantities delivered. Stock and receipt history update together for {session.branches?.find((branch) => branch.id === branchId)?.name ?? "the selected branch"}.</p>
      <div className={styles.receiptLines}>{receiptLines.map((line) => <label key={line.productId}><span><strong>{line.productName}</strong><small>{line.remaining} outstanding</small></span><input aria-label={`Received quantity for ${line.productName}`} type="number" min="0" max={line.remaining} step="0.01" value={line.quantity} onChange={(event) => setReceiptLines((current) => current.map((item) => item.productId === line.productId ? { ...item, quantity: event.target.value } : item))} /></label>)}</div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => setReceivingOrder(null)} disabled={receiving}>Cancel</button><button className="primary" disabled={receiving}>{receiving ? "Recording…" : "Record receipt"}</button></div>
    </form></div>}
  </>;
}
