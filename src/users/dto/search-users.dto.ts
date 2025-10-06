import { IsOptional, IsEmail, IsString } from 'class-validator';

export class SearchUsersDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  search?: string; // Para búsqueda general por email parcial
}