import { Priority, WorkItemStatus, WorkItemType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateWorkItemDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(WorkItemType)
  type!: WorkItemType;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsInt()
  @IsOptional()
  estimate?: number;

  @IsUUID()
  workspaceId!: string;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @IsUUID()
  @IsOptional()
  parentEpicId?: string;

  @IsUUID()
  @IsOptional()
  sprintId?: string;

  @IsUUID()
  @IsOptional()
  columnId?: string;
}

export class UpdateWorkItemDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(WorkItemType)
  @IsOptional()
  type?: WorkItemType;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(WorkItemStatus)
  @IsOptional()
  status?: WorkItemStatus;

  @IsInt()
  @IsOptional()
  estimate?: number;

  @IsUUID()
  @IsOptional()
  assigneeId?: string | null;

  @IsUUID()
  @IsOptional()
  parentEpicId?: string | null;

  @IsUUID()
  @IsOptional()
  sprintId?: string | null;

  @IsUUID()
  @IsOptional()
  columnId?: string | null;
}

export class UpdateAssigneeDto { @IsUUID() @IsOptional() assigneeId?: string | null; }
export class UpdateEstimateDto { @IsInt() @Min(0) @IsOptional() estimate?: number | null; }
export class UpdateStatusDto { @IsEnum(WorkItemStatus) status!: WorkItemStatus; }
export class UpdateDescriptionDto { @IsString() @IsOptional() description?: string | null; }
export class MoveWorkItemToSprintDto { @IsUUID() @IsOptional() sprintId?: string | null; }
export class MoveWorkItemPositionDto { @IsEnum(["TOP", "BOTTOM"]) position!: "TOP" | "BOTTOM"; }
