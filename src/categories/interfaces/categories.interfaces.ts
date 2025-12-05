import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TranslationService } from '../../common/services/translation.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { FindCategoryDto } from '../dto/find-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';

export interface CreateCategory {
  logger: Logger;
  dto: CreateCategoryDto;
  lang: string;
  repository: Repository<Category>;
  translationService: TranslationService;
}

export interface UpdateCategory {
  id: number;
  logger: Logger;
  dto: UpdateCategoryDto;
  lang: string;
  repository: Repository<Category>;
  translationService: TranslationService;
}

export interface RemoveCategory {
  id: number;
  logger: Logger;
  lang: string;
  repository: Repository<Category>;
  translationService: TranslationService;
}

export interface CategoryResponse {
  category: Category;
  message: string;
}

export interface FindCategories {
  paginationDto: PaginationDto;
  findCategoryDto: FindCategoryDto;
  repository: Repository<Category>;
}

export interface FindCategory {
  id: number;
  lang: string;
  repository: Repository<Category>;
  translationService: TranslationService;
  logger: Logger;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
