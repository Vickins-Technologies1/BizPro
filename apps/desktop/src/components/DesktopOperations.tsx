"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ACCESS_PERMISSIONS, getNextBusinessOperationStatus, hasPermission, resolveBusinessTypeConfig, type AccessPermission, type BusinessOperation, type BusinessOperationKind, type BusinessOperationStatus, type Customer } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";

type OperationItem = BusinessOperation["items"][number];
type StaffOption = { id: string; fullName?: string; isActive?: boolean; role?: string };
type DraftLine = { name: string; quantity: string; unitPrice: string };
const statuses: BusinessOperationStatus[] = ["draft", "open", "preparing", "ready", "confirmed", "in_progress", "completed", "cancelled"];

function operationKindForConfig(config: ReturnType<typeof resolveBusinessTypeConfig>): BusinessOperationKind {
  if (config.capabilities.projects) return "project";
  if (config.capabilities.appointments && !config.capabilities.workOrders) return "appointment";
  if (config.capabilities.workOrders) return "work_order";
  return "order";
}

function statusLabel(status: BusinessOperationStatus, config: ReturnType<typeof resolveBusinessTypeConfig>) {
  if (config.operatingModel === "hospitality") {
    if (status === "confirmed" || status === "open") return "Reserved";
    if (status === "in_progress" || status === "preparing") return "Checked in";
    if (status === "ready") return "In stay";
    if (status === "completed") return "Checked out";
  }
  if (!config.capabilities.orders) return status.replaceAll("_", " ");
  if (status === "ready") return "Ready";
  if (status === "completed") return "Served / picked up";
  return status.replaceAll("_", " ");
}

