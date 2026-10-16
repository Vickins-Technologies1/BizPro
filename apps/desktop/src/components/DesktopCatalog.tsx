"use client";

import { useEffect, useState, type ReactNode } from "react";
import { resolveCatalogCreationConfig, resolveCatalogCreationContext, type CatalogEntityType, type Product } from "@vbo/shared";
import { api, isOfflineError, queueOffline, type Session } from "../lib/desktop-api";

export function IndustryProducts({ session, inventory }: { session: Session; inventory: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [reload, setReload] = useState(0);
  const catalogInput = { industryKey: session.business?.industryKey ?? null, businessType: session.business?.businessType ?? null };
  const resolution = resolveCatalogCreationContext(catalogInput);
  const config = resolution.status === "ready" ? resolution.context.config : null;
  const label = config?.itemLabel ?? "catalog item";
  const hasInventory = config?.supportsInventory ?? false;

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
    <div className="table-panel panel"><table><thead><tr><th>{label}</th><th>Code</th><th>Category</th><th>Price</th><th>{hasInventory ? "Stock" : "Duration"}</th><th>Status</th><th /></tr></thead><tbody>{products.map((product) => { const stock = Number(product.stockOnHand ?? 0); return <tr key={product.id}><td><div className="table-product"><span className="product-thumb">{String(product.name ?? "?").slice(0, 1)}</span><strong>{product.name}</strong></div></td><td>{product.sku ?? product.barcode ?? "—"}</td><td>{product.categoryId ?? "General"}</td><td><strong>{catalogMoney(product.sellingPrice)}</strong></td><td>{hasInventory ? <><strong>{stock}</strong> <span className="muted">{product.unit ?? "pcs"}</span></> : product.serviceDurationMinutes ? `${product.serviceDurationMinutes} min` : "Flexible"}</td><td><span className="badge success">{product.isActive === false ? "Archived" : "Active"}</span></td><td><button className="row-menu" aria-label={`Actions for ${product.name}`} onClick={() => setQuery(String(product.sku ?? product.name))}>•••</button></td></tr>; })}</tbody></table>{!products.length && <Empty text={`No ${label.toLowerCase()} records found.`} />}</div>
    {showCreate ? <IndustryProductCreateModal session={session} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setReload((value) => value + 1); }} /> : null}
  </>;
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
