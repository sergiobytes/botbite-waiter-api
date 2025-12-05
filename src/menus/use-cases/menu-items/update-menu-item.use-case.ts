import {
  MenuItemResponse,
  UpdateMenuItem,
} from '../../interfaces/menu-items.interfaces';
import { findOneMenuItemUseCase } from './find-one-menu-item.use-case';

export const updateMenuItemUseCase = async (
  params: UpdateMenuItem,
): Promise<MenuItemResponse> => {
  const {
    menuId,
    itemId,
    dto,
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

  Object.assign(menuItem, dto);
  await itemRepository.save(menuItem);

  logger.log(`Menu item updated: ${menuItem.id} in menu: ${menuId}`);

  return {
    menuItem,
    message: translationService.translate('menus.menuitem_updated', lang),
  };
};
