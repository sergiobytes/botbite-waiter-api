import {
  CreateCategory,
  CategoryResponse,
} from '../interfaces/categories.interfaces';

export const createCategoryUseCase = async (
  params: CreateCategory,
): Promise<CategoryResponse> => {
  const { logger, dto, lang, repository, translationService } = params;

  const category = repository.create(dto);

  await repository.save(category);

  logger.log(`Category created: ${category.name}`);

  return {
    category,
    message: translationService.translate('categories.category_created', lang),
  };
};
