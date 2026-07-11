export const workItemTypes = ["EPIC", "FEATURE", "TASK", "BUG"] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const workItemStatuses = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE"] as const;
export const workspaceRoles = ["ADMIN", "MEMBER", "VIEWER"] as const;
export const sprintStatuses = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
export const boardTypes = ["SPRINT", "KANBAN"] as const;

export type WorkItemType = (typeof workItemTypes)[number];
export type Priority = (typeof priorities)[number];
export type WorkItemStatus = (typeof workItemStatuses)[number];
export type WorkspaceRole = (typeof workspaceRoles)[number];
export type SprintStatus = (typeof sprintStatuses)[number];
export type BoardType = (typeof boardTypes)[number];
