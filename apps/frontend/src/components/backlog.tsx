"use client";

import { Check, ChevronDown, CircleDot, Ellipsis, GripVertical, Pencil, Plus, Search, Trash2, X, CheckCircle2, Zap, Bug, BookOpen, Mountain } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiClient, Sprint, User, WorkItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Member = { id: string; role: string; user: User };
type Filters = { assigneeId: string; status: string; epicId: string };
const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const points = [1, 2, 3, 5, 8, 13];

export function Backlog({ api, workspaceId, members }: { api: ApiClient; workspaceId: string; members: Member[] }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [filters, setFilters] = useState<Filters>({ assigneeId: "", status: "", epicId: "" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkItem>();
  const [draggedId, setDraggedId] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ workspaceId });
      Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
      const [backlog, nextSprints, nextEpics] = await Promise.all([
        api.request<WorkItem[]>(`/work-items/backlog?${query}`),
        api.request<Sprint[]>(`/sprints?workspaceId=${workspaceId}`),
        api.request<WorkItem[]>(`/work-items?workspaceId=${workspaceId}&type=EPIC`)
      ]);
      setItems(backlog); setSprints(nextSprints); setEpics(nextEpics);
    } catch (err) { setError(message(err, "Could not load backlog")); }
    finally { setLoading(false); }
  }, [api, filters, workspaceId]);

  useEffect(() => { void load(); }, [load]);
  const visibleItems = useMemo(() => items.filter((item) => item.type !== "EPIC" && item.title.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const canReorder = !filters.assigneeId && !filters.status && !filters.epicId && !search;
  const updateLocal = useCallback((item: WorkItem) => {
    setItems((current) => current.map((entry) => entry.id === item.id ? item : entry));
    setSelected((current) => current?.id === item.id ? item : current);
  }, []);
  const mutate = async (item: WorkItem, path: string, body: object, optimistic?: Partial<WorkItem>) => {
    if (optimistic) updateLocal({ ...item, ...optimistic });
    try { updateLocal(await api.request<WorkItem>(`/work-items/${item.id}${path}`, { method: "PATCH", body: JSON.stringify(body) })); setToast("Saved"); }
    catch (err) { setError(message(err, "Update failed")); await load(); }
  };
  const remove = async (item: WorkItem) => {
    if (!confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    const previous = items; setItems((current) => current.filter((entry) => entry.id !== item.id)); setSelected(undefined);
    try { await api.request(`/work-items/${item.id}`, { method: "DELETE" }); setToast("Work item deleted"); }
    catch (err) { setItems(previous); setError(message(err, "Delete failed")); }
  };
  const reorder = async (targetId: string) => {
    if (!draggedId || draggedId === targetId || !canReorder) return;
    const previous = items;
    const next = [...items]; const source = next.findIndex((item) => item.id === draggedId); const target = next.findIndex((item) => item.id === targetId);
    const [moving] = next.splice(source, 1); next.splice(target, 0, moving);
    setItems(next.map((item, position) => ({ ...item, position })));
    setDraggedId(undefined);
    try { await api.request<WorkItem[]>("/work-items/backlog/order", { method: "PATCH", body: JSON.stringify({ workItemIds: next.map((item) => item.id) }) }); }
    catch (err) { setItems(previous); setError(message(err, "Could not save backlog order")); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Plan and refine work before it enters a sprint.</p><QuickCreate api={api} workspaceId={workspaceId} onCreated={load} /></div>
    <Card className="p-2"><div className="flex flex-wrap gap-2">
      <div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search backlog" /></div>
      <Filter value={filters.assigneeId} label="All assignees" onChange={(assigneeId) => setFilters((current) => ({ ...current, assigneeId }))}>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Filter>
      <Filter value={filters.status} label="All statuses" onChange={(status) => setFilters((current) => ({ ...current, status }))}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</Filter>
      <Filter value={filters.epicId} label="All epics" onChange={(epicId) => setFilters((current) => ({ ...current, epicId }))}>{epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}</Filter>
    </div></Card>
    {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {toast && <div className="fixed bottom-5 right-5 z-50 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">{toast}<button className="ml-3" onClick={() => setToast("")} aria-label="Dismiss">×</button></div>}
    <div className="rounded-lg border bg-white overflow-visible"><div className="hidden grid-cols-[minmax(260px,1fr)_130px_108px_70px_120px_32px] items-center gap-3 border-b bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid rounded-t-lg"><span>Work item</span><span>Epic</span><span>Status</span><span>Points</span><span>Assignee</span><span /></div>
      {loading ? <LoadingRows /> : visibleItems.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{items.filter((item) => item.type !== "EPIC").length ? "No work items match your search." : "Your backlog is clear. Add the next piece of work when you’re ready."}</div> : visibleItems.map((item) => <BacklogRow key={item.id} item={item} sprints={sprints} onOpen={() => setSelected(item)} onUpdate={mutate} onDelete={remove} onRefresh={load} draggable={canReorder} onDragStart={() => setDraggedId(item.id)} onDrop={() => void reorder(item.id)} />)}</div>
    {!canReorder && <p className="text-xs text-muted-foreground">Clear search and filters to reorder the complete backlog.</p>}
    {selected && <WorkItemDrawer item={selected} members={members} epics={epics} api={api} onClose={() => setSelected(undefined)} onSaved={(result) => { updateLocal(result); setToast("Changes saved successfully"); void load(); }} />}
  </div>;
}

function TypeIcon({ type }: { type: WorkItem["type"] }) {
  const Icon = type === "FEATURE" ? Zap : type === "BUG" ? Bug : type === "STORY" ? BookOpen : type === "EPIC" ? Mountain : CheckCircle2;
  return <Icon className={`h-4 w-4 shrink-0 ${typeColor(type)}`} aria-hidden="true" />;
}

function BacklogRow({ item, sprints, onOpen, onUpdate, onDelete, onRefresh, draggable, onDragStart, onDrop }: { item: WorkItem; sprints: Sprint[]; onOpen: () => void; onUpdate: (item: WorkItem, path: string, body: object, optimistic?: Partial<WorkItem>) => Promise<void>; onDelete: (item: WorkItem) => Promise<void>; onRefresh: () => Promise<void>; draggable: boolean; onDragStart: () => void; onDrop: () => void }) {
  const [menu, setMenu] = useState(false); const [sprintMenu, setSprintMenu] = useState(false); const stop = (event: React.MouseEvent) => event.stopPropagation();
  return <article onClick={onOpen} draggable={draggable} onDragStart={onDragStart} onDragOver={(event) => { if (draggable) event.preventDefault(); }} onDrop={onDrop} className={`relative grid cursor-pointer gap-2 border-b px-2 py-0.5 last:border-0 hover:bg-slate-50 md:grid-cols-[minmax(260px,1fr)_130px_108px_70px_120px_32px] md:items-center md:gap-3 first:rounded-t-lg last:rounded-b-lg ${menu ? "z-50" : "z-10"}`}>
    <div className="flex min-w-0 items-center gap-2"><GripVertical className={`h-4 w-4 shrink-0 text-slate-400 ${draggable ? "cursor-grab" : "opacity-30"}`} /><span title={label(item.type)}><TypeIcon type={item.type} /></span><span className="truncate text-sm font-medium">{item.title}</span><Priority priority={item.priority} /></div>
    <span className="truncate text-xs font-medium text-purple-700">{item.parentEpic?.title ?? "—"}</span><StatusChip status={item.status} /><span className="text-sm tabular-nums text-muted-foreground">{item.estimate ?? "—"}</span><Avatar user={item.assignee} />
    <div className="relative" onClick={stop}><button onClick={() => setMenu((open) => !open)} className="grid h-7 w-7 place-items-center rounded hover:bg-muted" aria-label={`Actions for ${item.title}`}><Ellipsis className="h-4 w-4" /></button>{menu && <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-white py-1 shadow-lg"><button className="menu-item" onClick={onOpen}><Pencil />Edit</button><div className="relative"><button className="menu-item" onClick={() => setSprintMenu((open) => !open)}>Move to Sprint <ChevronDown className="ml-auto" /></button>{sprintMenu && <div className="absolute right-full top-0 z-50 max-h-52 w-48 overflow-y-auto rounded-md border bg-white py-1 shadow-lg">{sprints.length ? sprints.map((sprint) => <button key={sprint.id} className="menu-item" onClick={() => void onUpdate(item, "/sprint", { sprintId: sprint.id }).then(onRefresh)}>{sprint.name}</button>) : <p className="px-3 py-2 text-xs text-muted-foreground">No sprints available</p>}</div>}</div><button className="menu-item" onClick={() => void onUpdate(item, "/position", { position: "TOP" }).then(onRefresh)}>Move to Top</button><button className="menu-item" onClick={() => void onUpdate(item, "/position", { position: "BOTTOM" }).then(onRefresh)}>Move to Bottom</button><button className="menu-item text-red-600" onClick={() => void onDelete(item)}><Trash2 />Delete</button></div>}</div>
  </article>;
}

function WorkItemDrawer({ item, members, epics, api, onClose, onSaved }: { item: WorkItem; members: Member[]; epics: WorkItem[]; api: ApiClient; onClose: () => void; onSaved: (item: WorkItem) => void }) {
  const [draft, setDraft] = useState(draftFor(item)); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => setDraft(draftFor(item)), [item]);
  const save = async () => { setSaving(true); setError(""); try { const result = await api.request<WorkItem>(`/work-items/${item.id}`, { method: "PATCH", body: JSON.stringify({ ...draft, estimate: draft.estimate ? Number(draft.estimate) : null, assigneeId: draft.assigneeId || null, parentEpicId: draft.parentEpicId || null, description: draft.description || null }) }); onSaved(result); onClose(); } catch (err) { setError(message(err, "Could not save work item")); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-40 bg-slate-900/20" onMouseDown={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{item.type} · {item.id.slice(0, 8)}</p><p className="mt-1 text-xs text-muted-foreground">Created {date(item.createdAt)} · Updated {date(item.updatedAt)}</p></div><button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button></div><Input className="mb-5 h-auto border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><Field label="Description"><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add context, decisions, or acceptance criteria…" className="min-h-36 w-full rounded-md border p-3 text-sm outline-none focus:ring-2 focus:ring-teal-600" /></Field><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Status"><Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkItem["status"] })}>{statuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select></Field><Field label="Priority"><Select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as WorkItem["priority"] })}>{priorities.map((value) => <option key={value}>{label(value)}</option>)}</Select></Field><Field label="Story points"><Select value={draft.estimate} onChange={(event) => setDraft({ ...draft, estimate: event.target.value })}><option value="">None</option>{points.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field><Field label="Assignee"><Select value={draft.assigneeId} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}><option value="">Unassigned</option>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field><Field label="Epic"><Select value={draft.parentEpicId} onChange={(event) => setDraft({ ...draft, parentEpicId: event.target.value })}><option value="">No epic</option>{epics.filter((epic) => epic.id !== item.id).map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}</Select></Field></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="sticky bottom-0 mt-6 flex justify-end gap-2 bg-white pt-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving || !draft.title.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button></div></aside></div>;
}

function QuickCreate({ api, workspaceId, onCreated }: { api: ApiClient; workspaceId: string; onCreated: () => Promise<void> }) { const [title, setTitle] = useState(""); const [type, setType] = useState<WorkItem["type"]>("TASK"); const [open, setOpen] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; await api.request("/work-items", { method: "POST", body: JSON.stringify({ title: title.trim(), workspaceId, type }) }); setTitle(""); setType("TASK"); setOpen(false); await onCreated(); }; return <form className="flex gap-2" onSubmit={(event) => void submit(event)}>{open && <><Select aria-label="Type" value={type} onChange={(event) => setType(event.target.value as WorkItem["type"])} className="w-32">{["TASK", "FEATURE", "BUG", "STORY", "EPIC"].map(t => <option key={t} value={t}>{label(t)}</option>)}</Select><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" /></>}{open ? <><Button type="submit"><Check className="h-4 w-4" />Add</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></> : <Button type="button" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add work item</Button>}</form>; }
function Filter({ value, label: placeholder, onChange, children }: { value: string; label: string; onChange: (value: string) => void; children: React.ReactNode }) { return <Select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="w-44"><option value="">{placeholder}</option>{children}</Select>; }
function StatusChip({ status }: { status: WorkItem["status"] }) {
  const config = {
    BACKLOG: { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
    TODO: { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    IN_PROGRESS: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    DONE: { bg: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-600" }
  };
  const { bg, dot } = config[status] || config.BACKLOG;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label(status)}
    </span>
  );
}
function Priority({ priority }: { priority: WorkItem["priority"] }) { return <span aria-label={`${label(priority)} priority`} className={`h-2 w-2 shrink-0 rounded-full ${priority === "URGENT" ? "bg-red-600" : priority === "HIGH" ? "bg-orange-500" : priority === "MEDIUM" ? "bg-blue-500" : "bg-slate-400"}`} />; }
function Avatar({ user }: { user?: User }) { return user ? <span title={user.name} className="grid h-6 w-6 place-items-center rounded-full bg-teal-100 text-[10px] font-semibold text-teal-800">{initials(user.name)}</span> : <span className="text-xs text-muted-foreground">Unassigned</span>; }
function Field({ label: fieldLabel, children }: { label: string; children: React.ReactNode }) { return <label><span className="field-label">{fieldLabel}</span>{children}</label>; }
function LoadingRows() { return <div className="space-y-2 p-3">{[1, 2, 3, 4].map((value) => <div key={value} className="h-9 animate-pulse rounded bg-muted" />)}</div>; }
function draftFor(item: WorkItem) { return { title: item.title, description: item.description ?? "", status: item.status, priority: item.priority, estimate: item.estimate?.toString() ?? "", assigneeId: item.assignee?.id ?? "", parentEpicId: item.parentEpic?.id ?? "" }; }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()); }
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function typeColor(type: WorkItem["type"]) { return type === "BUG" ? "text-red-500" : type === "EPIC" ? "text-purple-500" : type === "FEATURE" ? "text-blue-500" : type === "STORY" ? "text-amber-500" : "text-teal-600"; }
function date(value?: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
