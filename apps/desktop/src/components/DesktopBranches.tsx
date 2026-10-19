"use client";

import { useEffect, useState } from "react";
import type { Branch } from "@vbo/shared";
import { api, type Session } from "../lib/desktop-api";

type BranchDraft = { name: string; code: string; location: string; phone: string; email: string; description: string };
const blankBranch: BranchDraft = { name: "", code: "", location: "", phone: "", email: "", description: "" };

export function DesktopBranches({ session, onBranchesChange }: { session: Session; onBranchesChange: (branches: Branch[]) => void }) {
  const [branches, setBranches] = useState<Branch[]>(session.branches ?? []);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    api.branches().then((next) => { if (active) { setBranches(next); onBranchesChange(next); } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load branches."); });
    return () => { active = false; };
  }, [reload, onBranchesChange]);

  async function toggle(branch: Branch) {
    setBusyId(branch.id); setError("");
    try { await (branch.status === "inactive" ? api.activateBranch(branch.id) : api.deactivateBranch(branch.id)); setReload((value) => value + 1); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : "Could not update branch status."); }
    finally { setBusyId(""); }
  }

  async function save(draft: BranchDraft) {
    setError("");
    if (editing) await api.updateBranch(editing.id, { ...draft, name: draft.name.trim(), code: draft.code.trim().toUpperCase(), location: draft.location.trim() || null, phone: draft.phone.trim() || null, email: draft.email.trim() || null, description: draft.description.trim() || null });
    else await api.createBranch({ name: draft.name.trim(), code: draft.code.trim().toUpperCase(), location: draft.location.trim() || null, phone: draft.phone.trim() || null, email: draft.email.trim() || null, description: draft.description.trim() || null });
    setEditing(null); setShowCreate(false); setReload((value) => value + 1);
  }

  return <section className="panel branch-panel">
    <div className="panel-heading"><div><span className="eyebrow">WORKSPACE STRUCTURE</span><h2>Branches</h2></div><button className="primary" onClick={() => setShowCreate(true)}>+ Add branch</button></div>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="table-panel"><table><thead><tr><th>Branch</th><th>Code</th><th>Location</th><th>Staff</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {branches.map((branch) => <tr key={branch.id}><td><strong>{branch.name}</strong>{branch.isDefault ? <small>Default branch</small> : null}</td><td>{branch.code}</td><td>{branch.location || "—"}</td><td>{branch.staffCount ?? 0}</td><td><span className={`badge ${branch.status === "active" ? "success" : "warning"}`}>{branch.status}</span></td><td className="branch-actions"><button className="text-button" disabled={busyId === branch.id} onClick={() => setEditing(branch)}>Edit</button><button className="text-button" disabled={busyId === branch.id} onClick={() => void toggle(branch)}>{busyId === branch.id ? "Saving…" : branch.status === "active" ? "Deactivate" : "Activate"}</button></td></tr>)}
    </tbody></table>{!branches.length && <div className="empty"><p>No branches are available for this workspace.</p></div>}</div>
    {showCreate ? <BranchModal title="Add branch" initial={blankBranch} onClose={() => setShowCreate(false)} onSave={save} /> : null}
    {editing ? <BranchModal title="Edit branch" initial={{ name: editing.name, code: editing.code, location: editing.location ?? "", phone: editing.phone ?? "", email: editing.email ?? "", description: editing.description ?? "" }} onClose={() => setEditing(null)} onSave={save} /> : null}
  </section>;
}

function BranchModal({ title, initial, onClose, onSave }: { title: string; initial: BranchDraft; onClose: () => void; onSave: (draft: BranchDraft) => Promise<void> }) {
  const [draft, setDraft] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (busy) return;
    if (draft.name.trim().length < 2 || draft.code.trim().length < 2) { setError("Branch name and code must each contain at least two characters."); return; }
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email.trim())) { setError("Enter a valid branch email address."); return; }
    setBusy(true); setError(""); try { await onSave(draft); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save branch."); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}>
    <div className="panel-heading"><div><span className="eyebrow">BRANCH MANAGEMENT</span><h2>{title}</h2></div><button type="button" className="text-button" onClick={onClose}>Close</button></div>
    {(["name", "code", "location", "phone", "email", "description"] as const).map((key) => <label key={key}>{key === "name" ? "Branch name" : key === "code" ? "Branch code" : key[0]?.toUpperCase() + key.slice(1)}<input autoFocus={key === "name"} required={key === "name" || key === "code"} type={key === "email" ? "email" : "text"} value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : "Save branch"}</button></div>
  </form></div>;
}