function nextStatus(operation: BusinessOperation, config: ReturnType<typeof resolveBusinessTypeConfig>) {
  const next = getNextBusinessOperationStatus(operation.status);
  if (config.operatingModel === "hospitality" && operation.status === "confirmed") return "Check in";
  if (config.operatingModel === "hospitality" && operation.status === "in_progress") return "Check out";
  return `Move to ${statusLabel(next, config).toLowerCase()}`;
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeOperation(row: Record<string, unknown>): BusinessOperation {
  return {
    ...row,
    id: String(row.id ?? row._id ?? row.externalId ?? ""),
    businessId: String(row.businessId ?? ""),
    kind: row.kind as BusinessOperationKind,
    status: row.status as BusinessOperationStatus,
    title: String(row.title ?? ""),
    items: Array.isArray(row.items) ? row.items as OperationItem[] : [],
    total: Number(row.total ?? 0)
  } as BusinessOperation;
}

export function DesktopOperations({ session }: { session: Session }) {
  const config = useMemo(() => resolveBusinessTypeConfig({ businessType: session.business.businessType, industryKey: session.business.industryKey }), [session.business.businessType, session.business.industryKey]);
  const kind = operationKindForConfig(config);
  const branchId = session.branches?.[0]?.id ?? null;
  const permissions = session.user.permissions?.filter((permission): permission is AccessPermission => ACCESS_PERMISSIONS.includes(permission as AccessPermission)) ?? null;
  const canManage = hasPermission({ role: session.user.role, permissions }, "manageOperations");
  const [operations, setOperations] = useState<BusinessOperation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BusinessOperationStatus | "active">("active");
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [secondaryValue, setSecondaryValue] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemPrice, setItemPrice] = useState("0");

  async function load() {
    setLoading(true); setError("");
    try {
      const [remoteOperations, nextCustomers, nextStaff] = await Promise.all([
        api.operations({ branchId, kind }),
        api.customers(branchId).catch(() => []),
        api.employees(branchId).catch(() => [])
      ]);
      setOperations(remoteOperations.map(normalizeOperation));
      setCustomers(nextCustomers);
      setStaff(nextStaff as StaffOption[]);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load operations."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [branchId, kind]);

  const visible = useMemo(() => operations.filter((operation) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [operation.title, operation.notes, operation.vehiclePlate, operation.tableName, operation.vehicleMake, operation.vehicleModel].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
    const matchesStatus = statusFilter === "active" ? operation.status !== "cancelled" : operation.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "")), [operations, search, statusFilter]);

  function resetEditor() {
    setTitle(""); setSecondaryValue(""); setVehicleMake(""); setVehicleModel(""); setVehicleYear(""); setVehicleMileage(""); setScheduledAt(""); setDurationMinutes("60"); setNotes(""); setCustomerId(""); setStaffId(""); setLines([]); setItemName(""); setItemQuantity("1"); setItemPrice("0"); setError("");
  }

  function addLine() {
    const quantity = Number(itemQuantity); const unitPrice = Number(itemPrice);
    if (!itemName.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) { setError("Add an item name, a positive quantity, and a valid unit price."); return; }
    setLines((current) => [...current, { name: itemName.trim(), quantity: String(quantity), unitPrice: String(unitPrice) }]);
    setItemName(""); setItemQuantity("1"); setItemPrice("0"); setError("");
  }

  async function create(event: FormEvent) {
    event.preventDefault(); if (!canManage || saving) return;
    if (!branchId) { setError("Choose one branch before creating an operation."); return; }
    if (!title.trim()) { setError(`Enter a ${config.terminology.transaction.toLowerCase()} title.`); return; }
    if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) { setError("Choose a valid date and time."); return; }
    if (kind === "work_order" && ((vehicleYear && !/^\d{4}$/.test(vehicleYear)) || (vehicleMileage && (!Number.isInteger(Number(vehicleMileage)) || Number(vehicleMileage) < 0)))) { setError("Enter a four-digit vehicle year and a non-negative whole-number mileage."); return; }
    const operationItems: OperationItem[] = lines.map((line) => ({ name: line.name, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }));
    setSaving(true); setError(""); setNotice("");
    try {
      const created = await api.createOperation({
        externalId: crypto.randomUUID(), branchId, kind, status: kind === "appointment" ? "confirmed" : "open", title: title.trim(),
        customerId: customerId || null, staffId: staffId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        durationMinutes: kind === "appointment" ? Number(durationMinutes) : null,
        tableName: kind === "order" || config.operatingModel === "hospitality" ? secondaryValue.trim() || null : null,
        vehiclePlate: kind === "work_order" ? secondaryValue.trim() || null : null,
        vehicleMake: kind === "work_order" ? vehicleMake.trim() || null : null,
        vehicleModel: kind === "work_order" ? vehicleModel.trim() || null : null,
        vehicleYear: kind === "work_order" && vehicleYear ? Number(vehicleYear) : null,
        vehicleMileage: kind === "work_order" && vehicleMileage ? Number(vehicleMileage) : null,
        notes: notes.trim() || null, items: operationItems,
        total: operationItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      });
      setOperations((current) => [normalizeOperation(created), ...current]); setShowEditor(false); resetEditor(); setNotice(`${config.workspace.primaryEntity} created.`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "The operation was not saved."); }
    finally { setSaving(false); }
  }

  async function advance(operation: BusinessOperation) {
    if (!canManage || busyId) return;
    const status = getNextBusinessOperationStatus(operation.status);
    setBusyId(operation.id); setError(""); setNotice("");
    try {
      const updated = await api.updateOperation(operation.id, { status });
      setOperations((current) => current.map((item) => item.id === operation.id ? normalizeOperation(updated) : item));
      setNotice(`${config.workspace.primaryEntity} moved to ${statusLabel(status, config).toLowerCase()}.`);
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Status update failed."); }
    finally { setBusyId(""); }
  }

  async function archive(operation: BusinessOperation) {
    if (!canManage || busyId) return;
    setBusyId(operation.id); setError(""); setNotice("");
    try {
      const updated = await api.archiveOperation(operation.id);
      setOperations((current) => current.map((item) => item.id === operation.id ? normalizeOperation(updated) : item));
      setNotice(`${config.workspace.primaryEntity} cancelled.`);
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not cancel operation."); }
    finally { setBusyId(""); }
  }

  const hasLineItems = kind === "order" || config.operatingModel === "hospitality";
  return <>
    <div className="page-heading"><div><span className="eyebrow">{config.label.toUpperCase()} WORKFLOW</span><h1>{config.workspace.activityLabel}</h1><p>{config.workflow.headline} · {config.workflow.steps.join(" → ")}</p></div><div className="heading-actions">{config.capabilities.kitchen ? <span className="badge warning">Kitchen queue</span> : null}{config.capabilities.appointments ? <span className="badge success">Appointments</span> : null}{config.capabilities.workOrders ? <span className="badge warning">Job cards</span> : null}{config.capabilities.projects ? <span className="badge info">Projects</span> : null}{canManage ? <button className="primary" onClick={() => { resetEditor(); setShowEditor(true); }}>+ {config.workspace.primaryAction}</button> : null}</div></div>
    {error && !showEditor ? <div className="error-banner" role="alert">{error}</div> : null}{notice ? <div className="success-banner" role="status">{notice}</div> : null}
    <div className="toolbar"><input className="search-field" aria-label="Search operations" placeholder={`Search ${config.workspace.activityLabel.toLowerCase()}…`} value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter operation status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BusinessOperationStatus | "active")}><option value="active">Active</option>{statuses.map((status) => <option value={status} key={status}>{statusLabel(status, config)}</option>)}</select><button className="secondary" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
    <div className="metric-grid"><div className="metric-card blue"><span>Active {config.workspace.activityLabel.toLowerCase()}</span><strong>{operations.filter((operation) => !["cancelled", "completed"].includes(operation.status)).length}</strong></div><div className="metric-card green"><span>Completed</span><strong>{operations.filter((operation) => operation.status === "completed").length}</strong></div><div className="metric-card amber"><span>Scheduled / queued</span><strong>{operations.filter((operation) => operation.scheduledAt || ["open", "preparing", "ready", "confirmed", "in_progress"].includes(operation.status)).length}</strong></div><div className="metric-card red"><span>Cancelled</span><strong>{operations.filter((operation) => operation.status === "cancelled").length}</strong></div></div>
    <section className="panel operation-list">{loading ? <div className="empty">Loading {config.workspace.activityLabel.toLowerCase()}…</div> : visible.length ? visible.map((operation) => <article className="operation-card" key={operation.id}><div className="operation-main"><div><span className="eyebrow">{config.terminology.transaction}</span><h2>{operation.title}</h2><p>{operation.scheduledAt ? new Date(operation.scheduledAt).toLocaleString() : operation.vehiclePlate ? `Vehicle ${operation.vehiclePlate}` : operation.tableName ? `${config.operatingModel === "hospitality" ? "Room" : "Table"} ${operation.tableName}` : config.workspace.primaryEntity}</p></div><span className={`badge ${operation.status === "completed" ? "success" : operation.status === "cancelled" ? "warning" : "info"}`}>{statusLabel(operation.status, config)}</span></div>{operation.notes ? <p className="muted">{operation.notes}</p> : null}{operation.vehicleMake || operation.vehicleModel || operation.vehicleYear || operation.vehicleMileage ? <p className="muted">{[operation.vehicleMake, operation.vehicleModel, operation.vehicleYear, operation.vehicleMileage ? `${Number(operation.vehicleMileage).toLocaleString()} km` : ""].filter(Boolean).join(" · ")}</p> : null}{operation.items?.length ? <div className="operation-lines">{operation.items.map((item, index) => <span key={`${item.name}-${index}`}>{item.quantity} × {item.name} · {money(item.quantity * item.unitPrice, session.business.currency)}</span>)}<strong>Total {money(operation.total, session.business.currency)}</strong></div> : null}<div className="operation-actions">{canManage && operation.status !== "completed" && operation.status !== "cancelled" ? <button className="secondary" onClick={() => void advance(operation)} disabled={busyId === operation.id}>{busyId === operation.id ? "Saving…" : nextStatus(operation, config)}</button> : null}{canManage && !["completed", "cancelled"].includes(operation.status) ? <button className="text-button" onClick={() => void archive(operation)} disabled={busyId === operation.id}>Cancel</button> : null}</div></article>) : <div className="empty">{error || `No ${config.workspace.activityLabel.toLowerCase()} match these filters.`}{canManage && !operations.length ? <button className="primary" onClick={() => { resetEditor(); setShowEditor(true); }}>{config.workspace.primaryAction}</button> : null}</div>}</section>
    {showEditor ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowEditor(false); }}><form className="modal-card operation-editor" onSubmit={(event) => void create(event)}><div className="panel-heading"><div><span className="eyebrow">{config.label.toUpperCase()} WORKFLOW</span><h2>{config.workspace.primaryAction}</h2></div><button type="button" className="text-button" onClick={() => setShowEditor(false)} disabled={saving}>Close</button></div>
      <label>{config.workspace.primaryEntity} title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} placeholder={kind === "work_order" ? "Vehicle service job" : kind === "appointment" ? "Client appointment" : kind === "project" ? "Client engagement" : "New order"} /></label>
      {kind === "order" ? <label>Table or service area<input value={secondaryValue} onChange={(event) => setSecondaryValue(event.target.value)} placeholder="Table 4" /></label> : null}
      {config.operatingModel === "hospitality" ? <label>Room number<input value={secondaryValue} onChange={(event) => setSecondaryValue(event.target.value)} placeholder="Room 204" /></label> : null}
      {kind === "work_order" ? <div className="operation-field-grid"><label>Vehicle plate<input value={secondaryValue} onChange={(event) => setSecondaryValue(event.target.value)} /></label><label>Make<input value={vehicleMake} onChange={(event) => setVehicleMake(event.target.value)} /></label><label>Model<input value={vehicleModel} onChange={(event) => setVehicleModel(event.target.value)} /></label><label>Year<input type="number" min="1886" max="2100" step="1" value={vehicleYear} onChange={(event) => setVehicleYear(event.target.value)} /></label><label>Mileage<input type="number" min="0" step="1" value={vehicleMileage} onChange={(event) => setVehicleMileage(event.target.value)} /></label></div> : null}
      {kind === "appointment" || kind === "project" ? <div className="operation-field-grid"><label>{kind === "appointment" ? "Start date and time" : "Upcoming deadline"}<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>{kind === "appointment" ? <label>Duration (minutes)<input type="number" min="5" max="1440" step="5" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} /></label> : null}</div> : null}
      {customers.length ? <label>{config.terminology.customers}<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">{config.operatingModel === "care" ? "Unlinked patient" : config.operatingModel === "project" ? "Unlinked client" : "Walk-in / no customer"}</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label> : null}
      {staff.length && kind !== "order" ? <label>Assign staff<select value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="">Unassigned</option>{staff.filter((member) => member.isActive !== false).map((member) => <option value={member.id} key={member.id}>{member.fullName ?? member.id}{member.role ? ` · ${member.role}` : ""}</option>)}</select></label> : null}
      {hasLineItems ? <fieldset className="operation-item-editor"><legend>{config.capabilities.menu ? "Order items" : config.operatingModel === "hospitality" ? "Stay charges" : "Items"}</legend>{lines.map((line, index) => <div className="operation-draft-line" key={`${line.name}-${index}`}><span>{line.quantity} × {line.name}</span><strong>{money(Number(line.quantity) * Number(line.unitPrice), session.business.currency)}</strong><button type="button" className="text-button" onClick={() => setLines((current) => current.filter((_, row) => row !== index))}>Remove</button></div>)}<div className="operation-field-grid"><label>{config.capabilities.menu ? "Menu item" : "Item name"}<input value={itemName} onChange={(event) => setItemName(event.target.value)} /></label><label>Quantity<input type="number" min="0.01" step="0.01" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} /></label><label>Unit price<input type="number" min="0" step="0.01" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} /></label><button type="button" className="secondary" onClick={addLine}>Add item</button></div><div className="basket-total"><span>Operation total</span><strong>{money(lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0), session.business.currency)}</strong></div></fieldset> : null}
      <label>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" /></label>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? "Saving…" : `Save ${config.workspace.primaryEntity}`}</button></div>
    </form></div> : null}
  </>;
}
