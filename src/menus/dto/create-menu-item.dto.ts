import { IsString, IsNumber } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  categoryId: number;

  @IsNumber()
  price: number;
}
