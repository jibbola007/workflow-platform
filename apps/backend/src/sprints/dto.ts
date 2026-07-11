import { SprintStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateSprintDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  goal?: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsUUID()
  workspaceId!: string;
}

export class UpdateSprintDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  goal?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @IsEnum(SprintStatus)
  @IsOptional()
  status?: SprintStatus;
}

export class SprintWorkItemDto {
  @IsUUID()
  workItemId!: string;
}
