import { Priority, WorkItemType } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateIf } from "class-validator";

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

  @IsString()
  @IsOptional()
  status?: string;

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

  @ValidateIf((_, v) => v !== null)
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(WorkItemType)
  @IsOptional()
  type?: WorkItemType;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @IsOptional()
  estimate?: number;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  @IsOptional()
  parentEpicId?: string;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  @IsOptional()
  sprintId?: string;

  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  @IsOptional()
  columnId?: string;
}

export class UpdateAssigneeDto { @ValidateIf((_, v) => v !== null) @IsUUID() @IsOptional() assigneeId?: string; }
export class UpdateEstimateDto { @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @IsOptional() estimate?: number; }
export class UpdateStatusDto { @IsString() status!: string; }
export class UpdateDescriptionDto { @ValidateIf((_, v) => v !== null) @IsString() @IsOptional() description?: string; }
export class MoveWorkItemToSprintDto { @ValidateIf((_, v) => v !== null) @IsUUID() @IsOptional() sprintId?: string; }
export class MoveWorkItemPositionDto { @IsEnum(["TOP", "BOTTOM"]) position!: "TOP" | "BOTTOM"; }

export class BacklogQueryDto {
  @IsUUID()
  workspaceId!: string;

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  epicId?: string;
}

export class ReorderBacklogDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  workItemIds!: string[];
}
