import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsObject()
  content: {
    es: string;
    en: string;
  };

  @IsArray()
  @IsOptional()
  variables?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  category?: string;
}
