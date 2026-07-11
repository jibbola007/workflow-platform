-- Preserve an explicit, stable order for backlog work items.
ALTER TABLE "WorkItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "workspaceId", "sprintId" ORDER BY "updatedAt" DESC) - 1 AS position
  FROM "WorkItem"
)
UPDATE "WorkItem" AS item SET "position" = ordered.position FROM ordered WHERE item."id" = ordered."id";

CREATE INDEX "WorkItem_workspaceId_sprintId_position_idx" ON "WorkItem"("workspaceId", "sprintId", "position");
