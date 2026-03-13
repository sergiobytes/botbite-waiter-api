import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../../../common/services/translation.service';
import { CreateMenuItemDto } from '../../dto/create-menu-item.dto';
import { MenuItem } from '../../entities/menu-item.entity';
import { MenuItemResponse } from '../../interfaces/menu-items.interfaces';
import { FindOneMenuUseCase } from '../menus/find-one-menu.usecase';

@Injectable()
export class CreateMenuItemUseCase {
  private readonly logger = new Logger(CreateMenuItemUseCase.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    private readonly translationService: TranslationService,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
  ) { }

  async execute(menuId: string, createMenuItemDto: CreateMenuItemDto, lang: string): Promise<MenuItemResponse> {
    await this.findOneMenuUseCase.execute(menuId, lang);

    const menuItem = this.menuItemRepository.create({ ...createMenuItemDto, menuId });
    await this.menuItemRepository.save(menuItem);

    this.logger.log(`Menu item created: ${menuItem.productId} for menu: ${menuId}`);

    return {
      menuItem,
      message: this.translationService.translate('menus.menu_item_created', lang),
    };
  };
}