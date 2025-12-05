import { NotFoundException } from '@nestjs/common';
import {
  CategoryResponse,
  FindCategory,
} from '../interfaces/categories.interfaces';

export const findOneCategoryUseCase = async (
  params: FindCategory,
): Promise<CategoryResponse> => {
  const { id, lang, repository, translationService, logger } = params;

  const category = await repository.findOne({ where: { id } });

  if (!category) {
    logger.warn(`Category not found: ${id}`);
    throw new NotFoundException(
      translationService.translate('errors.category_not_found', lang),
    );
  }

  return {
    category,
    message: translationService.translate('categories.category_found', lang),
  };
};
