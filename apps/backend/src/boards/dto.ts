import { BoardType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateBoardDto {
  @IsString()
  name!: string;

  @IsEnum(BoardType)
  type!: BoardType;

  @IsUUID()
  workspaceId!: string;

  @IsUUID()
  @IsOptional()
  sprintId?: string;
}

export class UpdateBoardDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateColumnDto {
  @IsString()
  name!: string;
}

export class UpdateColumnDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  position?: number;
}

export class BoardWorkItemDto {
  @IsUUID()
  workItemId!: string;

  @IsUUID()
  columnId!: string;
}
