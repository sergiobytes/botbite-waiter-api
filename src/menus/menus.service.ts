import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TranslationService } from 'src/common/services/translation.service';
import { Repository } from 'typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { FindMenuItemDto } from './dto/find-menu-item.dto';
import { FindMenuDto } from './dto/find-menu.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuItem } from './entities/menu-item.entity';
import { Menu } from './entities/menu.entity';
import {
  MenuItemResponse,
  MenuItemsListResponse,
} from './interfaces/menu-items.interfaces';
import { MenuListResponse, MenuResponse } from './interfaces/menus.interfaces';
import { createMenuItemUseCase } from './use-cases/menu-items/create-menu-item.use-case';
import { createMenuUseCase } from './use-cases/menus/create-menu.use-case';
import { findMenusByBranchUseCase } from './use-cases/menus/find-menus-by-branch.use-case';
import { findOneMenuUseCase } from './use-cases/menus/find-one-menu.use-case';
import { removeMenuUseCase } from './use-cases/menus/remove-menu.use-case';
import { updateMenuUseCase } from './use-cases/menus/update-menu.use-case';
import { uploadMenuFileUseCase } from './use-cases/menus/upload-menu-file.use-case';
import { findMenuItemsUseCase } from './use-cases/menu-items/find-menu-items.use-case';
import { findOneMenuItemUseCase } from './use-cases/menu-items/find-one-menu-item.use-case';

@Injectable()
export class MenusService {
  private readonly logger = new Logger(MenusService.name);

  constructor(
    @InjectRepository(Menu) private readonly menuRepository: Repository<Menu>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) {}

  //#region Menu
  async createMenu(
    branchId: string,
    createMenuDto: CreateMenuDto,
    lang: string,
  ): Promise<MenuResponse> {
    return createMenuUseCase({
      branchId,
      dto: createMenuDto,
      lang,
      logger: this.logger,
      menuRepository: this.menuRepository,
      branchRepository: this.branchRepository,
      translationService: this.translationService,
    });
  }

  async findMenusByBranch(
    branchId: string,
    paginationDto: PaginationDto = {},
    findMenuDto: FindMenuDto = {},
    lang: string,
  ): Promise<MenuListResponse> {
    return findMenusByBranchUseCase({
      branchId,
      lang,
      logger: this.logger,
      menuRepository: this.menuRepository,
      branchRepository: this.branchRepository,
      translationService: this.translationService,
      paginationDto,
      findMenuDto,
    });
  }

  async findOneMenu(menuId: string, lang: string): Promise<MenuResponse> {
    return findOneMenuUseCase({
      menuId,
      lang,
      logger: this.logger,
      repository: this.menuRepository,
      translationService: this.translationService,
    });
  }

  async uploadMenuFile(
    menuId: string,
    file: Express.Multer.File,
    lang: string,
  ): Promise<MenuResponse> {
    return uploadMenuFileUseCase({
      menuId,
      lang,
      file,
      logger: this.logger,
      repository: this.menuRepository,
      translationService: this.translationService,
    });
  }

  async updateMenu(
    menuId: string,
    dto: UpdateMenuDto,
    lang: string,
  ): Promise<MenuResponse> {
    return updateMenuUseCase({
      menuId,
      dto,
      lang,
      logger: this.logger,
      repository: this.menuRepository,
      translationService: this.translationService,
    });
  }

  async removeMenu(menuId: string, lang: string): Promise<MenuResponse> {
    return removeMenuUseCase({
      menuId,
      lang,
      logger: this.logger,
      repository: this.menuRepository,
      translationService: this.translationService,
    });
  }
  //#endregion

  //#region MenuItem
  async createMenuItem(
    menuId: string,
    dto: CreateMenuItemDto,
    lang: string,
  ): Promise<MenuItemResponse> {
    return createMenuItemUseCase({
      menuId,
      lang,
      dto,
      logger: this.logger,
      menuRepository: this.menuRepository,
      itemRepository: this.menuItemRepository,
      translationService: this.translationService,
    });
  }

  async findMenuItems(
    menuId: string,
    paginationDto: PaginationDto = {},
    findMenuItemDto: FindMenuItemDto = {},
    lang: string,
  ): Promise<MenuItemsListResponse> {
    return findMenuItemsUseCase({
      menuId,
      lang,
      logger: this.logger,
      menuRepository: this.menuRepository,
      itemRepository: this.menuItemRepository,
      translationService: this.translationService,
      paginationDto,
      findMenuItemDto,
    });
  }

  async findOneMenuItem(menuId: string, itemId: string, lang: string) {
    return findOneMenuItemUseCase({
      menuId,
      itemId,
      lang,
      logger: this.logger,
      menuRepository: this.menuRepository,
      itemRepository: this.menuItemRepository,
      translationService: this.translationService,
    });
  }

  async updateMenuItem(
    menuId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
    lang: string,
  ) {
    const menuItem = await this.findOneMenuItem(menuId, itemId, lang);

    Object.assign(menuItem.menuItem, dto);
    const updatedMenuItem = await this.menuItemRepository.save(
      menuItem.menuItem,
    );

    this.logger.log(
      `Menu item updated: ${updatedMenuItem.id} in menu: ${menuId}`,
    );

    return {
      menuItem: updatedMenuItem,
      message: this.translationService.translate(
        'menus.menuitem_updated',
        lang,
      ),
    };
  }

  async removeMenuItem(menuId: string, itemId: string, lang: string) {
    const menuItem = await this.findOneMenuItem(menuId, itemId, lang);

    menuItem.menuItem.isActive = false;
    const updatedMenuItem = await this.menuItemRepository.save(
      menuItem.menuItem,
    );

    this.logger.log(
      `Menu item removed: ${updatedMenuItem.id} in menu: ${menuId}`,
    );

    return {
      menuItem: updatedMenuItem,
      message: this.translationService.translate(
        'menus.menuitem_removed',
        lang,
      ),
    };
  }
  //#endregion
}
