"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ACCESS_PERMISSIONS, hasPermission, resolveCatalogCreationConfig, resolveCatalogCreationContext, type AccessPermission, type CatalogEntityType, type Product } from "@vbo/shared";
import { api, isOfflineError, queueOffline, type Session } from "../lib/desktop-api";

export function IndustryProducts({ session, inventory }: { session: Session; inventory: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reload, setReload] = useState(0);
  const catalogInput = { industryKey: session.business?.industryKey ?? null, businessType: session.business?.businessType ?? null };
  const resolution = resolveCatalogCreationContext(catalogInput);
  const config = resolution.status === "ready" ? resolution.context.config : null;
  const label = config?.itemLabel ?? "catalog item";
  const hasInventory = config?.supportsInventory ?? false;
  const permissions = session.user.permissions?.filter((value): value is AccessPermission => ACCESS_PERMISSIONS.includes(value as AccessPermission)) ?? null;
  const canManage = hasPermission({ role: session.user.role, permissions }, "manageInventory");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.productsPage({ branchId: session.branches?.[0]?.id ?? null, page: 1, pageSize: 50, search: query })
        .then((result) => { setProducts(result.items); setTotal(result.total); })
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [session, query, reload]);

  return <>
    <PageHeading eyebrow={inventory ? "STOCK CONTROL" : "CATALOG"} title={inventory ? "Inventory" : config?.itemLabel ? `${config.itemLabel} catalog` : "Catalog"} subtitle={config?.description ?? (inventory ? "Know what is moving, what is low, and what needs attention." : "Select a valid business industry before creating catalog records.")} actions={<><button className="secondary" onClick={() => setQuery("")}>Reset search</button><button className="primary" onClick={() => setShowCreate(true)} disabled={resolution.status !== "ready"}>+ Add {label}</button></>} />
    <div className="toolbar"><div className="search-field">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} /></div><span className="toolbar-count">{total} {label.toLowerCase()} records</span></div>
    <div className="table-panel panel"><table><thead><tr><th>{label}</th><th>Code</th><th>Category</th><th>Price</th><th>{hasInventory ? "Stock" : "Duration"}</th><th>Status</th><th /></tr></thead><tbody>{products.map((product) => { const stock = Number(product.stockOnHand ?? 0); return <tr key={product.id}><td><div className="table-product"><span className="product-thumb">{String(product.name ?? "?").slice(0, 1)}</span><strong>{product.name}</strong></div></td><td>{product.sku ?? product.barcode ?? "—"}</td><td>{product.categoryId ?? "General"}</td><td><strong>{catalogMoney(product.sellingPrice)}</strong></td><td>{hasInventory ? <><strong>{stock}</strong> <span className="muted">{product.unit ?? "pcs"}</span></> : product.serviceDurationMinutes ? `${product.serviceDurationMinutes} min` : "Flexible"}</td><td><span className={`badge ${product.isActive === false ? "warning" : "success"}`}>{product.isActive === false ? "Archived" : "Active"}</span></td><td><button className="row-menu" aria-label={`View details for ${product.name}`} onClick={() => setSelectedProduct(product)}>Details</button></td></tr>; })}</tbody></table>{!products.length && <Empty text={`No ${label.toLowerCase()} records found.`} />}</div>
    {showCreate ? <IndustryProductCreateModal session={session} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setReload((value) => value + 1); }} /> : null}
    {selectedProduct ? <ProductDetailsModal session={session} product={selectedProduct} canManage={canManage} onClose={() => setSelectedProduct(null)} onSaved={(updated) => { setProducts((current) => current.map((item) => item.id === updated.id ? updated : item)); setSelectedProduct(updated); setReload((value) => value + 1); }} onArchived={() => { setSelectedProduct(null); setReload((value) => value + 1); }} /> : null}
  </>;
}

