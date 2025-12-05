import { MenuResponse, UpdateMenu } from '../../interfaces/menus.interfaces';
import { findOneMenuUseCase } from './find-one-menu.use-case';

export const updateMenuUseCase = async (
  params: UpdateMenu,
): Promise<MenuResponse> => {
  const { lang, logger, menuId, repository, translationService, dto } = params;

  const { menu } = await findOneMenuUseCase({
    lang,
    logger,
    menuId,
    repository,
    translationService,
  });

  Object.assign(menu, dto);
  await repository.save(menu);

  logger.log(`Menu updated: ${menu.name} (${menuId})`);

  return {
    menu,
    message: translationService.translate('menus.menu_updated', lang),
  };
};
