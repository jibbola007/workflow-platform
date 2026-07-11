import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { WorkspaceRole } from "@prisma/client";

export class CreateWorkspaceDto {
  @IsString()
  name!: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
