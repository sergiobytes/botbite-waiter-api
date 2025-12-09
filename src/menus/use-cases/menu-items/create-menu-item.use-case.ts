import {
  CreateMenuItem,
  MenuItemResponse,
} from '../../interfaces/menu-items.interfaces';
import { findOneMenuUseCase } from '../menus/find-one-menu.use-case';

export const createMenuItemUseCase = async (
  params: CreateMenuItem,
): Promise<MenuItemResponse> => {
  const {
    menuId,
    lang,
    dto,
    logger,
    menuRepository,
    itemRepository,
    translationService,
  } = params;

  await findOneMenuUseCase({
    menuId,
    lang,
    repository: menuRepository,
    translationService,
    logger,
  });

  const menuItem = itemRepository.create({ ...dto, menuId });
  await itemRepository.save(menuItem);

  logger.log(`Menu item created: ${menuItem.productId} for menu: ${menuId}`);

  return {
    menuItem,
    message: translationService.translate('menus.menu_item_created', lang),
  };
};
