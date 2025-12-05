import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TranslationService } from '../../common/services/translation.service';
import { FindMenuItemDto } from '../dto/find-menu-item.dto';
import { UpdateMenuItemDto } from '../dto/update-menu-item.dto';
import { CreateMenuItemDto } from '../dto/create-menu-item.dto';
import { MenuItem } from '../entities/menu-item.entity';
import { Menu } from '../entities/menu.entity';
export interface CreateMenuItem {
  menuId: string;
  lang: string;
  dto: CreateMenuItemDto;
  logger: Logger;
  menuRepository: Repository<Menu>;
  itemRepository: Repository<MenuItem>;
  translationService: TranslationService;
}
export interface FindMenuItems {
  menuId: string;
  lang: string;
  logger: Logger;
  menuRepository: Repository<Menu>;
  itemRepository: Repository<MenuItem>;
  translationService: TranslationService;
  paginationDto: PaginationDto;
  findMenuItemDto: FindMenuItemDto;
}
export interface FindMenuItem {
  menuId: string;
  itemId: string;
  lang: string;
  logger: Logger;
  menuRepository: Repository<Menu>;
  itemRepository: Repository<MenuItem>;
  translationService: TranslationService;
}

export interface UpdateMenuItem {
  menuId: string;
  dto: UpdateMenuItemDto;
  lang: string;
  logger: Logger;
  repository: Repository<MenuItem>;
  translationService: TranslationService;
}
export interface RemoveMenuItem {
  menuId: string;
  lang: string;
  logger: Logger;
  repository: Repository<MenuItem>;
  translationService: TranslationService;
}

export interface MenuItemResponse {
  menuItem: MenuItem;
  message: string;
}
export interface MenuItemsListResponse {
  items: MenuItem[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
