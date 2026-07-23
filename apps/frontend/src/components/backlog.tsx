"use client";

import { Check, ChevronDown, CircleDot, Ellipsis, GripVertical, Pencil, Plus, Search, Trash2, X, CheckCircle2, Zap, Bug, BookOpen, Mountain } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient, Board, Sprint, User, WorkItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Member = { id: string; role: string; user: User };
type Filters = { assigneeId: string; status: string; epicId: string };
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const points = [1, 2, 3, 5, 8, 13];

export type EpicColorTheme = {
  name: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  badge: string;
};

export const EPIC_PALETTE: EpicColorTheme[] = [
  { name: "purple",  bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200", dot: "bg-purple-500",  badge: "bg-purple-100 text-purple-800 border-purple-200" },
  { name: "blue",    bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",   dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-800 border-blue-200" },
  { name: "emerald", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { name: "amber",   bg: "bg-amber-50",   text: "text-amber-800",   border: "border-amber-200",  dot: "bg-amber-500",   badge: "bg-amber-100 text-amber-900 border-amber-200" },
  { name: "rose",    bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",   dot: "bg-rose-500",    badge: "bg-rose-100 text-rose-800 border-rose-200" },
  { name: "teal",    bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200",   dot: "bg-teal-500",    badge: "bg-teal-100 text-teal-800 border-teal-200" },
  { name: "pink",    bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",   dot: "bg-pink-500",    badge: "bg-pink-100 text-pink-800 border-pink-200" },
  { name: "indigo",  bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200", dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { name: "cyan",    bg: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-200",   dot: "bg-cyan-500",    badge: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { name: "orange",  bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200", dot: "bg-orange-500",  badge: "bg-orange-100 text-orange-800 border-orange-200" }
];

export function getEpicColor(epic?: { id?: string; color?: string } | null): EpicColorTheme {
  if (!epic || !epic.id) return EPIC_PALETTE[0];
  if (epic.color) {
    const match = EPIC_PALETTE.find((c) => c.name === epic.color);
    if (match) return match;
  }
  let hash = 0;
  for (let i = 0; i < epic.id.length; i++) {
    hash = (hash << 5) - hash + epic.id.charCodeAt(i);
    hash |= 0;
  }
  return EPIC_PALETTE[Math.abs(hash) % EPIC_PALETTE.length];
}

export function Backlog({ api, workspaceId, members }: { api: ApiClient; workspaceId: string; members: Member[] }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [filters, setFilters] = useState<Filters>({ assigneeId: "", status: "", epicId: "" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkItem>();
  const [draggedId, setDraggedId] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [deletingEpic, setDeletingEpic] = useState<WorkItem | null>(null);
  const [isDeletingEpic, setIsDeletingEpic] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ workspaceId });
      Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
      const [backlog, nextSprints, nextEpics, nextBoards] = await Promise.all([
        api.request<WorkItem[]>(`/work-items/backlog?${query}`),
        api.request<Sprint[]>(`/sprints?workspaceId=${workspaceId}`),
        api.request<WorkItem[]>(`/work-items?workspaceId=${workspaceId}&type=EPIC`),
        api.request<Board[]>(`/boards?workspaceId=${workspaceId}`)
      ]);
      setItems(backlog); setSprints(nextSprints); setEpics(nextEpics); setBoards(nextBoards);
    } catch (err) { setError(message(err, "Could not load backlog")); }
    finally { setLoading(false); }
  }, [api, filters, workspaceId]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    boards.forEach((b) => b.columns?.forEach((c) => { if (c.name) set.add(c.name); }));
    items.forEach((item) => { if (item.status) set.add(item.status); });
    if (set.size === 0) return ["To Do", "In Progress", "Done"];
    return Array.from(set);
  }, [boards, items]);

  useEffect(() => { void load(); }, [load]);
  const visibleItems = useMemo(() => items.filter((item) => item.type !== "EPIC" && (item.title.toLowerCase().includes(search.toLowerCase()) || (item.key && item.key.toLowerCase().includes(search.toLowerCase())))), [items, search]);
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
    if (item.type === "EPIC") {
      promptDeleteEpic(item);
      return;
    }
    if (!confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    const previous = items; setItems((current) => current.filter((entry) => entry.id !== item.id)); setSelected(undefined);
    try { await api.request(`/work-items/${item.id}`, { method: "DELETE" }); setToast("Work item deleted"); }
    catch (err) { setItems(previous); setError(message(err, "Delete failed")); }
  };

  const promptDeleteEpic = (epic: WorkItem) => {
    const childCount = epic._count?.children ?? 0;
    if (childCount > 0) {
      setDeletingEpic(epic);
    } else {
      if (confirm(`Delete Epic “${epic.title}”? This cannot be undone.`)) {
        void executeDeleteEpic(epic);
      }
    }
  };

  const executeDeleteEpic = async (epic: WorkItem) => {
    setIsDeletingEpic(true);
    try {
      await api.request(`/work-items/${epic.id}`, { method: "DELETE" });
      setToast(`Epic “${epic.title}” deleted successfully`);
      if (selected?.id === epic.id) {
        setSelected(undefined);
      }
      setDeletingEpic(null);
      await load();
    } catch (err) {
      setError(message(err, "Failed to delete Epic"));
    } finally {
      setIsDeletingEpic(false);
    }
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
    
    {epics.length > 0 && (
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            <Mountain className="h-4 w-4 text-purple-500" /> Epics ({epics.length}):
          </span>
          {epics.map((epic) => {
            const theme = getEpicColor(epic);
            const isSelected = filters.epicId === epic.id;
            return (
              <div
                key={epic.id}
                className={`group relative flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? `${theme.border} ${theme.bg} ${theme.text} shadow-sm ring-1 ${theme.border}`
                    : `${theme.bg} ${theme.text} ${theme.border} hover:opacity-90`
                }`}
              >
                <button
                  onClick={() => setFilters((current) => ({ ...current, epicId: current.epicId === epic.id ? "" : epic.id }))}
                  className="flex items-center gap-1.5"
                  title={filters.epicId === epic.id ? "Clear filter" : `Filter backlog by ${epic.title}`}
                >
                  <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                  <span>{epic.title}</span>
                  {epic._count?.children !== undefined && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      {epic._count.children}
                    </span>
                  )}
                </button>
                <EpicActionMenu
                  epic={epic}
                  activeMenuId={activeMenuId}
                  setActiveMenuId={setActiveMenuId}
                  onEdit={() => setSelected(epic)}
                  onDelete={() => promptDeleteEpic(epic)}
                />
              </div>
            );
          })}
        </div>
      </Card>
    )}

    <Card className="p-2"><div className="flex flex-wrap gap-2">
      <div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search backlog" /></div>
      <Filter value={filters.assigneeId} label="All assignees" onChange={(assigneeId) => setFilters((current) => ({ ...current, assigneeId }))}>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Filter>
      <Filter value={filters.status} label="All statuses" onChange={(status) => setFilters((current) => ({ ...current, status }))}>{availableStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</Filter>
      <Filter value={filters.epicId} label="All epics" onChange={(epicId) => setFilters((current) => ({ ...current, epicId }))}>{epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}</Filter>
    </div></Card>
    {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    {toast && <div className="fixed bottom-5 right-5 z-50 rounded-md bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">{toast}<button className="ml-3" onClick={() => setToast("")} aria-label="Dismiss">×</button></div>}
    <div className="rounded-lg border bg-white overflow-visible"><div className="hidden grid-cols-[minmax(260px,1fr)_130px_108px_70px_120px_32px] items-center gap-3 border-b bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid rounded-t-lg"><span>Work item</span><span>Epic</span><span>Status</span><span>Points</span><span>Assignee</span><span /></div>
      {loading ? <LoadingRows /> : visibleItems.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{items.filter((item) => item.type !== "EPIC").length ? "No work items match your search." : "Your backlog is clear. Add the next piece of work when you’re ready."}</div> : visibleItems.map((item) => <BacklogRow key={item.id} item={item} sprints={sprints} activeMenuId={activeMenuId} setActiveMenuId={setActiveMenuId} onOpen={() => setSelected(item)} onUpdate={mutate} onDelete={remove} onRefresh={load} draggable={canReorder} onDragStart={() => setDraggedId(item.id)} onDrop={() => void reorder(item.id)} />)}</div>
    {!canReorder && <p className="text-xs text-muted-foreground">Clear search and filters to reorder the complete backlog.</p>}
    {selected && <WorkItemDrawer item={selected} members={members} epics={epics} api={api} statuses={availableStatuses} onClose={() => setSelected(undefined)} onDelete={remove} onSaved={(result) => { updateLocal(result); setToast("Changes saved successfully"); void load(); }} />}
    {deletingEpic && (
      <EpicDeleteModal
        epic={deletingEpic}
        onConfirm={() => void executeDeleteEpic(deletingEpic)}
        onCancel={() => setDeletingEpic(null)}
        deleting={isDeletingEpic}
      />
    )}
  </div>;
}

function useDropdownMenu(menuId: string, activeMenuId: string | null, setActiveMenuId: (id: string | null) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const isOpen = activeMenuId === menuId;

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(isOpen ? null : menuId);
  }, [isOpen, menuId, setActiveMenuId]);

  const close = useCallback(() => {
    setActiveMenuId(null);
  }, [setActiveMenuId]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return { ref, isOpen, toggle, close };
}

function EpicActionMenu({ epic, activeMenuId, setActiveMenuId, onEdit, onDelete }: { epic: WorkItem; activeMenuId: string | null; setActiveMenuId: (id: string | null) => void; onEdit: () => void; onDelete: () => void }) {
  const { ref, isOpen, toggle, close } = useDropdownMenu(`epic-${epic.id}`, activeMenuId, setActiveMenuId);
  const stop = (event: React.MouseEvent) => event.stopPropagation();
  return (
    <div className="relative" ref={ref} onClick={stop}>
      <button
        onClick={toggle}
        className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
        aria-label={`Actions for Epic ${epic.title}`}
      >
        <Ellipsis className="h-3.5 w-3.5" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-md border bg-white py-1 shadow-lg text-slate-700">
          <button className="menu-item" onClick={() => { close(); onEdit(); }}>
            <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit
          </button>
          <button className="menu-item text-red-600" onClick={() => { close(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EpicDeleteModal({
  epic,
  onConfirm,
  onCancel,
  deleting
}: {
  epic: WorkItem;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  const childCount = epic._count?.children ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2 font-semibold text-lg text-slate-900">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h3>Delete Epic</h3>
          </div>
          <button onClick={onCancel} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            Are you sure you want to delete <span className="font-bold text-slate-900">“{epic.title}”</span>?
          </p>
          {childCount > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="font-semibold">This Epic contains {childCount} work item{childCount === 1 ? "" : "s"}.</p>
              <p className="mt-1 text-xs text-amber-800">
                Choose what you would like to do.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <button
            disabled={deleting}
            onClick={onConfirm}
            className="w-full rounded-md bg-red-600 px-4 py-2.5 text-left text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <div className="font-bold">Option 1 (Recommended)</div>
            <div className="text-xs text-red-100 mt-0.5">
              Remove the Epic. Keep all child work items. Set their Epic relationship to null.
            </div>
          </button>

          <button
            disabled={deleting}
            onClick={onCancel}
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="font-bold">Option 2</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Cancel. Do not delete child work items.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: WorkItem["type"] }) {
  const Icon = type === "FEATURE" ? Zap : type === "BUG" ? Bug : type === "STORY" ? BookOpen : type === "EPIC" ? Mountain : CheckCircle2;
  return <Icon className={`h-4 w-4 shrink-0 ${typeColor(type)}`} aria-hidden="true" />;
}

function BacklogRow({ item, sprints, activeMenuId, setActiveMenuId, onOpen, onUpdate, onDelete, onRefresh, draggable, onDragStart, onDrop }: { item: WorkItem; sprints: Sprint[]; activeMenuId: string | null; setActiveMenuId: (id: string | null) => void; onOpen: () => void; onUpdate: (item: WorkItem, path: string, body: object, optimistic?: Partial<WorkItem>) => Promise<void>; onDelete: (item: WorkItem) => Promise<void>; onRefresh: () => Promise<void>; draggable: boolean; onDragStart: () => void; onDrop: () => void }) {
  const { ref, isOpen, toggle, close } = useDropdownMenu(item.id, activeMenuId, setActiveMenuId);
  const [sprintMenu, setSprintMenu] = useState(false); const stop = (event: React.MouseEvent) => event.stopPropagation();
  return <article onClick={onOpen} draggable={draggable} onDragStart={onDragStart} onDragOver={(event) => { if (draggable) event.preventDefault(); }} onDrop={onDrop} className={`relative grid cursor-pointer gap-2 border-b px-2 py-0.5 last:border-0 hover:bg-slate-50 md:grid-cols-[minmax(260px,1fr)_130px_108px_70px_120px_32px] md:items-center md:gap-3 first:rounded-t-lg last:rounded-b-lg ${isOpen ? "z-50" : "z-10"}`}>
    <div className="flex min-w-0 items-center gap-2"><GripVertical className={`h-4 w-4 shrink-0 text-slate-400 ${draggable ? "cursor-grab" : "opacity-30"}`} /><span title={label(item.type)}><TypeIcon type={item.type} /></span>{item.key && <span className="shrink-0 font-mono text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors" title={`Key: ${item.key}`}>{item.key}</span>}<span className={`truncate text-sm font-medium ${item.status === "DONE" ? "line-through text-slate-400 opacity-80" : ""}`}>{item.title}</span><Priority priority={item.priority} /></div>
    <div className="flex min-w-0 items-center">{item.parentEpic ? <span className={`inline-flex items-center gap-1.5 truncate text-xs font-medium px-2 py-0.5 rounded border max-w-full ${getEpicColor(item.parentEpic).bg} ${getEpicColor(item.parentEpic).text} ${getEpicColor(item.parentEpic).border}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getEpicColor(item.parentEpic).dot}`} /><span className="truncate">{item.parentEpic.title}</span></span> : <span className="text-xs text-muted-foreground">—</span>}</div><StatusChip status={item.status} /><span className="text-sm tabular-nums text-muted-foreground">{item.estimate ?? "—"}</span><Avatar user={item.assignee} />
    <div className="relative" ref={ref} onClick={stop}><button onClick={toggle} className="grid h-7 w-7 place-items-center rounded hover:bg-muted" aria-label={`Actions for ${item.title}`}><Ellipsis className="h-4 w-4" /></button>{isOpen && <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-white py-1 shadow-lg"><button className="menu-item" onClick={() => { close(); onOpen(); }}><Pencil />Edit</button><div className="relative"><button className="menu-item" onClick={() => setSprintMenu((open) => !open)}>Move to Sprint <ChevronDown className="ml-auto" /></button>{sprintMenu && <div className="absolute right-full top-0 z-50 max-h-52 w-48 overflow-y-auto rounded-md border bg-white py-1 shadow-lg">{sprints.length ? sprints.map((sprint) => <button key={sprint.id} className="menu-item" onClick={() => { setSprintMenu(false); close(); void onUpdate(item, "/sprint", { sprintId: sprint.id }).then(onRefresh); }}>{sprint.name}</button>) : <p className="px-3 py-2 text-xs text-muted-foreground">No sprints available</p>}</div>}</div><button className="menu-item" onClick={() => { close(); void onUpdate(item, "/position", { position: "TOP" }).then(onRefresh); }}>Move to Top</button><button className="menu-item" onClick={() => { close(); void onUpdate(item, "/position", { position: "BOTTOM" }).then(onRefresh); }}>Move to Bottom</button><button className="menu-item text-red-600" onClick={() => { close(); void onDelete(item); }}><Trash2 />Delete</button></div>}</div>
  </article>;
}

export function WorkItemDrawer({ item, members, epics, api, statuses, onClose, onDelete, onSaved }: { item: WorkItem; members: Member[]; epics: WorkItem[]; api: ApiClient; statuses?: string[]; onClose: () => void; onDelete: (item: WorkItem) => void; onSaved: (item: WorkItem) => void }) {
  const [draft, setDraft] = useState(draftFor(item)); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => setDraft(draftFor(item)), [item]);
  const statusOptions = useMemo(() => {
    const opts = new Set(statuses && statuses.length > 0 ? statuses : ["To Do", "In Progress", "Done"]);
    if (draft.status) opts.add(draft.status);
    return Array.from(opts);
  }, [statuses, draft.status]);
  const save = async () => { setSaving(true); setError(""); try { const result = await api.request<WorkItem>(`/work-items/${item.id}`, { method: "PATCH", body: JSON.stringify({ ...draft, estimate: draft.estimate ? Number(draft.estimate) : null, assigneeId: draft.assigneeId || null, parentEpicId: draft.parentEpicId || null, description: draft.description || null }) }); onSaved(result); onClose(); } catch (err) { setError(message(err, "Could not save work item")); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-40 bg-slate-900/20" onMouseDown={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2">{item.key && <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{item.key}</span>}<span className="text-sm font-semibold text-muted-foreground">{label(item.type)}</span></div><p className="mt-1 text-xs text-muted-foreground">Created {date(item.createdAt)} · Updated {date(item.updatedAt)}</p></div><button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close"><X className="h-5 w-5" /></button></div><Input className={`mb-5 h-auto border-0 px-0 text-xl font-semibold shadow-none focus-visible:ring-0 ${draft.status?.toLowerCase().includes("done") ? "line-through text-slate-400" : ""}`} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><Field label="Description"><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add context, decisions, or acceptance criteria…" className="min-h-36 w-full rounded-md border p-3 text-sm outline-none focus:ring-2 focus:ring-teal-600" /></Field><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Status"><Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{statusOptions.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select></Field><Field label="Priority"><Select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as WorkItem["priority"] })}>{priorities.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select></Field><Field label="Story points"><Select value={draft.estimate} onChange={(event) => setDraft({ ...draft, estimate: event.target.value })}><option value="">None</option>{points.map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field><Field label="Assignee"><Select value={draft.assigneeId} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}><option value="">Unassigned</option>{members.map(({ user }) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></Field><Field label="Epic"><Select value={draft.parentEpicId} onChange={(event) => setDraft({ ...draft, parentEpicId: event.target.value })}><option value="">No epic</option>{epics.filter((epic) => epic.id !== item.id).map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}</Select>{draft.parentEpicId && (() => { const selectedEpic = epics.find((e) => e.id === draft.parentEpicId); if (!selectedEpic) return null; const theme = getEpicColor(selectedEpic); return <div className="mt-1.5 flex items-center gap-1.5"><span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${theme.bg} ${theme.text} ${theme.border}`}><span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />{selectedEpic.title}</span></div>; })()}</Field></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="sticky bottom-0 mt-6 flex items-center justify-between border-t bg-white pt-3"><Button className="border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4" />Delete</Button><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving || !draft.title.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button></div></div></aside></div>;
}

function QuickCreate({ api, workspaceId, onCreated }: { api: ApiClient; workspaceId: string; onCreated: () => Promise<void> }) { const [title, setTitle] = useState(""); const [type, setType] = useState<WorkItem["type"]>("TASK"); const [open, setOpen] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim()) return; await api.request("/work-items", { method: "POST", body: JSON.stringify({ title: title.trim(), workspaceId, type }) }); setTitle(""); setType("TASK"); setOpen(false); await onCreated(); }; return <form className="flex gap-2" onSubmit={(event) => void submit(event)}>{open && <><Select aria-label="Type" value={type} onChange={(event) => setType(event.target.value as WorkItem["type"])} className="w-32">{["TASK", "FEATURE", "BUG", "STORY", "EPIC"].map(t => <option key={t} value={t}>{label(t)}</option>)}</Select><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" /></>}{open ? <><Button type="submit"><Check className="h-4 w-4" />Add</Button><Button type="button" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></> : <Button type="button" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add work item</Button>}</form>; }
function Filter({ value, label: placeholder, onChange, children }: { value: string; label: string; onChange: (value: string) => void; children: React.ReactNode }) { return <Select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="w-44"><option value="">{placeholder}</option>{children}</Select>; }
function StatusChip({ status }: { status: string }) {
  const cleanStatus = status || "Backlog";
  const lower = cleanStatus.toLowerCase();

  let bg = "bg-slate-100 text-slate-700 border-slate-200";
  let dot = "bg-slate-400";

  if (lower.includes("done") || lower.includes("completed")) {
    bg = "bg-green-50 text-green-700 border-green-200";
    dot = "bg-green-600";
  } else if (lower.includes("progress")) {
    bg = "bg-amber-50 text-amber-700 border-amber-200";
    dot = "bg-amber-500";
  } else if (lower.includes("test")) {
    bg = "bg-purple-50 text-purple-700 border-purple-200";
    dot = "bg-purple-500";
  } else if (lower.includes("review")) {
    bg = "bg-indigo-50 text-indigo-700 border-indigo-200";
    dot = "bg-indigo-500";
  } else if (lower.includes("todo") || lower.includes("to do")) {
    bg = "bg-blue-50 text-blue-700 border-blue-200";
    dot = "bg-blue-500";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label(cleanStatus)}
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
