import { NotFoundException } from '@nestjs/common';
import { FindMenu, MenuResponse } from '../../interfaces/menus.interfaces';

export const findOneMenuUseCase = async (
  params: FindMenu,
): Promise<MenuResponse> => {
  const { menuId, lang, logger, repository, translationService } = params;

  const menu = await repository.findOne({
    where: { id: menuId },
    relations: { menuItems: true },
  });

  if (!menu) {
    logger.warn(`Menu not found: ${menuId}`);
    throw new NotFoundException(
      translationService.translate('menus.menu_not_found', lang),
    );
  }

  return {
    menu,
    message: translationService.translate('menus.menu_found', lang),
  }
};
