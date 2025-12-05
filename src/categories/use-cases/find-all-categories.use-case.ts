import { FindOptionsWhere, ILike } from 'typeorm';
import {
  CategoryListResponse,
  FindCategories,
} from '../interfaces/categories.interfaces';
import { Category } from '../entities/category.entity';

export const findAllCategoriesUseCase = async (
  params: FindCategories,
): Promise<CategoryListResponse> => {
  const { paginationDto, findCategoryDto, repository } = params;

  const { limit = 10, offset = 0 } = paginationDto;
  const { name, search, isActive } = findCategoryDto;

  const whereConditions: FindOptionsWhere<Category> = {};

  if (name) whereConditions.name = ILike(`%${name}%`);
  if (search) whereConditions.name = ILike(`%${search}%`);
  if (isActive !== undefined) whereConditions.isActive = isActive;

  const [categories, total] = await repository.findAndCount({
    where: whereConditions,
    order: { name: 'ASC' },
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
  };
};
