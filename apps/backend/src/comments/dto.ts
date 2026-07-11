import { IsString, IsUUID } from "class-validator";

export class CreateCommentDto {
  @IsUUID()
  workItemId!: string;

  @IsString()
  message!: string;
}
