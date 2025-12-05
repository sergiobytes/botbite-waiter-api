import { findOneBranchUseCase } from '../../../branches/use-cases/find-one-branch.use-case';
import { CreateMenu, MenuResponse } from '../../interfaces/menus.interfaces';

export const createMenuUseCase = async (
  params: CreateMenu,
): Promise<MenuResponse> => {
  const {
    branchId,
    lang,
    dto,
    logger,
    menuRepository,
    branchRepository,
    translationService,
  } = params;

  await findOneBranchUseCase({
    term: branchId,
    lang,
    repository: branchRepository,
    translationService,
    logger,
  });

  const menu = menuRepository.create({ ...dto, branchId });
  await menuRepository.save(menu);

  logger.log(`Menu created: ${menu.name} for branch: ${branchId}`);

  return {
    menu,
    message: translationService.translate('menus.menu_created', lang),
  };
};
