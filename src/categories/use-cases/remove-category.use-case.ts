import {
    CategoryResponse,
    RemoveCategory,
} from '../interfaces/categories.interfaces';
import { findOneCategoryUseCase } from './find-one-category.use-case';

export const removeCategoryUseCase = async (
  params: RemoveCategory,
): Promise<CategoryResponse> => {
  const { id, logger, lang, repository, translationService } = params;

  const { category } = await findOneCategoryUseCase({
    id,
    lang,
    repository,
    translationService,
    logger,
  });

  category.isActive = false;
  await repository.save(category);

  logger.log(`Category deactivated: ${category.name}`);

  return {
    category,
    message: translationService.translate(
      'categories.category_deactivated',
      lang,
    ),
  };
};
