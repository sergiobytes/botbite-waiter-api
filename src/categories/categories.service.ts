import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { TranslationService } from '../common/services/translation.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { FindCategoryDto } from './dto/find-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import {
  CategoryListResponse,
  CategoryResponse,
} from './interfaces/categories.interfaces';
import { createCategoryUseCase } from './use-cases/create-category.use-case';
import { findAllCategoriesUseCase } from './use-cases/find-all-categories.use-case';
import { findOneCategoryUseCase } from './use-cases/find-one-category.use-case';
import { removeCategoryUseCase } from './use-cases/remove-category.use-case';
import { updateCategoryUseCase } from './use-cases/update-category.use-case';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly translationService: TranslationService,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    lang: string,
  ): Promise<CategoryResponse> {
    return createCategoryUseCase({
      logger: this.logger,
      dto: createCategoryDto,
      lang,
      repository: this.categoryRepository,
      translationService: this.translationService,
    });
  }

  async findAll(
    paginationDto: PaginationDto = {},
    findCategoryDto: FindCategoryDto = {},
  ): Promise<CategoryListResponse> {
    return findAllCategoriesUseCase({
      paginationDto,
      findCategoryDto,
      repository: this.categoryRepository,
    });
  }

  async findOne(id: number, lang: string) {
    return findOneCategoryUseCase({
      id,
      lang,
      repository: this.categoryRepository,
      translationService: this.translationService,
      logger: this.logger,
    });
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto, lang: string) {
    return updateCategoryUseCase({
      id,
      logger: this.logger,
      dto: updateCategoryDto,
      lang,
      repository: this.categoryRepository,
      translationService: this.translationService,
    });
  }

  async remove(id: number, lang: string) {
    return removeCategoryUseCase({
      id,
      logger: this.logger,
      lang,
      repository: this.categoryRepository,
      translationService: this.translationService,
    });
  }
}
