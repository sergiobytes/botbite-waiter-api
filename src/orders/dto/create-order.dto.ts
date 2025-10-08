import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsString()
  customerId: string;

  @IsString()
  branchId: string;

  @IsArray()
  @ValidateNested({})
  orderItems: CreateOrderItemDto[];

  @IsOptional()
  @IsNumber()
  total?: number;
}
