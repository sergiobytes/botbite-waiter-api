import {
    CategoryResponse,
    UpdateCategory,
} from '../interfaces/categories.interfaces';
import { findOneCategoryUseCase } from './find-one-category.use-case';

export const updateCategoryUseCase = async (
  params: UpdateCategory,
): Promise<CategoryResponse> => {
  const { id, logger, dto, lang, repository, translationService } = params;

  const { category } = await findOneCategoryUseCase({
    id,
    lang,
    repository,
    translationService,
    logger,
  });

  Object.assign(category, dto);
  await repository.save(category);

  logger.log(`Category updated: ${category.name}`);

  return {
    category,
    message: translationService.translate('categories.category_updated', lang),
  };
};
