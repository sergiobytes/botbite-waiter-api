import {
  MenuResponse,
  UploadMenuFile,
} from '../../interfaces/menus.interfaces';
import { findOneMenuUseCase } from './find-one-menu.use-case';
import { uploadPdfToCloudinary } from '../../../common/utils/upload-to-cloudinary';

export const uploadMenuFileUseCase = async (
  params: UploadMenuFile,
): Promise<MenuResponse> => {
  const { menuId, lang, file, logger, repository, translationService } = params;

  const { menu } = await findOneMenuUseCase({
    menuId,
    lang,
    repository,
    translationService,
    logger,
  });

  const folder =
    process.env.NODE_ENV === 'development'
      ? 'dev/botbite/menus'
      : 'botbite/menus';

  const menuUrl = await uploadPdfToCloudinary(
    file.buffer,
    folder,
    `menu-${menuId}`,
  );

  menu.pdfLink = menuUrl;
  await repository.save(menu);

  return {
    menu,
    message: translationService.translate('menus.menu_file_uploaded', lang),
  };
};
