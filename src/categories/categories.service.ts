import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { ILike, Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FindCategoryDto } from './dto/find-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly translationService: TranslationService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto, lang: string) {
    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);

    this.logger.log(`Category created: ${savedCategory.name}`);

    return {
      category: savedCategory,
      message: this.translationService.translate(
        'categories.category_created',
        lang,
      ),
    };
  }

  async findAll(
    paginationDto: PaginationDto = {},
    findCategoryDto: FindCategoryDto = {},
    lang: string,
  ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive } = findCategoryDto;

    const whereConditions: any = {};

    if (name) {
      whereConditions.name = ILike(`%${name}%`);
    } else if (search) {
      whereConditions.name = ILike(`%${search}%`);
    }

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    const [categories, total] = await this.categoryRepository.findAndCount({
      where: whereConditions,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      categories,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      message: this.translationService.translate(
        'categories.categories_found',
        lang,
      ),
    };
  }

  async findOne(id: number, lang: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      this.logger.warn(`Category not found: ${id}`);
      throw new NotFoundException(
        this.translationService.translate('errors.category_not_found', lang),
      );
    }

    return {
      category,
      message: this.translationService.translate(
        'categories.category_found',
        lang,
      ),
    };
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto, lang: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      this.logger.warn(`Update failed - Category not found: ${id}`);
      throw new NotFoundException(
        this.translationService.translate('errors.category_not_found', lang),
      );
    }

    Object.assign(category, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.save(category);

    this.logger.log(`Category updated: ${updatedCategory.name}`);

    return {
      category: updatedCategory,
      message: this.translationService.translate(
        'categories.category_updated',
        lang,
      ),
    };
  }

  async remove(id: number, lang: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      this.logger.warn(`Remove failed - Category not found: ${id}`);
      throw new NotFoundException(
        this.translationService.translate('errors.category_not_found', lang),
      );
    }

    category.isActive = false;
    const deactivatedCategory = await this.categoryRepository.save(category);

    this.logger.log(`Category deactivated: ${deactivatedCategory.name}`);

    return {
      category: deactivatedCategory,
      message: this.translationService.translate(
        'categories.category_deactivated',
        lang,
      ),
    };
  }
}
