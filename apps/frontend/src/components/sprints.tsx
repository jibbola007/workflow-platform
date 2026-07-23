"use client";

import {
  BookOpen,
  Bug,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  Ellipsis,
  GripVertical,
  Lock,
  Mountain,
  Pencil,
  Play,
  Plus,
  Trash2,
  UserPlus,
  X,
  Zap
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient, Board, BoardColumn, Sprint, User, WorkItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WorkItemDrawer, getEpicColor } from "@/components/backlog";

type Member = { id: string; role: string; user: User };

export function Sprints({
  api,
  workspaceId,
  members
}: {
  api: ApiClient;
  workspaceId: string;
  members: Member[];
}) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [activeSprintId, setActiveSprintId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalSprint, setEditModalSprint] = useState<Sprint | null>(null);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError("");
    try {
      const [fetchedSprints, fetchedEpics] = await Promise.all([
        api.request<Sprint[]>(`/sprints?workspaceId=${workspaceId}`),
        api.request<WorkItem[]>(`/work-items?workspaceId=${workspaceId}&type=EPIC`)
      ]);
      setSprints(fetchedSprints);
      setEpics(fetchedEpics);

      if (!activeSprintId && fetchedSprints.length > 0) {
        const active = fetchedSprints.find((s) => s.status === "ACTIVE") ?? fetchedSprints[0];
        setActiveSprintId(active.id);
      }
    } catch (err) {
      setError("Failed to load sprint workspace");
    } finally {
      setLoading(false);
    }
  }, [api, workspaceId, activeSprintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSprint = useMemo(
    () => sprints.find((s) => s.id === activeSprintId) ?? null,
    [sprints, activeSprintId]
  );

  const availableStatuses = useMemo(
    () => activeSprint?.board?.columns?.map((c) => c.name) ?? ["To Do", "In Progress", "Done"],
    [activeSprint]
  );

  const completedSprints = useMemo(
    () => sprints.filter((s) => s.status === "COMPLETED"),
    [sprints]
  );

  const activeOrPlannedSprints = useMemo(
    () => sprints.filter((s) => s.status !== "COMPLETED"),
    [sprints]
  );

  const handleStartSprint = async (sprint: Sprint) => {
    try {
      await api.request<Sprint>(`/sprints/${sprint.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" })
      });
      setActiveSprintId(sprint.id);
      setToast(`Sprint “${sprint.name}” is now Active!`);
      await load();
    } catch (err) {
      setError("Could not start sprint");
    }
  };

  const handleCompleteSprint = async (sprint: Sprint) => {
    try {
      await api.request<Sprint>(`/sprints/${sprint.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" })
      });
      setToast(`Sprint “${sprint.name}” completed and archived!`);
      const remainingActive = sprints.find((s) => s.id !== sprint.id && s.status === "ACTIVE");
      setActiveSprintId(remainingActive ? remainingActive.id : null);
      await load();
    } catch (err) {
      setError("Could not complete sprint");
    }
  };

  const handleToggleAssignee = (id: string) => {
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearAssignees = () => {
    setSelectedAssigneeIds(new Set());
  };

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-hidden space-y-3">
      {/* Top Fixed Area (Header, Sprint Details, Assignee Filter Bar) */}
      <div className="shrink-0 space-y-3">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sprint Board</h1>
            <p className="text-xs text-slate-500">
              Manage your team's active sprint, customize columns, and review archived sprints.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4" /> Create Sprint
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl">
            <span>{toast}</span>
            <button onClick={() => setToast("")} className="hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Sprint Selector Tabs (Active / Planned Sprints) */}
        {activeOrPlannedSprints.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {activeOrPlannedSprints.map((sprint) => {
              const isSelected = sprint.id === activeSprintId;
              return (
                <button
                  key={sprint.id}
                  onClick={() => setActiveSprintId(sprint.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "border-teal-600 bg-teal-50/70 text-teal-900 shadow-sm ring-1 ring-teal-600"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{sprint.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      sprint.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {sprint.status}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {activeSprint && (
          <SprintHeader
            sprint={activeSprint}
            onEdit={() => setEditModalSprint(activeSprint)}
            onStart={() => void handleStartSprint(activeSprint)}
            onComplete={() => void handleCompleteSprint(activeSprint)}
          />
        )}

        {/* Assignee Filter Bar */}
        {members.length > 0 && (
          <AssigneeFilterBar
            members={members}
            selectedAssigneeIds={selectedAssigneeIds}
            onToggleAssignee={handleToggleAssignee}
            onClear={handleClearAssignees}
          />
        )}
      </div>

      {/* Main Board Workspace (Scrolls horizontally, columns scroll vertically) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <div className="h-full animate-pulse rounded-lg bg-slate-100" />
        ) : activeSprint ? (
          <SprintBoardWorkspace
            sprint={activeSprint}
            members={members}
            epics={epics}
            api={api}
            selectedAssigneeIds={selectedAssigneeIds}
            onRefresh={load}
            onOpenItem={setSelectedWorkItem}
          />
        ) : (
          <Card className="p-8 text-center my-auto">
            <Clock className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-2 text-base font-semibold text-slate-800">No Sprint Selected</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a new sprint or select one above to start planning.
            </p>
            <Button className="mt-4" onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4" /> Create Sprint
            </Button>
          </Card>
        )}
      </div>

      {/* Completed Sprints Footer (Sprint Bank / Archive) */}
      <div className="shrink-0 pt-1">
        <SprintBank
          sprints={completedSprints}
          onSelectSprint={(sprint) => setActiveSprintId(sprint.id)}
        />
      </div>

      {/* Create Sprint Modal */}
      {createModalOpen && (
        <SprintModal
          title="Create Sprint"
          api={api}
          workspaceId={workspaceId}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={async (newSprint) => {
            setCreateModalOpen(false);
            setActiveSprintId(newSprint.id);
            setToast(`Sprint “${newSprint.name}” created!`);
            await load();
          }}
        />
      )}

      {/* Edit Sprint Modal */}
      {editModalSprint && (
        <SprintModal
          title="Edit Sprint"
          sprint={editModalSprint}
          api={api}
          workspaceId={workspaceId}
          onClose={() => setEditModalSprint(null)}
          onSuccess={async () => {
            setEditModalSprint(null);
            setToast("Sprint updated successfully!");
            await load();
          }}
        />
      )}

      {/* Work Item Details Drawer */}
      {selectedWorkItem && (
        <WorkItemDrawer
          item={selectedWorkItem}
          members={members}
          epics={epics}
          api={api}
          statuses={availableStatuses}
          onClose={() => setSelectedWorkItem(null)}
          onDelete={async (item) => {
            try {
              await api.request(`/work-items/${item.id}`, { method: "DELETE" });
              setSelectedWorkItem(null);
              await load();
            } catch (err) {
              alert("Failed to delete work item");
            }
          }}
          onSaved={async () => {
            setSelectedWorkItem(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SprintHeader({
  sprint,
  onEdit,
  onStart,
  onComplete
}: {
  sprint: Sprint;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  const isReadOnly = sprint.status === "COMPLETED";

  return (
    <Card className="p-3 px-4 bg-white shadow-sm border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">{sprint.name}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                sprint.status === "ACTIVE"
                  ? "bg-green-100 text-green-800"
                  : sprint.status === "COMPLETED"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {sprint.status}
            </span>
          </div>

          {sprint.goal && (
            <p className="text-xs font-medium text-slate-600">
              <span className="font-semibold text-slate-800">Goal:</span> {sprint.goal}
            </p>
          )}

          <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              {new Date(sprint.startDate).toLocaleDateString()} –{" "}
              {new Date(sprint.endDate).toLocaleDateString()}
            </span>
            {sprint.completedAt && (
              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <CheckCircle className="h-3 w-3 text-green-600" /> Completed on{" "}
                {new Date(sprint.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={onEdit}>
                <Edit3 className="h-4 w-4" /> Edit Sprint
              </Button>
              {sprint.status === "PLANNED" && (
                <Button onClick={onStart} className="bg-green-600 hover:bg-green-700 text-white">
                  <Play className="h-4 w-4 fill-current" /> Start Sprint
                </Button>
              )}
              {sprint.status === "ACTIVE" && (
                <Button onClick={onComplete} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <CheckCircle className="h-4 w-4" /> Complete Sprint
                </Button>
              )}
            </>
          )}
          {isReadOnly && (
            <span className="flex items-center gap-1 rounded bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
              <Lock className="h-3.5 w-3.5" /> Read-Only Archive
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function SprintBoardWorkspace({
  sprint,
  members,
  epics,
  api,
  selectedAssigneeIds,
  onRefresh,
  onOpenItem
}: {
  sprint: Sprint;
  members: Member[];
  epics: WorkItem[];
  api: ApiClient;
  selectedAssigneeIds: Set<string>;
  onRefresh: () => Promise<void>;
  onOpenItem: (item: WorkItem) => void;
}) {
  const board = sprint.board;
  const isReadOnly = sprint.status === "COMPLETED";

  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  if (!board) {
    return <div className="p-4 text-center text-slate-500">Board initializing…</div>;
  }

  const handleAddColumn = async (e: FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    try {
      await api.request(`/boards/${board.id}/columns`, {
        method: "POST",
        body: JSON.stringify({ name: newColumnName.trim() })
      });
      setNewColumnName("");
      setAddingColumn(false);
      await onRefresh();
    } catch (err) {
      alert("Failed to add column");
    }
  };

  const handleRenameColumn = async (columnId: string, name: string) => {
    try {
      await api.request(`/boards/${board.id}/columns/${columnId}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      await onRefresh();
    } catch (err) {
      alert("Failed to rename column");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm("Delete column? Work items will be unassigned from this column.")) return;
    try {
      await api.request(`/boards/${board.id}/columns/${columnId}`, {
        method: "DELETE"
      });
      await onRefresh();
    } catch (err) {
      alert("Failed to delete column");
    }
  };

  const handleMoveCard = async (workItemId: string, targetColumnId: string) => {
    try {
      await api.request(`/boards/${board.id}/move-card`, {
        method: "POST",
        body: JSON.stringify({ workItemId, columnId: targetColumnId })
      });
      await onRefresh();
    } catch (err) {
      alert("Failed to move card");
    }
  };

  const handleReorderColumns = async (draggedColId: string, targetColId: string) => {
    if (draggedColId === targetColId) return;
    const colIds = board.columns.map((c) => c.id);
    const dragIdx = colIds.indexOf(draggedColId);
    const targetIdx = colIds.indexOf(targetColId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const newColIds = [...colIds];
    newColIds.splice(dragIdx, 1);
    newColIds.splice(targetIdx, 0, draggedColId);

    try {
      await api.request(`/boards/${board.id}/reorder-columns`, {
        method: "PATCH",
        body: JSON.stringify({ columnIds: newColIds })
      });
      await onRefresh();
    } catch (err) {
      alert("Failed to reorder columns");
    }
  };

  const handleReassignUser = async (item: WorkItem, newAssigneeId: string) => {
    try {
      await api.request(`/work-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: newAssigneeId || null })
      });
      await onRefresh();
    } catch (err) {
      alert("Failed to reassign work item");
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
      {/* Board Column Bar */}
      <div className="flex-1 min-h-0 flex items-start gap-4 overflow-x-auto pb-2 pt-1">
        {board.columns.map((column) => (
          <BoardColumnContainer
            key={column.id}
            column={column}
            columns={board.columns}
            isReadOnly={isReadOnly}
            members={members}
            sprintId={sprint.id}
            workspaceId={sprint.workspaceId}
            api={api}
            selectedAssigneeIds={selectedAssigneeIds}
            onRename={(name) => void handleRenameColumn(column.id, name)}
            onDelete={() => void handleDeleteColumn(column.id)}
            onMoveCard={(itemId, colId) => void handleMoveCard(itemId, colId)}
            onReorderColumns={(draggedColId, targetColId) => void handleReorderColumns(draggedColId, targetColId)}
            onReassign={(item, assigneeId) => void handleReassignUser(item, assigneeId)}
            onRefresh={onRefresh}
            onOpenItem={onOpenItem}
          />
        ))}

        {/* Add Column Button / Form */}
        {!isReadOnly && (
          <div className="w-72 shrink-0">
            {addingColumn ? (
              <form onSubmit={(e) => void handleAddColumn(e)} className="rounded-lg border bg-white p-3 shadow-sm space-y-3">
                <Input
                  autoFocus
                  placeholder="Column name (e.g. In Review)"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" className="h-8 px-3 text-xs">
                    Add Column
                  </Button>
                  <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setAddingColumn(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Column
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardColumnContainer({
  column,
  columns,
  isReadOnly,
  members,
  sprintId,
  workspaceId,
  api,
  selectedAssigneeIds,
  onRename,
  onDelete,
  onMoveCard,
  onReorderColumns,
  onReassign,
  onRefresh,
  onOpenItem
}: {
  column: BoardColumn;
  columns: BoardColumn[];
  isReadOnly: boolean;
  members: Member[];
  sprintId: string;
  workspaceId: string;
  api: ApiClient;
  selectedAssigneeIds: Set<string>;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMoveCard: (itemId: string, colId: string) => void;
  onReorderColumns: (draggedColId: string, targetColId: string) => void;
  onReassign: (item: WorkItem, assigneeId: string) => void;
  onRefresh: () => Promise<void>;
  onOpenItem: (item: WorkItem) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(column.name);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardType, setNewCardType] = useState<WorkItem["type"]>("TASK");

  const displayItems = useMemo(() => {
    if (selectedAssigneeIds.size === 0) return column.workItems;
    return column.workItems.filter((item) => {
      if (selectedAssigneeIds.has("UNASSIGNED") && !item.assignee) return true;
      return item.assignee && selectedAssigneeIds.has(item.assignee.id);
    });
  }, [column.workItems, selectedAssigneeIds]);

  const submitTitle = () => {
    if (title.trim() && title !== column.name) {
      onRename(title.trim());
    }
    setEditingTitle(false);
  };

  const createCardInColumn = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    try {
      await api.request("/work-items", {
        method: "POST",
        body: JSON.stringify({
          title: newCardTitle.trim(),
          workspaceId,
          sprintId,
          columnId: column.id,
          type: newCardType,
          status: column.name
        })
      });
      setNewCardTitle("");
      setAddingCard(false);
      await onRefresh();
    } catch (err) {
      alert("Failed to create work item in column");
    }
  };

  return (
    <div
      draggable={!isReadOnly}
      onDragStart={(e) => {
        e.dataTransfer.setData("type", "column");
        e.dataTransfer.setData("columnId", column.id);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("type");
        if (type === "column") {
          const draggedColId = e.dataTransfer.getData("columnId");
          if (draggedColId) onReorderColumns(draggedColId, column.id);
        } else {
          const itemId = e.dataTransfer.getData("text/plain");
          if (itemId) onMoveCard(itemId, column.id);
        }
      }}
      className="flex w-80 shrink-0 flex-col h-full max-h-full rounded-lg border border-slate-200 bg-slate-100/70 p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Column Header */}
      <div className="shrink-0 mb-3 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm min-w-0">
          {!isReadOnly && (
            <span title="Drag to reorder column">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-400 cursor-grab hover:text-slate-600" />
            </span>
          )}
          {editingTitle && !isReadOnly ? (
            <Input
              autoFocus
              className="h-7 text-xs font-bold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={submitTitle}
              onKeyDown={(e) => e.key === "Enter" && submitTitle()}
            />
          ) : (
            <span
              onClick={() => !isReadOnly && setEditingTitle(true)}
              className="cursor-pointer truncate hover:text-teal-700"
              title="Click to rename"
            >
              {column.name}
            </span>
          )}
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {displayItems.length}
          </span>
        </div>

        {!isReadOnly && (
          <button
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 transition-colors"
            title="Delete column"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Cards Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
        {displayItems.map((item) => (
          <SprintCard
            key={item.id}
            item={item}
            columns={columns}
            isReadOnly={isReadOnly}
            members={members}
            onMoveCard={(targetColId) => onMoveCard(item.id, targetColId)}
            onReassign={(assigneeId) => onReassign(item, assigneeId)}
            onOpen={() => onOpenItem(item)}
          />
        ))}

        {column.workItems.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
            No work items
          </div>
        )}
      </div>

      {/* Add Work Item Button / Quick Form */}
      {!isReadOnly && (
        <div className="shrink-0 mt-3 border-t border-slate-200 pt-2">
          {addingCard ? (
            <form onSubmit={(e) => void createCardInColumn(e)} className="space-y-2 bg-white p-2.5 rounded-md border shadow-sm">
              <div className="flex gap-2">
                <Select
                  value={newCardType}
                  onChange={(e) => setNewCardType(e.target.value as WorkItem["type"])}
                  className="w-28 h-8 text-xs"
                >
                  <option value="TASK">Task</option>
                  <option value="FEATURE">Feature</option>
                  <option value="BUG">Bug</option>
                  <option value="STORY">Story</option>
                </Select>
                <Input
                  autoFocus
                  className="h-8 text-xs"
                  placeholder="What needs doing?"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" className="h-7 text-xs px-2.5">
                  Add Card
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setAddingCard(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingCard(true)}
              className="flex w-full items-center gap-1.5 rounded-md p-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Work Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SprintCard({
  item,
  columns,
  isReadOnly,
  members,
  onMoveCard,
  onReassign,
  onOpen
}: {
  item: WorkItem;
  columns: BoardColumn[];
  isReadOnly: boolean;
  members: Member[];
  onMoveCard: (columnId: string) => void;
  onReassign: (assigneeId: string) => void;
  onOpen: () => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const reassignRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reassignOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (reassignRef.current && !reassignRef.current.contains(e.target as Node)) {
        setReassignOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [reassignOpen]);

  const Icon =
    item.type === "FEATURE"
      ? Zap
      : item.type === "BUG"
      ? Bug
      : item.type === "STORY"
      ? BookOpen
      : item.type === "EPIC"
      ? Mountain
      : CheckCircle2;

  const epicTheme = getEpicColor(item.parentEpic);

  return (
    <div
      onClick={onOpen}
      draggable={!isReadOnly}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("type", "card");
        e.dataTransfer.setData("text/plain", item.id);
      }}
      className="group relative cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all space-y-1.5"
    >
      {/* Top Row: Key + Type + Epic */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          {item.key && (
            <span className="font-mono text-[11px] font-bold text-slate-500">
              {item.key}
            </span>
          )}
        </div>

        {item.parentEpic && (
          <span
            className={`truncate max-w-28 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${epicTheme.bg} ${epicTheme.text} ${epicTheme.border}`}
          >
            {item.parentEpic.title}
          </span>
        )}
      </div>

      {/* Card Title */}
      <p
        onClick={onOpen}
        className={`text-xs font-semibold text-slate-800 line-clamp-2 hover:text-teal-700 transition-colors ${
          item.status === "DONE" ? "line-through text-slate-400" : ""
        }`}
      >
        {item.title}
      </p>

      {/* Bottom Row: Story Points, Priority, Quick Assignee Popover */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {item.estimate !== undefined && item.estimate !== null && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {item.estimate} pt
            </span>
          )}
          <span
            className={`h-2 w-2 rounded-full ${
              item.priority === "URGENT"
                ? "bg-red-600"
                : item.priority === "HIGH"
                ? "bg-orange-500"
                : item.priority === "MEDIUM"
                ? "bg-blue-500"
                : "bg-slate-400"
            }`}
            title={`Priority: ${item.priority}`}
          />
        </div>

        {/* Quick Assignee Selector */}
        <div className="relative" ref={reassignRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isReadOnly) setReassignOpen((open) => !open);
            }}
            className="flex items-center gap-1 rounded-full p-0.5 hover:ring-2 hover:ring-teal-500 transition-all"
            title={item.assignee ? `Assigned to ${item.assignee.name}` : "Unassigned - Click to assign"}
          >
            {item.assignee ? (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-800">
                {item.assignee.name.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 hover:bg-slate-200">
                <UserPlus className="h-3 w-3" />
              </span>
            )}
          </button>

          {/* Quick Assign Popover */}
          {reassignOpen && (
            <div className="absolute right-0 bottom-full mb-1 z-50 w-48 rounded-md border bg-white py-1 shadow-xl text-xs space-y-0.5">
              <p className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase">
                Reassign Work Item
              </p>
              <button
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-600 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onReassign("");
                  setReassignOpen(false);
                }}
              >
                Unassigned
              </button>
              {members.map(({ user }) => (
                <button
                  key={user.id}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between ${
                    item.assignee?.id === user.id ? "font-bold text-teal-700 bg-teal-50/50" : "text-slate-700"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReassign(user.id);
                    setReassignOpen(false);
                  }}
                >
                  <span>{user.name}</span>
                  {item.assignee?.id === user.id && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SprintModal({
  title,
  sprint,
  api,
  workspaceId,
  onClose,
  onSuccess
}: {
  title: string;
  sprint?: Sprint;
  api: ApiClient;
  workspaceId: string;
  onClose: () => void;
  onSuccess: (sprint: Sprint) => void;
}) {
  const isEdit = Boolean(sprint);

  const defaultStart = sprint
    ? new Date(sprint.startDate).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);

  const defaultEnd = sprint
    ? new Date(sprint.endDate).toISOString().slice(0, 16)
    : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16);

  const [name, setName] = useState(sprint?.name ?? "Sprint 1");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        goal: goal.trim() || undefined,
        workspaceId
      };

      let result: Sprint;
      if (isEdit && sprint) {
        result = await api.request<Sprint>(`/sprints/${sprint.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        result = await api.request<Sprint>("/sprints", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      onSuccess(result);
    } catch (err) {
      setError("Failed to save sprint details");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-4 text-sm">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Sprint Name <span className="text-red-500">*</span>
            </label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 1 - Core Auth"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Start Date & Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                End Date & Time <span className="text-red-500">*</span>
              </label>
              <Input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Sprint Goal <span className="text-xs font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              className="w-full rounded-md border p-2.5 text-xs outline-none focus:ring-2 focus:ring-teal-600 min-h-20"
              placeholder="What does the team want to achieve during this sprint?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Sprint"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SprintBank({
  sprints,
  onSelectSprint
}: {
  sprints: Sprint[];
  onSelectSprint: (sprint: Sprint) => void;
}) {
  const [open, setOpen] = useState(false);

  if (sprints.length === 0) return null;

  return (
    <Card className="p-4 bg-slate-50/70 border-slate-200 space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between font-bold text-slate-800 text-sm hover:text-slate-900"
      >
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-purple-600" />
          <span>Sprint Bank ({sprints.length} Completed Sprints)</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-3 pt-2">
          {sprints.map((sprint) => {
            const completedCount = sprint.workItems.filter((i) => i.status === "DONE").length;
            const incompleteCount = sprint.workItems.length - completedCount;

            return (
              <div
                key={sprint.id}
                onClick={() => onSelectSprint(sprint)}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{sprint.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      COMPLETED
                    </span>
                  </div>
                  {sprint.goal && (
                    <p className="text-xs text-slate-500 italic">Goal: {sprint.goal}</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {new Date(sprint.startDate).toLocaleDateString()} –{" "}
                    {new Date(sprint.endDate).toLocaleDateString()}
                    {sprint.completedAt && (
                      <span className="ml-2 font-medium text-slate-600">
                        (Completed {new Date(sprint.completedAt).toLocaleDateString()})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right">
                    <span className="font-bold text-green-700">{completedCount} completed</span>
                    <span className="text-slate-400 font-normal"> / </span>
                    <span className="font-bold text-slate-600">{incompleteCount} incomplete</span>
                  </div>
                  <Button variant="outline" className="h-7 text-xs px-2.5">
                    Inspect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AssigneeFilterBar({
  members,
  selectedAssigneeIds,
  onToggleAssignee,
  onClear
}: {
  members: Member[];
  selectedAssigneeIds: Set<string>;
  onToggleAssignee: (id: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.user.name.toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const activeCount = selectedAssigneeIds.size;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2 text-xs shadow-sm">
      <span className="font-semibold text-slate-500 mr-1">Assignees:</span>

      {/* "All" option */}
      <button
        onClick={onClear}
        className={`rounded-full px-3 py-1 font-semibold transition-all ${
          activeCount === 0
            ? "bg-slate-900 text-white shadow-sm"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        All
      </button>

      {/* Member Avatars */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {filteredMembers.map(({ user }) => {
          const isSelected = selectedAssigneeIds.has(user.id);
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <button
              key={user.id}
              onClick={() => onToggleAssignee(user.id)}
              title={`${user.name} (${user.email})`}
              className={`relative grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-all ${
                isSelected
                  ? "bg-teal-600 text-white ring-2 ring-teal-600 ring-offset-1 shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {initials}
            </button>
          );
        })}

        {/* Unassigned button */}
        <button
          onClick={() => onToggleAssignee("UNASSIGNED")}
          title="Unassigned work items"
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
            selectedAssigneeIds.has("UNASSIGNED")
              ? "bg-teal-600 text-white ring-2 ring-teal-600 ring-offset-1"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Unassigned
        </button>
      </div>

      {/* Search if more than 4 members */}
      {members.length > 4 && (
        <div className="ml-auto w-36">
          <Input
            placeholder="Search assignee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      )}

      {activeCount > 0 && (
        <button
          onClick={onClear}
          className="ml-1 text-[11px] text-slate-400 hover:text-slate-600 underline"
        >
          Clear ({activeCount})
        </button>
      )}
    </div>
  );
}

function DeleteWorkItemModal({
  item,
  deleting,
  onConfirm,
  onCancel
}: {
  item: WorkItem;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl space-y-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2 font-semibold text-lg text-slate-900">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h3>Delete Work Item</h3>
          </div>
          <button onClick={onCancel} className="rounded p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            Are you sure you want to permanently delete this work item?
          </p>
          <p className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 p-2.5 rounded border border-slate-200">
            {item.key ? `${item.key}: ` : ""}{item.title}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
