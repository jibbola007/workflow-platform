const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type User = { id: string; name: string; email: string };
export type Workspace = { id: string; name: string; members?: Array<{ id: string; role: string; user: User }> };
export type WorkItem = {
  id: string;
  title: string;
  description?: string;
  type: "TASK" | "FEATURE" | "BUG" | "EPIC" | "STORY";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE";
  estimate?: number;
  position: number;
  workspaceId: string;
  sprintId?: string;
  columnId?: string;
  createdAt?: string;
  updatedAt?: string;
  assignee?: User;
  parentEpic?: { id: string; title: string };
  comments?: Array<{ id: string; message: string; createdAt: string; user: Pick<User, "id" | "name"> }>;
};
export type Sprint = { id: string; name: string; goal?: string; status: string; startDate: string; endDate: string; workItems: WorkItem[]; board?: Board };
export type Board = { id: string; name: string; type: "SPRINT" | "KANBAN"; columns: Array<{ id: string; name: string; workItems: WorkItem[] }> };

export class ApiClient {
  constructor(private token?: string) {}

  setToken(token?: string) {
    this.token = token;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers
      }
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message ?? "Request failed");
    }
    return res.json();
  }
}
