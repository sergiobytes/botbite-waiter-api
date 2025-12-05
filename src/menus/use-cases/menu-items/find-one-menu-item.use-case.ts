import { NotFoundException } from '@nestjs/common';
import {
  FindMenuItem,
  MenuItemResponse,
} from '../../interfaces/menu-items.interfaces';
import { findOneMenuUseCase } from '../menus/find-one-menu.use-case';

export const findOneMenuItemUseCase = async (
  params: FindMenuItem,
): Promise<MenuItemResponse> => {
  const {
    menuId,
    itemId,
    lang,
    logger,
    menuRepository,
    itemRepository,
    translationService,
  } = params;

  await findOneMenuUseCase({
    menuId,
    lang,
    logger,
    repository: menuRepository,
    translationService,
  });

  const menuItem = await itemRepository.findOne({
    where: { id: itemId, menuId },
  });

  if (!menuItem) {
    logger.warn(`Menu item not found: ${itemId} in menu: ${menuId}`);
    throw new NotFoundException(
      translationService.translate('menus.menuitem_not_found', lang),
    );
  }

  return {
    menuItem,
    message: translationService.translate('menus.menuitem_found', lang),
  };
};
