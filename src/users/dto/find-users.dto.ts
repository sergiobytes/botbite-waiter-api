import { IsOptional, IsEmail, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindUsersDto {
  // Paginación
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Offset must be a number' })
  @Min(0, { message: 'Offset must be at least 0' })
  offset?: number = 0;

  // Búsqueda
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  search?: string; // Para búsqueda general por email parcial
}