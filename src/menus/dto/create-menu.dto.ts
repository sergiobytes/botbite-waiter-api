import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
