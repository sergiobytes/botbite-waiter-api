import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  menuItemId: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
