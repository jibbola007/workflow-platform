-- AlterTable: Alter status column in WorkItem to TEXT and migrate existing status values
ALTER TABLE "WorkItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WorkItem" ALTER COLUMN "status" TYPE TEXT USING CASE
  WHEN "status"::text = 'BACKLOG' THEN 'Backlog'
  WHEN "status"::text = 'TODO' THEN 'To Do'
  WHEN "status"::text = 'IN_PROGRESS' THEN 'In Progress'
  WHEN "status"::text = 'DONE' THEN 'Done'
  ELSE "status"::text
END;
ALTER TABLE "WorkItem" ALTER COLUMN "status" SET DEFAULT 'To Do';

-- DropEnum
DROP TYPE "WorkItemStatus";
