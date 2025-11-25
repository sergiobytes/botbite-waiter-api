import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Type(() => Number)
  categoryId: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