function ProductDetailsModal({ session, product, canManage, onClose, onSaved, onArchived }: { session: Session; product: Product; canManage: boolean; onClose: () => void; onSaved: (product: Product) => void; onArchived: () => void }) {
  const branchId = product.branchId ?? session.branches?.[0]?.id ?? null;
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [name, setName] = useState(product.name ?? "");
  const [sku, setSku] = useState(product.sku ?? "");
  const [barcode, setBarcode] = useState(product.barcode ?? "");
  const [sellingPrice, setSellingPrice] = useState(String(product.sellingPrice ?? 0));
  const [buyingPrice, setBuyingPrice] = useState(String(product.buyingPrice ?? 0));
  const [quantityDelta, setQuantityDelta] = useState("");
  const [unitCost, setUnitCost] = useState(String(product.buyingPrice ?? 0));
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<{ stockMovements: Array<Record<string, unknown>>; salesHistory: Array<Record<string, unknown>> } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.productHistory(product.id, branchId).then(setHistory).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load product history.")); }, [product.id, branchId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const price = Number(sellingPrice);
    const cost = Number(buyingPrice);
    if (name.trim().length < 2) { setError("Enter a product name with at least two characters."); return; }
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0) { setError("Enter valid non-negative prices."); return; }
    setBusy(true); setError("");
    try {
      const updated = await api.updateProduct(product.id, branchId, { name: name.trim(), sku: sku.trim() || null, barcode: barcode.trim() || null, sellingPrice: price, buyingPrice: cost });
      onSaved(updated);
      setEditing(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not update this catalog record."); }
    finally { setBusy(false); }
  }

  async function adjust(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const delta = Number(quantityDelta);
    const cost = Number(unitCost);
    if (!Number.isFinite(delta) || delta === 0) { setError("Enter a non-zero stock adjustment."); return; }
    if (!Number.isFinite(cost) || cost < 0) { setError("Enter a valid non-negative unit cost."); return; }
    setBusy(true); setError("");
    try {
      const updated = await api.adjustProductStock(product.id, branchId, { quantityDelta: delta, unitCost: cost, ...(note.trim() ? { note: note.trim() } : {}) });
      onSaved(updated);
      setAdjusting(false); setQuantityDelta(""); setNote("");
      setHistory(await api.productHistory(product.id, branchId));
    } catch (adjustError) { setError(adjustError instanceof Error ? adjustError.message : "Could not adjust stock."); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (busy || !window.confirm(`Archive ${product.name}? It will no longer appear as an active catalog record.`)) return;
    setBusy(true); setError("");
    try { await api.archiveProduct(product.id, branchId); onArchived(); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive this record."); setBusy(false); }
  }

  const row = (item: Record<string, unknown>, index: number) => <div className="finance-row" key={String(item.id ?? item.externalId ?? index)}><strong>{String(item.note ?? item.referenceType ?? item.receiptNumber ?? "Record")}</strong><span>{String(item.quantityDelta ?? item.quantity ?? "")}</span><small>{String(item.createdAt ?? "")}</small></div>;

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-details-title">
    <div className="panel-heading"><div><span className="eyebrow">{product.catalogEntityType ?? "PRODUCT"}</span><h2 id="product-details-title">{product.name}</h2><small>{product.sku || product.barcode || product.id}</small></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    {editing ? <form onSubmit={save}><div className="preference-list"><label>Name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label><label>SKU<input value={sku} onChange={(event) => setSku(event.target.value)} /></label><label>Barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label><div className="modal-fields"><label>Cost price<input type="number" min="0" step="0.01" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} /></label><label>Selling price<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} /></label></div></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div></form> : adjusting ? <form onSubmit={adjust}><div className="modal-fields"><label>Quantity change<input autoFocus type="number" step="0.001" value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} placeholder="Use a negative number to remove stock" required /></label><label>Unit cost<input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} required /></label></div><label>Note<input value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={() => setAdjusting(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save adjustment"}</button></div></form> : <><div className="settings-list"><div className="setting-row"><div><strong>Current stock</strong><small>{product.unit ?? "pcs"}</small></div><strong>{Number(product.stockOnHand ?? 0)}</strong></div><div className="setting-row"><div><strong>Cost price</strong></div><strong>{catalogMoney(product.buyingPrice)}</strong></div><div className="setting-row"><div><strong>Selling price</strong></div><strong>{catalogMoney(product.sellingPrice)}</strong></div><div className="setting-row"><div><strong>Status</strong></div><span className={`badge ${product.isActive === false ? "warning" : "success"}`}>{product.isActive === false ? "Archived" : "Active"}</span></div></div>
      {canManage && product.isActive !== false ? <div className="modal-actions"><button className="secondary" type="button" onClick={() => { setError(""); setAdjusting(true); }}>Adjust stock</button><button className="secondary" type="button" onClick={() => { setError(""); setEditing(true); }}>Edit</button><button className="text-button" type="button" onClick={() => void archive()} disabled={busy}>Archive</button></div> : null}
      <div className="dashboard-grid"><div><h3>Stock movements</h3>{history?.stockMovements.length ? history.stockMovements.slice(0, 8).map(row) : <Empty text="No stock movements recorded." />}</div><div><h3>Sales history</h3>{history?.salesHistory.length ? history.salesHistory.slice(0, 8).map(row) : <Empty text="No sales recorded for this item." />}</div></div>
    </>}
  </section></div>;
}

