import {
    MenuItemResponse,
    RemoveMenuItem,
} from '../../interfaces/menu-items.interfaces';
import { findOneMenuItemUseCase } from './find-one-menu-item.use-case';

export const removeMenuItemUseCase = async (
  params: RemoveMenuItem,
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

  const { menuItem } = await findOneMenuItemUseCase({
    menuId,
    itemId,
    lang,
    logger,
    menuRepository,
    itemRepository,
    translationService,
  });

  menuItem.isActive = false;
  await itemRepository.save(menuItem);

  logger.log(`Menu item removed: ${itemId} in menu: ${menuId}`);

  return {
    menuItem,
    message: translationService.translate('menus.menuitem_removed', lang),
  };
};
