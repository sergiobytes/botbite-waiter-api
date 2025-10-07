import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  phoneNumberAssistant?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  phoneNumberReception?: string;

  @IsString()
  @IsOptional()
  assistantId?: string;
}
