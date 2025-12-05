import { CreateMenuDto } from '../dto/create-menu.dto';
import { Repository } from 'typeorm';
import { Menu } from '../entities/menu.entity';
import { TranslationService } from '../../common/services/translation.service';
import { Branch } from '../../branches/entities/branch.entity';
import { Logger } from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FindMenuDto } from '../dto/find-menu.dto';

export interface CreateMenu {
  branchId: string;
  lang: string;
  dto: CreateMenuDto;
  logger: Logger;
  menuRepository: Repository<Menu>;
  branchRepository: Repository<Branch>;
  translationService: TranslationService;
}

export interface FindMenus {
  branchId: string;
  lang: string;
  logger: Logger;
  menuRepository: Repository<Menu>;
  branchRepository: Repository<Branch>;
  translationService: TranslationService;
  paginationDto: PaginationDto;
  findMenuDto: FindMenuDto;
}

export interface FindMenu {
  menuId: string;
  lang: string;
  logger: Logger;
  repository: Repository<Menu>;
  translationService: TranslationService;
}

export interface MenuResponse {
  menu: Menu;
  message: string;
}

export interface MenuListResponse {
  menus: Menu[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}
