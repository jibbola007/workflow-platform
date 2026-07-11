"use client";

import { Check, ChevronDown, CircleDot, Ellipsis, Flag, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiClient, Sprint, User, WorkItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Member = { id: string; role: string; user: User };
const statuses = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as const;
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function Backlog({ api, workspaceId, members }: { api: ApiClient; workspaceId: string; members: Member[] }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkItem>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ workspaceId });
      if (assigneeId) query.set("assigneeId", assigneeId);
      const [backlog, nextSprints] = await Promise.all([
        api.request<WorkItem[]>(`/work-items/backlog?${query}`), api.request<Sprint[]>(`/sprints?workspaceId=${workspaceId}`)
      ]);
      setItems(backlog); setSprints(nextSprints);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load backlog"); }
    finally { setLoading(false); }
  }, [api, workspaceId, assigneeId]);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const updateLocal = (item: WorkItem) => { setItems((current) => current.map((entry) => entry.id === item.id ? item : entry)); setSelected((current) => current?.id === item.id ? item : current); };
  const mutate = async (item: WorkItem, path: string, body: object, optimistic?: Partial<WorkItem>) => {
    if (optimistic) updateLocal({ ...item, ...optimistic });
    try { const result = await api.request<WorkItem>(`/work-items/${item.id}${path}`, { method: "PATCH", body: JSON.stringify(body) }); updateLocal(result); setToast("Saved"); }
    catch (err) { setError(err instanceof Error ? err.message : "Update failed"); await load(); }
  };
  const remove = async (item: WorkItem) => {
    if (!confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    setItems((current) => current.filter((entry) => entry.id !== item.id)); setSelected(undefined);
    try { await api.request(`/work-items/${item.id}`, { method: "DELETE" }); setToast("Work item deleted"); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); await load(); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-muted-foreground">Plan and refine work before it enters a sprint.</p></div>
      <QuickCreate api={api} workspaceId={workspaceId} onCreated={load} />
    </div>
    <Card className="overflow-visible p-2">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search backlog" /></div>
        <Select aria-label="Filter by assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-48"><option value="">All assignees</option>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select>
      </div>
    </Card>
    {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {toast && <div className="fixed bottom-5 right-5 z-50 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">{toast}<button className="ml-3" onClick={() => setToast("")} aria-label="Dismiss">×</button></div>}
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="hidden grid-cols-[minmax(260px,1fr)_130px_112px_90px_150px_32px] items-center gap-3 border-b bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid"><span>Work item</span><span>Epic</span><span>Status</span><span>Points</span><span>Assignee</span><span /></div>
      {loading ? <div className="space-y-2 p-3">{[1,2,3,4].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{items.length ? "No work items match your search." : "Your backlog is clear. Add the next piece of work when you’re ready."}</div> : filtered.map((item) => <BacklogRow key={item.id} item={item} members={members} sprints={sprints} onOpen={() => setSelected(item)} onUpdate={mutate} onDelete={remove} onRefresh={load} />)}
    </div>
    {selected && <WorkItemPanel item={selected} members={members} api={api} onClose={() => setSelected(undefined)} onSaved={updateLocal} />}
  </div>;
}

function BacklogRow({ item, members, sprints, onOpen, onUpdate, onDelete, onRefresh }: { item: WorkItem; members: Member[]; sprints: Sprint[]; onOpen: () => void; onUpdate: (item: WorkItem, path: string, body: object, optimistic?: Partial<WorkItem>) => Promise<void>; onDelete: (item: WorkItem) => Promise<void>; onRefresh: () => Promise<void> }) {
  const [menu, setMenu] = useState(false);
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return <article onClick={onOpen} className="relative grid cursor-pointer gap-2 border-b px-3 py-2.5 last:border-0 hover:bg-slate-50 md:grid-cols-[minmax(260px,1fr)_130px_112px_90px_150px_32px] md:items-center md:gap-3">
    <div className="flex min-w-0 items-center gap-2"><CircleDot className={`h-4 w-4 shrink-0 ${item.type === "BUG" ? "text-red-500" : item.type === "EPIC" ? "text-purple-500" : "text-teal-600"}`} /><span className="truncate text-sm font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{item.type}</span></div>
    <span className="truncate text-xs text-purple-700">{item.parentEpic?.title}</span>
    <Select onClick={stop} value={item.status} onChange={(e) => void onUpdate(item, "/status", { status: e.target.value }, { status: e.target.value as WorkItem["status"] })} className="h-8 text-xs"><option value="BACKLOG">Backlog</option><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></Select>
    <Select onClick={stop} value={item.estimate ?? ""} onChange={(e) => void onUpdate(item, "/estimate", { estimate: e.target.value ? Number(e.target.value) : null }, { estimate: e.target.value ? Number(e.target.value) : undefined })} className="h-8 text-xs"><option value="">—</option>{[1,2,3,5,8,13].map((value) => <option key={value} value={value}>{value}</option>)}</Select>
    <Select onClick={stop} value={item.assignee?.id ?? ""} onChange={(e) => { const member = members.find((m) => m.user.id === e.target.value); void onUpdate(item, "/assignee", { assigneeId: e.target.value || null }, { assignee: member?.user }); }} className="h-8 text-xs"><option value="">Unassigned</option>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select>
    <div className="relative" onClick={stop}><button onClick={() => setMenu(!menu)} className="grid h-8 w-8 place-items-center rounded hover:bg-muted" aria-label={`Actions for ${item.title}`}><Ellipsis className="h-4 w-4" /></button>{menu && <div className="absolute right-0 z-20 w-44 rounded-md border bg-white py-1 shadow-lg"><button className="menu-item" onClick={onOpen}><Pencil />Edit</button><button className="menu-item" onClick={() => void onUpdate(item, "/position", { position: "TOP" }).then(onRefresh)}>Move to top</button><button className="menu-item" onClick={() => void onUpdate(item, "/position", { position: "BOTTOM" }).then(onRefresh)}>Move to bottom</button>{sprints.map((sprint) => <button key={sprint.id} className="menu-item" onClick={() => void onUpdate(item, "/sprint", { sprintId: sprint.id }).then(onRefresh)}>Move to {sprint.name}</button>)}<button className="menu-item text-red-600" onClick={() => void onDelete(item)}><Trash2 />Delete</button></div>}</div>
  </article>;
}

function QuickCreate({ api, workspaceId, onCreated }: { api: ApiClient; workspaceId: string; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState(""); const [open, setOpen] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; await api.request("/work-items", { method: "POST", body: JSON.stringify({ title, workspaceId, type: "TASK" }) }); setTitle(""); setOpen(false); await onCreated(); };
  return <form className="flex gap-2" onSubmit={submit}>{open && <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />}{open ? <><Button type="submit"><Check className="h-4 w-4" />Add</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></> : <Button type="button" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add work item</Button>}</form>;
}

function WorkItemPanel({ item, members, api, onClose, onSaved }: { item: WorkItem; members: Member[]; api: ApiClient; onClose: () => void; onSaved: (item: WorkItem) => void }) {
  const [draft, setDraft] = useState({ title: item.title, description: item.description ?? "", status: item.status, priority: item.priority, estimate: item.estimate?.toString() ?? "", assigneeId: item.assignee?.id ?? "", parentEpicId: item.parentEpic?.id ?? "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [comment, setComment] = useState(""); const [comments, setComments] = useState(item.comments ?? []);
  useEffect(() => { setDraft({ title: item.title, description: item.description ?? "", status: item.status, priority: item.priority, estimate: item.estimate?.toString() ?? "", assigneeId: item.assignee?.id ?? "", parentEpicId: item.parentEpic?.id ?? "" }); setComments(item.comments ?? []); }, [item]);
  const save = async () => { setSaving(true); setError(""); try { const result = await api.request<WorkItem>(`/work-items/${item.id}`, { method: "PATCH", body: JSON.stringify({ ...draft, estimate: draft.estimate ? Number(draft.estimate) : null, assigneeId: draft.assigneeId || null, parentEpicId: draft.parentEpicId || null }) }); onSaved(result); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Could not save work item"); } finally { setSaving(false); } };
  const addComment = async () => { if (!comment.trim()) return; try { const result = await api.request<typeof comments[number]>("/comments", { method: "POST", body: JSON.stringify({ workItemId: item.id, message: comment }) }); setComments((current) => [...current, result]); setComment(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not add comment"); } };
  return <div className="fixed inset-0 z-40 bg-slate-900/20" onMouseDown={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex justify-between gap-3"><span className="text-sm text-muted-foreground">{item.type} · {item.id.slice(0, 8)}</span><button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button></div><Input className="mb-5 h-auto border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /><label className="field-label">Description</label><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Add context, decisions, or acceptance criteria…" className="mb-5 min-h-36 w-full rounded-md border p-3 text-sm outline-none focus:ring-2 focus:ring-teal-600" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as WorkItem["status"] })}>{statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field><Field label="Priority"><Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as WorkItem["priority"] })}>{priorities.map((value) => <option key={value}>{value}</option>)}</Select></Field><Field label="Story points"><Input type="number" min="0" value={draft.estimate} onChange={(e) => setDraft({ ...draft, estimate: e.target.value })} /></Field><Field label="Assignee"><Select value={draft.assigneeId} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}><option value="">Unassigned</option>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field></div><div className="mt-7 border-t pt-4"><p className="field-label">Activity</p><p className="text-sm text-muted-foreground">Activity history will appear here.</p></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="sticky bottom-0 mt-6 flex justify-end gap-2 bg-white pt-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving || !draft.title.trim()} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button></div></aside></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="field-label">{label}</span>{children}</label>; }
