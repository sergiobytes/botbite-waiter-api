import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

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

  @IsOptional()
  @IsNumber()
  availableMessages?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  surveyUrl?: string;

  @IsOptional()
  @IsString()
  qrToken?: string;
}
