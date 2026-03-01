import { Injectable } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { FindCategoryDto } from './dto/find-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryListResponse, CategoryResponse, } from './interfaces/categories.interfaces';
import { CreateCategoryUseCase } from './use-cases/create-category.usecase';
import { FindAllCategoriesUseCase } from './use-cases/find-all-categories.usecase';
import { FindOneCategoryUseCase } from './use-cases/find-one-category.usecase';
import { RemoveCategoryUseCase } from './use-cases/remove-category.usecase';
import { UpdateCategoryUseCase } from './use-cases/update-category.usecase';

@Injectable()
export class CategoriesService {

  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly findAllCategoriesUseCase: FindAllCategoriesUseCase,
    private readonly findOneCategoryUseCase: FindOneCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly removeCategoryUseCase: RemoveCategoryUseCase,
  ) { }

  async create(createCategoryDto: CreateCategoryDto, lang: string,): Promise<CategoryResponse> {
    return await this.createCategoryUseCase.execute(createCategoryDto, lang);
  }

  async findAll(paginationDto: PaginationDto = {}, findCategoryDto: FindCategoryDto = {},): Promise<CategoryListResponse> {
    return await this.findAllCategoriesUseCase.execute(paginationDto, findCategoryDto);
  }

  async findOne(id: number, lang: string) {
    return await this.findOneCategoryUseCase.execute(id, lang);
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto, lang: string) {
    return await this.updateCategoryUseCase.execute(id, updateCategoryDto, lang);
  }

  async remove(id: number, lang: string) {
    return await this.removeCategoryUseCase.execute(id, lang);
  }
}