function IndustryProductCreateModal({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const catalogInput = { industryKey: session.business?.industryKey ?? null, businessType: session.business?.businessType ?? null };
  const resolution = resolveCatalogCreationContext(catalogInput);
  const [entityType, setEntityType] = useState<CatalogEntityType | null>(resolution.status === "ready" ? resolution.context.defaultEntityType : null);
  const selected = resolveCatalogCreationConfig({ ...catalogInput, ...(entityType ? { entityType } : {}) });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState(selected?.defaultUnit ?? "pcs");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [hourlyPrice, setHourlyPrice] = useState("");
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [pricingModel, setPricingModel] = useState("fixed");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasField = (field: string) => Boolean(selected?.fields.some((candidate) => candidate.key === field));

  useEffect(() => { setUnit(selected?.defaultUnit ?? "pcs"); }, [selected?.defaultUnit, selected?.entityType]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!selected || resolution.status !== "ready") { setError(resolution.status === "ready" ? "Select a supported catalog entity." : resolution.message); return; }
    if (name.trim().length < 2) { setError(`Enter a ${selected.itemLabel.toLowerCase()} name.`); return; }
    if (hasField("sellingPrice") && !sellingPrice.trim()) { setError(`Enter the ${selected.itemLabel.toLowerCase()} price.`); return; }
    if (hasField("unit") && !unit.trim()) { setError("Enter a unit of measure."); return; }
    setSaving(true);
    const body = {
      businessId: session.user.businessId,
      branchId: session.branches?.[0]?.id ?? null,
      catalogEntityType: selected.entityType,
      industryKey: resolution.context.industryKey,
      name: name.trim(),
      description: hasField("description") ? description.trim() || null : null,
      unit: unit.trim() || selected.defaultUnit,
      buyingPrice: Number(buyingPrice || 0),
      sellingPrice: Number(sellingPrice || 0),
      stockOnHand: selected.supportsInventory ? 0 : 0,
      lowStockThreshold: selected.supportsInventory ? 5 : 0,
      serviceDurationMinutes: hasField("duration") && duration ? Number(duration) : null,
      hourlyPrice: hasField("hourlyPrice") && hourlyPrice ? Number(hourlyPrice) : null,
      assignedStaffId: hasField("assignedStaff") ? assignedStaffId.trim() || null : null,
      pricingModel: hasField("pricingModel") ? pricingModel : null
    };
    try {
      await api.createProduct(body);
      onSaved();
    } catch (submitError) {
      if (isOfflineError(submitError)) { queueOffline("/products", body); onSaved(); }
      else setError(submitError instanceof Error ? submitError.message : "Unable to save this catalog record.");
    } finally { setSaving(false); }
  }

  return <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow">{session.business?.name ?? "CATALOG"}</span><h2>{selected?.title ?? "Catalog setup required"}</h2><small>{selected?.description ?? (resolution.status === "ready" ? "Select a supported catalog entity." : resolution.message)}</small></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>{resolution.status === "ready" && resolution.context.supportedEntityTypes.length > 1 ? <label>Record type<select value={entityType ?? ""} onChange={(event) => setEntityType(event.target.value as CatalogEntityType)}>{resolution.context.supportedEntityTypes.map((candidate) => { const candidateConfig = resolveCatalogCreationConfig({ industryKey: resolution.context.industryKey, businessType: resolution.context.businessType, entityType: candidate }); return <option key={candidate} value={candidate}>{candidateConfig?.itemLabel ?? candidate}</option>; })}</select></label> : null}{selected ? <><label>{selected.itemLabel} name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>{hasField("description") ? <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label> : null}{hasField("unit") ? <label>{selected.entityType === "menu_item" ? "Serving unit" : "Unit"}<input value={unit} onChange={(event) => setUnit(event.target.value)} required /></label> : null}{hasField("pricingModel") ? <label>Pricing model<select value={pricingModel} onChange={(event) => setPricingModel(event.target.value)}><option value="fixed">Fixed fee</option><option value="hourly">Hourly</option><option value="quantity">By quantity</option><option value="recurring">Recurring</option><option value="milestone">Milestone</option><option value="custom">Custom</option></select></label> : null}{hasField("duration") || hasField("hourlyPrice") ? <div className="modal-fields">{hasField("duration") ? <label>Duration (minutes)<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></label> : null}{hasField("hourlyPrice") ? <label>Hourly rate<input type="number" min="0" step="0.01" value={hourlyPrice} onChange={(event) => setHourlyPrice(event.target.value)} /></label> : null}</div> : null}{hasField("assignedStaff") ? <label>Assigned staff<input value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)} placeholder="Staff or specialist ID" /></label> : null}<div className="modal-fields">{hasField("buyingPrice") ? <label>Cost price<input type="number" min="0" step="0.01" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} /></label> : null}{hasField("sellingPrice") ? <label>{selected.entityType === "service" ? "Service price" : "Selling price"}<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} required /></label> : null}</div></> : <div className="error-banner">{resolution.status === "ready" ? "This catalog entity is unavailable." : resolution.message}</div>}{error && <div className="error-banner">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit" disabled={saving || !selected}>{saving ? "Saving..." : `Save ${selected?.itemLabel.toLowerCase() ?? "record"}`}</button></div></form></div>;
}

function PageHeading({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{actions}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><span>◌</span><p>{text}</p></div>; }
function catalogMoney(value: unknown) { return `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
