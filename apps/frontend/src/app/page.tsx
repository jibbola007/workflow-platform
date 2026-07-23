"use client";

import {
  Archive,
  Columns3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Search,
  Settings,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Backlog } from "@/components/backlog";
import { Sprints } from "@/components/sprints";
import { ApiClient, Board, Sprint, WorkItem, Workspace } from "@/lib/api";

const nav = [
  ["Dashboard", LayoutDashboard],
  ["Backlog", Archive],
  ["Sprints", ListChecks],
  ["Boards", Columns3],
  ["Team", Users],
  ["Settings", Settings]
] as const;

type View = (typeof nav)[number][0];

export default function App() {
  const [token, setToken] = useState<string>();
  const [user, setUser] = useState<{ name: string; email: string }>();
  const [view, setView] = useState<View>("Dashboard");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [search, setSearch] = useState("");
  const api = useMemo(() => new ApiClient(token), [token]);

  useEffect(() => {
    const saved = localStorage.getItem("workflow-token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    void load();
  }, [token, workspaceId]);

  async function load() {
    const spaces = await api.request<Workspace[]>("/workspaces");
    setWorkspaces(spaces);
    const active = workspaceId || spaces[0]?.id || "";
    if (!workspaceId && active) setWorkspaceId(active);
    if (!active) return;
    const [workspace, nextItems, nextSprints, nextBoards] = await Promise.all([
      api.request<Workspace>(`/workspaces/${active}`),
      api.request<WorkItem[]>(`/work-items?workspaceId=${active}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
      api.request<Sprint[]>(`/sprints?workspaceId=${active}`),
      api.request<Board[]>(`/boards?workspaceId=${active}`)
    ]);
    setWorkspaces(spaces.map((space) => (space.id === active ? workspace : space)));
    setItems(nextItems);
    setSprints(nextSprints);
    setBoards(nextBoards);
  }

  function saveAuth(accessToken: string, nextUser: { name: string; email: string }) {
    localStorage.setItem("workflow-token", accessToken);
    setToken(accessToken);
    setUser(nextUser);
  }

  if (!token) return <AuthScreen onAuth={saveAuth} />;

  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-white px-4 py-5 h-full">
        <div className="mb-6">
          <p className="text-lg font-semibold">Simply Workflow</p>
          <p className="text-sm text-muted-foreground">{activeWorkspace?.name ?? "Create a workspace"}</p>
        </div>
        <nav className="space-y-1">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => setView(label)}
              className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm ${view === label ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <Select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} className="w-full">
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              localStorage.removeItem("workflow-token");
              setToken(undefined);
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <section className={`flex flex-1 flex-col h-full min-w-0 ${view === "Sprints" ? "p-4" : "p-6"} ${view === "Sprints" || view === "Backlog" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {view !== "Sprints" && (
          <header className="mb-4 shrink-0 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{view}</h1>
              <p className="text-sm text-muted-foreground">{user?.email ?? "Workspace planning without the clutter"}</p>
            </div>
            <WorkspaceForm api={api} onCreated={load} />
          </header>
        )}
        {view === "Dashboard" && <Dashboard items={items} sprints={sprints} boards={boards} />}
        {view === "Backlog" && <Backlog api={api} workspaceId={workspaceId} members={activeWorkspace?.members ?? []} />}
        {view === "Sprints" && <Sprints api={api} workspaceId={workspaceId} members={activeWorkspace?.members ?? []} />}
        {view === "Boards" && <Boards api={api} workspaceId={workspaceId} boards={boards} reload={load} />}
        {view === "Team" && <Team workspace={activeWorkspace} />}
        {view === "Settings" && <SettingsView workspace={activeWorkspace} />}
      </section>
    </main>
  );
}

function AuthScreen({ onAuth }: { onAuth: (token: string, user: { name: string; email: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const api = useMemo(() => new ApiClient(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.request<{ accessToken: string; user: { name: string; email: string } }>(
        mode === "login" ? "/auth/login" : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(data))
        }
      );
      onAuth(result.accessToken, result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm p-5">
        <h1 className="text-xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          {mode === "register" && <Input name="name" placeholder="Name" required />}
          <Input name="email" type="email" placeholder="Email" required />
          <Input name="password" type="password" placeholder="Password" required minLength={8} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" type="submit">
            {mode === "login" ? "Login" : "Register"}
          </Button>
        </form>
        <Button variant="ghost" className="mt-3 w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create account" : "Use existing account"}
        </Button>
      </Card>
    </main>
  );
}

function WorkspaceForm({ api, onCreated }: { api: ApiClient; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name) return;
        await api.request("/workspaces", { method: "POST", body: JSON.stringify({ name }) });
        setName("");
        await onCreated();
      }}
    >
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Workspace name" />
      <Button type="submit">
        <Plus className="h-4 w-4" />
        Workspace
      </Button>
    </form>
  );
}

function Dashboard({ items, sprints, boards }: { items: WorkItem[]; sprints: Sprint[]; boards: Board[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Metric label="Work items" value={items.length} />
      <Metric label="Active sprints" value={sprints.filter((sprint) => sprint.status === "ACTIVE").length} />
      <Metric label="Boards" value={boards.length} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </Card>
  );
}

function LegacyBacklog(props: {
  api: ApiClient;
  workspaceId: string;
  items: WorkItem[];
  search: string;
  setSearch: (value: string) => void;
  reload: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search work items" />
        </div>
        <Button variant="outline" onClick={props.reload}>Search</Button>
      </div>
      <WorkItemForm api={props.api} workspaceId={props.workspaceId} items={props.items} reload={props.reload} />
      <div className="space-y-2">
        {props.items.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.type} · {item.priority} · {item.status}</p>
            </div>
            <span className="rounded-md bg-muted px-2 py-1 text-xs">{item.parentEpic?.title ?? "No epic"}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkItemForm({ api, workspaceId, items, reload }: { api: ApiClient; workspaceId: string; items: WorkItem[]; reload: () => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await api.request("/work-items", {
      method: "POST",
      body: JSON.stringify({ ...data, workspaceId, parentEpicId: data.parentEpicId || undefined })
    });
    event.currentTarget.reset();
    await reload();
  }

  return (
    <Card className="p-3">
      <form className="grid gap-2 md:grid-cols-[1fr_140px_140px_180px_auto]" onSubmit={submit}>
        <Input name="title" placeholder="Create Work Item" required />
        <Select name="type" defaultValue="TASK">
          {["EPIC", "FEATURE", "TASK", "BUG", "STORY"].map((type) => <option key={type} value={type}>{type}</option>)}
        </Select>
        <Select name="priority" defaultValue="MEDIUM">
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </Select>
        <Select name="parentEpicId" defaultValue="">
          <option value="">No epic</option>
          {items.filter((item) => item.type === "EPIC").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </Select>
        <Button type="submit"><Plus className="h-4 w-4" />Add</Button>
      </form>
    </Card>
  );
}



function Boards({ api, workspaceId, boards, reload }: { api: ApiClient; workspaceId: string; boards: Board[]; reload: () => Promise<void> }) {
  const [draggedItemId, setDraggedItemId] = useState<string>();
  const [columnName, setColumnName] = useState("");

  async function createBoard() {
    await api.request("/boards", { method: "POST", body: JSON.stringify({ workspaceId, name: `Kanban Board ${boards.length + 1}`, type: "KANBAN" }) });
    await reload();
  }

  async function addColumn(boardId: string) {
    if (!columnName) return;
    await api.request(`/boards/${boardId}/columns`, { method: "POST", body: JSON.stringify({ name: columnName }) });
    setColumnName("");
    await reload();
  }

  async function moveCard(boardId: string, columnId: string) {
    if (!draggedItemId) return;
    await api.request(`/boards/${boardId}/move-card`, {
      method: "POST",
      body: JSON.stringify({ workItemId: draggedItemId, columnId })
    });
    setDraggedItemId(undefined);
    await reload();
  }

  return (
    <div className="space-y-4">
      <Button onClick={createBoard}><Plus className="h-4 w-4" />Kanban Board</Button>
      {boards.map((board) => (
        <section key={board.id}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{board.name}</h2>
            <div className="flex gap-2">
              <Input value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="Column name" />
              <Button variant="outline" onClick={() => addColumn(board.id)}>
                <Plus className="h-4 w-4" />
                Column
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {board.columns.map((column) => (
              <Card
                key={column.id}
                className="min-h-52 p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveCard(board.id, column.id)}
              >
                <p className="mb-3 text-sm font-medium">{column.name}</p>
                <div className="space-y-2">
                  {column.workItems.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedItemId(item.id)}
                      className="cursor-move rounded-md border bg-white p-3 text-sm shadow-sm"
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Team({ workspace }: { workspace?: Workspace }) {
  return (
    <div className="space-y-2">
      {workspace?.members?.map((member) => (
        <Card key={member.id} className="flex items-center justify-between p-3">
          <div>
            <p className="font-medium">{member.user.name}</p>
            <p className="text-sm text-muted-foreground">{member.user.email}</p>
          </div>
          <span className="text-sm">{member.role}</span>
        </Card>
      )) ?? <p className="text-sm text-muted-foreground">Create a workspace to add members.</p>}
    </div>
  );
}

function SettingsView({ workspace }: { workspace?: Workspace }) {
  return <Card className="p-4 text-sm text-muted-foreground">Workspace settings for {workspace?.name ?? "your team"}.</Card>;
}
