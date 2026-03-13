import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../../../common/services/translation.service';
import { uploadPdfToCloudinary } from '../../../common/utils/upload-to-cloudinary';
import { Menu } from '../../entities/menu.entity';
import {
  MenuResponse
} from '../../interfaces/menus.interfaces';
import { FindOneMenuUseCase } from './find-one-menu.usecase';

@Injectable()
export class UploadMenuFileUseCase {
  private readonly logger = new Logger(UploadMenuFileUseCase.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuUseCase: FindOneMenuUseCase
  ) { }

  async execute(menuId: string, file: Express.Multer.File, lang: string): Promise<MenuResponse> {

    const { menu } = await this.findOneMenuUseCase.execute(menuId, lang);

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
    await this.menuRepository.save(menu);

    this.logger.log(`Menu file uploaded for menu ${menuId}`);

    return {
      menu,
      message: this.translationService.translate('menus.menu_file_uploaded', lang),
    };
  };

}