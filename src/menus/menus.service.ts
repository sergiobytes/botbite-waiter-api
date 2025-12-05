import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { MenuItem } from './entities/menu-item.entity';
import { TranslationService } from 'src/common/services/translation.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { Branch } from '../branches/entities/branch.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FindMenuDto } from './dto/find-menu.dto';
import { FindMenuItemDto } from './dto/find-menu-item.dto';
import { MenuListResponse, MenuResponse } from './interfaces/menus.interfaces';
import { createMenuUseCase } from './use-cases/menus/create-menu.use-case';
import { findMenusByBranchUseCase } from './use-cases/menus/find-menus-by-branch.use-case';
import { findOneMenuUseCase } from './use-cases/menus/find-one-menu.use-case';
import { uploadMenuFileUseCase } from './use-cases/menus/upload-menu-file.use-case';

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

  async updateMenu(menuId: string, dto: UpdateMenuDto, lang: string) {
    const menu = await this.findOneMenu(menuId, lang);

    Object.assign(menu, dto);

    const updatedMenu = await this.menuRepository.save(menu.menu);

    this.logger.log(`Menu updated: ${updatedMenu.name} (${menuId})`);

    return {
      menu: updatedMenu,
      message: this.translationService.translate('menus.menu_updated', lang),
    };
  }

  async removeMenu(menuId: string, lang: string) {
    const menu = await this.findOneMenu(menuId, lang);

    menu.menu.isActive = false;
    const updatedMenu = await this.menuRepository.save(menu.menu);

    this.logger.log(`Menu removed: ${updatedMenu.name} (${menuId})`);

    return {
      menu: updatedMenu,
      message: this.translationService.translate('menus.menu_removed', lang),
    };
  }
  //#endregion

  //#region MenuItem
  async createMenuItem(menuId: string, dto: CreateMenuItemDto, lang: string) {
    const menu = await this.findOneMenu(menuId, lang);

    const menuItem = this.menuItemRepository.create({
      ...dto,
      menuId: menu.menu.id,
    });

    const savedMenuItem = await this.menuItemRepository.save(menuItem);

    this.logger.log(
      `Menu item created: ${savedMenuItem.id} for menu: ${menuId}`,
    );

    return {
      menuItem: savedMenuItem,
      message: this.translationService.translate(
        'menus.menuitem_created',
        lang,
      ),
    };
  }

  async findMenuItems(
    menuId: string,
    paginationDto: PaginationDto = {},
    findMenuItemDto: FindMenuItemDto = {},
    lang: string,
  ) {
    const menu = await this.findOneMenu(menuId, lang);

    const { limit = 10, offset = 0 } = paginationDto;
    const { search, isActive } = findMenuItemDto;

    const queryBuilder = this.menuItemRepository
      .createQueryBuilder('menuItem')
      .leftJoinAndSelect('menuItem.product', 'product')
      .leftJoinAndSelect('menuItem.category', 'category')
      .where('menuItem.menuId = :menuId', { menuId: menu.menu.id });

    if (isActive !== undefined) {
      queryBuilder.andWhere('menuItem.isActive = :isActive', { isActive });
    }

    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.normalizedName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('menuItem.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      message: this.translationService.translate('menus.menuitems_found', lang),
    };
  }

  async findOneMenuItem(menuId: string, itemId: string, lang: string) {
    await this.findOneMenu(menuId, lang);

    const menuItem = await this.menuItemRepository.findOne({
      where: { id: itemId, menuId },
    });

    if (!menuItem) {
      this.logger.warn(`Menu item not found: ${itemId} in menu: ${menuId}`);
      throw new NotFoundException(
        this.translationService.translate('menus.menuitem_not_found', lang),
      );
    }

    return {
      menuItem,
      message: this.translationService.translate('menus.menuitem_found', lang),
    };
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

  private async validateBranch(branchId: string, lang: string) {
    const branch = await this.branchRepository.findOne({
      where: { id: branchId, isActive: true },
    });

    if (!branch) {
      this.logger.warn(
        `Create menu failed - Branch not found or inactive: ${branchId}`,
      );
      throw new NotFoundException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }
  }
}
