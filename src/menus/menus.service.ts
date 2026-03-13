import { Injectable } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { FindMenuItemDto } from './dto/find-menu-item.dto';
import { FindMenuDto } from './dto/find-menu.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuItemResponse, MenuItemsListResponse, } from './interfaces/menu-items.interfaces';
import { MenuListResponse, MenuResponse } from './interfaces/menus.interfaces';
import { CreateMenuItemUseCase } from './use-cases/menu-items/create-menu-item.usecase';
import { FindMenuItemsUseCase } from './use-cases/menu-items/find-menu-items.usecase';
import { FindOneMenuItemUseCase } from './use-cases/menu-items/find-one-menu-item.usecase';
import { RemoveMenuItemUseCase } from './use-cases/menu-items/remove-menu-item.usecase';
import { UpdateMenuItemUseCase } from './use-cases/menu-items/update-menu-item.usecase';
import { CreateMenuUseCase } from './use-cases/menus/create-menu.usecase';
import { FindMenusByBranchUseCase } from './use-cases/menus/find-menus-by-branch.usecase';
import { FindOneMenuUseCase } from './use-cases/menus/find-one-menu.usecase';
import { RemoveMenuUseCase } from './use-cases/menus/remove-menu.usecase';
import { UpdateMenuUseCase } from './use-cases/menus/update-menu.usecase';
import { UploadMenuFileUseCase } from './use-cases/menus/upload-menu-file.usecase';

@Injectable()
export class MenusService {
  constructor(
    // Menu use cases
    private readonly createMenuUseCase: CreateMenuUseCase,
    private readonly findMenusByBranchUseCase: FindMenusByBranchUseCase,
    private readonly findOneMenuUseCase: FindOneMenuUseCase,
    private readonly uploadMenuFileUseCase: UploadMenuFileUseCase,
    private readonly updateMenuUseCase: UpdateMenuUseCase,
    private readonly removeMenuUseCase: RemoveMenuUseCase,
    // MenuItem use cases
    private readonly createMenuItemUseCase: CreateMenuItemUseCase,
    private readonly findMenuItemsUseCase: FindMenuItemsUseCase,
    private readonly findOneMenuItemUseCase: FindOneMenuItemUseCase,
    private readonly updateMenuItemUseCase: UpdateMenuItemUseCase,
    private readonly removeMenuItemUseCase: RemoveMenuItemUseCase,
  ) { }

  //#region Menu
  async createMenu(branchId: string, createMenuDto: CreateMenuDto, lang: string,): Promise<MenuResponse> {
    return await this.createMenuUseCase.execute(branchId, createMenuDto, lang);
  }

  async findMenusByBranch(branchId: string, paginationDto: PaginationDto = {}, findMenuDto: FindMenuDto = {}, lang: string,): Promise<MenuListResponse> {
    return this.findMenusByBranchUseCase.execute(branchId, paginationDto, findMenuDto, lang,);
  }

  async findOneMenu(menuId: string, lang: string): Promise<MenuResponse> {
    return await this.findOneMenuUseCase.execute(menuId, lang);
  }

  async uploadMenuFile(menuId: string, file: Express.Multer.File, lang: string,): Promise<MenuResponse> {
    return await this.uploadMenuFileUseCase.execute(menuId, file, lang);
  }

  async updateMenu(menuId: string, dto: UpdateMenuDto, lang: string,): Promise<MenuResponse> {
    return await this.updateMenuUseCase.execute(menuId, dto, lang);
  }

  async removeMenu(menuId: string, lang: string): Promise<MenuResponse> {
    return await this.removeMenuUseCase.execute(menuId, lang);
  }
  //#endregion

  //#region MenuItem
  async createMenuItem(menuId: string, dto: CreateMenuItemDto, lang: string,): Promise<MenuItemResponse> {
    return await this.createMenuItemUseCase.execute(menuId, dto, lang);
  }

  async findMenuItems(menuId: string, paginationDto: PaginationDto = {}, findMenuItemDto: FindMenuItemDto = {}, lang: string,): Promise<MenuItemsListResponse> {
    return await this.findMenuItemsUseCase.execute(menuId, paginationDto, findMenuItemDto, lang);
  }

  async findOneMenuItem(menuId: string, itemId: string, lang: string,): Promise<MenuItemResponse> {
    return await this.findOneMenuItemUseCase.execute(menuId, itemId, lang);
  }

  async updateMenuItem(menuId: string, itemId: string, dto: UpdateMenuItemDto, lang: string,): Promise<MenuItemResponse> {
    return await this.updateMenuItemUseCase.execute(menuId, itemId, dto, lang);
  }

  async removeMenuItem(menuId: string, itemId: string, lang: string,): Promise<MenuItemResponse> {
    return await this.removeMenuItemUseCase.execute(menuId, itemId, lang);
  }
  //#endregion
}
