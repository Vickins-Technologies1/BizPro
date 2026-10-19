"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateSale, calculateTax, PAYMENT_METHODS, resolveBusinessTypeConfig, type Customer, type PaymentMethod, type Product, type Sale } from "@vbo/shared";
import { api, isOfflineError, queueOffline, type Session } from "../lib/desktop-api";
import styles from "./DesktopPos.module.css";

type CartLine = { product: Product; quantity: number; discount: number };
type Tender = { id: string; method: PaymentMethod; amount: number; reference: string };
type PosDraft = { lines: CartLine[]; customerId: string; orderDiscount: number; tenders: Tender[]; notes: string; externalId: string };
const tenderMethods = PAYMENT_METHODS.filter((method) => method !== "credit");
const draftPrefix = "bizpro.desktop.pos-draft.";

function money(value: unknown, currency: string) {
  const amount = Number(value ?? 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number.isFinite(amount) ? amount : 0); }
  catch { return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`; }
}

function makeTender(method: PaymentMethod = "cash", amount = 0): Tender {
  return { id: crypto.randomUUID(), method, amount, reference: "" };
}

export function DesktopPos({ session }: { session: Session }) {
  const branchId = session.user.branchId ?? session.branches?.find((branch) => branch.isDefault)?.id ?? session.branches?.[0]?.id ?? null;
  const draftKey = `${draftPrefix}${session.user.businessId}:${session.user.id}:${branchId ?? "all"}`;
  const currency = session.business.currency || "KES";
  const taxRate = Math.max(0, Number(session.business.taxSettings?.defaultTaxRate ?? 0));
  const tracksInventory = resolveBusinessTypeConfig({ businessType: session.business.businessType, industryKey: session.business.industryKey }).capabilities.inventory;
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [notes, setNotes] = useState("");
  const [externalId, setExternalId] = useState("");
  const [query, setQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<"all" | "low">("all");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Sale | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([api.products(branchId), api.customers(branchId)]).then(([nextProducts, nextCustomers]) => {
      if (!live) return;
      setProducts(nextProducts.filter((product) => product.isActive !== false));
      setCustomers(nextCustomers);
    }).catch((loadError) => { if (live) setError(loadError instanceof Error ? loadError.message : "Could not load the catalog."); });
    return () => { live = false; };
  }, [branchId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<PosDraft>;
        setLines(Array.isArray(draft.lines) ? draft.lines.filter((line) => line?.product?.id && Number(line.quantity) > 0) : []);
        setCustomerId(typeof draft.customerId === "string" ? draft.customerId : "");
        setOrderDiscount(Math.max(0, Number(draft.orderDiscount ?? 0)));
        setTenders(Array.isArray(draft.tenders) && draft.tenders.length ? draft.tenders : [makeTender()]);
        setNotes(typeof draft.notes === "string" ? draft.notes : "");
        setExternalId(typeof draft.externalId === "string" && draft.externalId ? draft.externalId : crypto.randomUUID());
      } else {
        setTenders([makeTender()]);
        setExternalId(crypto.randomUUID());
      }
    } catch {
      setTenders([makeTender()]);
      setExternalId(crypto.randomUUID());
    } finally { setReady(true); }
  }, [draftKey]);

  useEffect(() => {
    if (!ready) return;
    const draft: PosDraft = { lines, customerId, orderDiscount, tenders, notes, externalId: externalId || crypto.randomUUID() };
    if (!externalId) setExternalId(draft.externalId);
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [ready, draftKey, lines, customerId, orderDiscount, tenders, notes, externalId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>("[data-pos-submit]")?.click();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".pos-search input")?.focus();
      }
      if (event.key === "Escape") setQuery("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + Number(line.product.sellingPrice || 0) * line.quantity, 0), [lines]);
  const lineDiscount = useMemo(() => lines.reduce((sum, line) => sum + Math.max(0, Number(line.discount) || 0), 0), [lines]);
  const discountsBeforeOrder = Math.min(subtotal, lineDiscount);
  const remainingDiscountBase = Math.max(0, subtotal - discountsBeforeOrder);
  const appliedOrderDiscount = Math.min(remainingDiscountBase, Math.max(0, Number(orderDiscount) || 0));
  const totalDiscount = discountsBeforeOrder + appliedOrderDiscount;
  const effectiveDiscounts = useMemo(() => {
    if (!lines.length || appliedOrderDiscount <= 0 || remainingDiscountBase <= 0) return lines.map((line) => Math.max(0, Number(line.discount) || 0));
    let allocated = 0;
    return lines.map((line, index) => {
      const rawDiscount = Math.max(0, Number(line.discount) || 0);
      const base = Math.max(0, Number(line.product.sellingPrice || 0) * line.quantity - rawDiscount);
      const additional = index === lines.length - 1 ? appliedOrderDiscount - allocated : Math.round((appliedOrderDiscount * base / remainingDiscountBase) * 100) / 100;
      allocated += additional;
      return rawDiscount + additional;
    });
  }, [lines, appliedOrderDiscount, remainingDiscountBase]);
  const financialLines = useMemo(() => lines.map((line, index) => {
    const price = Number(line.product.sellingPrice || 0);
    const taxable = Math.max(0, price * line.quantity - effectiveDiscounts[index]!);
    return { quantity: line.quantity, unitPrice: price, unitCost: Number(line.product.buyingPrice || 0), discount: effectiveDiscounts[index] ?? 0, tax: calculateTax(taxable, taxRate) };
  }), [lines, effectiveDiscounts, taxRate]);
  let estimated = { subtotal, discountTotal: totalDiscount, taxTotal: 0, grandTotal: Math.max(0, subtotal - totalDiscount), balanceDue: 0 };
  try { const result = calculateSale(financialLines, 0); estimated = { subtotal: result.subtotal, discountTotal: result.discountTotal, taxTotal: result.taxTotal, grandTotal: result.grandTotal, balanceDue: result.balanceDue }; } catch { /* Keep a safe zero-tax preview until line values are valid. */ }
  const paid = Math.round(tenders.reduce((sum, tender) => sum + Math.max(0, Number(tender.amount) || 0), 0) * 100) / 100;
  const balanceDue = Math.round(Math.max(0, estimated.grandTotal - paid) * 100) / 100;
  const overpayment = Math.max(0, paid - estimated.grandTotal);
  const customer = customers.find((candidate) => candidate.id === customerId);
  const filtered = products.filter((product) => {
    const matches = `${product.name} ${product.sku ?? ""} ${product.barcode ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matches && (catalogFilter === "all" || Number(product.stockOnHand ?? 0) <= Number(product.lowStockThreshold ?? 5));
  }).slice(0, 16);

  const addProduct = useCallback((product: Product) => {
    setError("");
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1, discount: 0 }];
      return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
    });
  }, []);
  function updateLine(id: string, patch: Partial<Pick<CartLine, "quantity" | "discount">>) {
    setLines((current) => current.map((line) => line.product.id === id ? { ...line, ...patch } : line));
  }
  function clearDraft() {
    setLines([]); setCustomerId(""); setOrderDiscount(0); setTenders([makeTender()]); setNotes(""); setError(""); setMessage("Draft cleared.");
  }
  function fillTender(tenderId: string) {
    const otherPaid = tenders.filter((tender) => tender.id !== tenderId).reduce((sum, tender) => sum + Math.max(0, Number(tender.amount) || 0), 0);
    setTenders((current) => current.map((tender) => tender.id === tenderId ? { ...tender, amount: Math.max(0, estimated.grandTotal - otherPaid) } : tender));
  }
  function amountFor(method: PaymentMethod) { return tenders.filter((tender) => tender.method === method).reduce((sum, tender) => sum + Number(tender.amount || 0), 0); }

  async function completeSale() {
    setError(""); setMessage("");
    if (!lines.length) { setError("Add at least one item before checkout."); return; }
    if (tracksInventory && lines.some((line) => line.quantity > Number(line.product.stockOnHand ?? 0))) { setError("One or more quantities exceed the available stock."); return; }
    if (overpayment > 0.009) { setError("Payment total cannot be greater than the sale total."); return; }
    if (balanceDue > 0 && !customerId) { setError("Choose a customer to record the remaining balance as credit."); return; }
    if (paid > 0 && !tenders.some((tender) => tender.amount > 0)) { setError("Add a payment amount or leave the full amount on customer credit."); return; }
    if (paid > 0 && tenders.filter((tender) => tender.amount > 0).some((tender) => !(tenderMethods as readonly PaymentMethod[]).includes(tender.method))) { setError("Choose a valid payment method for each amount."); return; }
    const identifier = externalId || crypto.randomUUID();
    const receiptNumber = `D-${identifier.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    const validTenders = tenders.filter((tender) => Number(tender.amount) > 0).map((tender) => ({ method: tender.method, amount: Number(tender.amount), reference: tender.reference.trim() || undefined }));
    const primaryMethod = validTenders[0]?.method ?? "credit";
    const body = {
      branchId,
      customerId: customerId || undefined,
      externalId: identifier,
      receiptNumber,
      amountPaid: paid,
      paymentStatus: balanceDue <= 0 ? "paid" : paid > 0 ? "partial" : "credit",
      paymentMethod: primaryMethod,
      paymentLines: validTenders,
      notes: notes.trim() || undefined,
      items: lines.map((line, index) => ({ productId: line.product.serverId ?? line.product.id, quantity: Number(line.quantity), discount: effectiveDiscounts[index] ?? 0 }))
    };
    setBusy(true);
    try {
      const result = await api.createSale(body);
      setReceipt(result);
      window.localStorage.removeItem(draftKey);
      setLines([]); setCustomerId(""); setOrderDiscount(0); setTenders([makeTender()]); setNotes(""); setExternalId(crypto.randomUUID());
      setMessage("Sale recorded.");
    } catch (submitError) {
      if (isOfflineError(submitError)) {
        try {
          queueOffline("/sales", body);
          window.localStorage.removeItem(draftKey);
          setLines([]); setCustomerId(""); setOrderDiscount(0); setTenders([makeTender()]); setNotes(""); setExternalId(crypto.randomUUID());
          setMessage(`Sale ${receiptNumber} saved to this device and will sync when the connection returns.`);
        } catch (queueError) { setError(queueError instanceof Error ? queueError.message : "Could not save the sale for offline sync."); }
      } else { setError(submitError instanceof Error ? submitError.message : "Unable to record this sale."); }
    } finally { setBusy(false); }
  }

  return <div className={styles.root}>
    <div className="page-heading"><div><span className="eyebrow">POINT OF SALE</span><h1>Record a sale</h1><p>Search or scan products, adjust quantities, then take payment or assign a customer balance.</p></div><div className="heading-actions"><span className="shortcut-hint"><kbd>Ctrl + Enter</kbd> Complete sale</span><button className="secondary" onClick={clearDraft} disabled={!lines.length}>Clear draft</button></div></div>
    {error && <div className="error-banner">{error}</div>}{message && <div className={styles.message}>{message}</div>}
    <div className="pos-layout">
      <section className="pos-catalog panel">
        <div className="pos-search"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter") return; const exact = products.find((product) => product.barcode?.trim().toLowerCase() === query.trim().toLowerCase() || product.sku?.trim().toLowerCase() === query.trim().toLowerCase()); const match = exact ?? filtered[0]; if (match) { addProduct(match); setQuery(""); } }} placeholder="Scan barcode or search products..." aria-label="Search products" /><kbd>Ctrl K</kbd></div>
        <div className="category-row"><button className={catalogFilter === "all" ? "selected" : ""} onClick={() => setCatalogFilter("all")}>All products</button><button className={catalogFilter === "low" ? "selected" : ""} onClick={() => setCatalogFilter("low")}>Low stock</button></div>
        <div className="catalog-grid">{filtered.map((product) => <button className="catalog-card" onClick={() => addProduct(product)} key={product.id} disabled={tracksInventory && Number(product.stockOnHand ?? 0) <= 0}><span className="catalog-image">{product.name.slice(0, 1)}</span><strong>{product.name}</strong><small>{tracksInventory ? `${product.stockOnHand} ${product.unit} available` : product.unit}</small><b>{money(product.sellingPrice, currency)}</b></button>)}{!filtered.length && <div className="empty">No matching products. Search by name, SKU, or barcode.</div>}</div>
      </section>
      <section className="basket panel">
        <div className="panel-heading"><div><h2>Current basket</h2><small>{lines.reduce((count, line) => count + line.quantity, 0)} items · {lines.length} products</small></div><button className="text-button" onClick={() => setLines([])} disabled={!lines.length}>Remove all</button></div>
        <div className={styles.cartLines}>{lines.length ? lines.map((line) => <div className={styles.cartLine} key={line.product.id}><div className={styles.cartProduct}><strong>{line.product.name}</strong><small>{money(line.product.sellingPrice, currency)} / {line.product.unit}</small></div><label>Qty<input type="number" min="0.01" step={tracksInventory ? 1 : 0.25} max={tracksInventory ? line.product.stockOnHand : undefined} value={line.quantity} onChange={(event) => { const value = Number(event.target.value); if (value > 0) updateLine(line.product.id, { quantity: value }); }} /></label><label>Discount<input type="number" min="0" step="0.01" max={Number(line.product.sellingPrice) * line.quantity} value={line.discount} onChange={(event) => updateLine(line.product.id, { discount: Math.max(0, Number(event.target.value) || 0) })} /></label><strong>{money(Number(line.product.sellingPrice) * line.quantity - line.discount, currency)}</strong><button className={styles.remove} onClick={() => setLines((current) => current.filter((item) => item.product.id !== line.product.id))} aria-label={`Remove ${line.product.name}`}>×</button></div>) : <div className="empty">Your basket is ready. Add products from the catalog.</div>}</div>
        <label className={styles.customer}>Customer<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Walk-in customer</option>{customers.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}{candidate.phone ? ` · ${candidate.phone}` : ""}</option>)}</select></label>
        <label className={styles.discount}>Order discount<input type="number" min="0" step="0.01" max={remainingDiscountBase} value={orderDiscount} onChange={(event) => setOrderDiscount(Math.max(0, Number(event.target.value) || 0))} /></label>
        <div className={styles.tenders}><div className="panel-heading"><div><h2>Payments</h2><small>Split payments or leave an amount on the selected customer.</small></div><button className="text-button" onClick={() => setTenders((current) => [...current, makeTender()])}>Add payment</button></div>
          {tenders.map((tender, index) => <div className={styles.tender} key={tender.id}><select aria-label={`Payment ${index + 1} method`} value={tender.method} onChange={(event) => setTenders((current) => current.map((item) => item.id === tender.id ? { ...item, method: event.target.value as PaymentMethod } : item))}>{tenderMethods.map((method) => <option key={method} value={method}>{method === "mpesa" ? "M-Pesa" : method.charAt(0).toUpperCase() + method.slice(1)}</option>)}</select><input aria-label={`Payment ${index + 1} amount`} type="number" min="0" step="0.01" value={tender.amount} onChange={(event) => setTenders((current) => current.map((item) => item.id === tender.id ? { ...item, amount: Math.max(0, Number(event.target.value) || 0) } : item))} /><input aria-label={`Payment ${index + 1} reference`} value={tender.reference} onChange={(event) => setTenders((current) => current.map((item) => item.id === tender.id ? { ...item, reference: event.target.value } : item))} placeholder="Reference (optional)" /><button className="text-button" onClick={() => fillTender(tender.id)}>Fill</button>{tenders.length > 1 && <button className={styles.remove} onClick={() => setTenders((current) => current.filter((item) => item.id !== tender.id))} aria-label="Remove payment">×</button>}</div>)}
        </div>
        <label className={styles.notes}>Checkout note<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional sale note" /></label>
        <div className="basket-total"><span>Subtotal</span><b>{money(estimated.subtotal, currency)}</b><span>Discount</span><b>−{money(estimated.discountTotal, currency)}</b><span>Tax ({taxRate}%)</span><b>{money(estimated.taxTotal, currency)}</b><strong>Total</strong><strong>{money(estimated.grandTotal, currency)}</strong><span>Paid</span><b>{money(paid, currency)}</b><span>Balance due</span><b>{money(balanceDue, currency)}</b></div>
        {customer && Number(customer.balance) > 0 && <div className={styles.customerBalance}>Existing customer balance: {money(customer.balance, currency)}</div>}
        <button className="primary full" data-pos-submit onClick={() => void completeSale()} disabled={busy || !ready || !lines.length}>{busy ? "Recording sale…" : "Complete sale →"}</button>
      </section>
    </div>
    {receipt && <div className="modal-backdrop" role="presentation" onClick={() => setReceipt(null)}><div className={`modal-card ${styles.receipt} posReceipt`} role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title" onClick={(event) => event.stopPropagation()}><div className="panel-heading"><div><h2 id="pos-receipt-title">Sale recorded</h2><small>Receipt {receipt.receiptNumber}</small></div><button className="text-button" onClick={() => setReceipt(null)}>Close</button></div><p>{receipt.items.map((item) => `${item.quantity} × ${item.productName}`).join(" · ")}</p><div className="basket-total"><strong>Total</strong><strong>{money(receipt.grandTotal, currency)}</strong><span>Paid</span><b>{money(receipt.amountPaid, currency)}</b><span>Balance</span><b>{money(receipt.balanceDue, currency)}</b></div><div className="modal-actions"><button className="secondary" onClick={() => window.print()}>Print receipt</button><button className="primary" onClick={() => setReceipt(null)}>Done</button></div></div></div>}
  </div>;
}
