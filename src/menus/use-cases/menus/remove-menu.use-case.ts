import { RemoveMenu, MenuResponse } from '../../interfaces/menus.interfaces';
import { findOneMenuUseCase } from './find-one-menu.use-case';

export const removeMenuUseCase = async (
  params: RemoveMenu,
): Promise<MenuResponse> => {
  const { lang, logger, menuId, repository, translationService } = params;

  const { menu } = await findOneMenuUseCase({
    lang,
    logger,
    menuId,
    repository,
    translationService,
  });

  menu.isActive = false;
  await repository.save(menu);
  logger.log(`Menu removed: ${menu.name} (${menuId})`);

  return {
    menu,
    message: translationService.translate('menus.menu_removed', lang),
  };
};
