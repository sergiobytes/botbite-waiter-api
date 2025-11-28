import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRoles } from 'src/users/enums/user-roles';
import { Auth } from '../auth/decorators/auth.decorator';
import { Lang } from '../common/decorators/lang.decorator';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { FindMenuItemDto } from './dto/find-menu-item.dto';
import { FindMenuDto } from './dto/find-menu.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  //#region Menu
  @Post(':branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  createMenu(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateMenuDto,
    @Lang() lang: string,
  ) {
    return this.menusService.createMenu(branchId, dto, lang);
  }

  @Get(':branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findMenusByBranch(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() findMenuDto: FindMenuDto,
    @Lang() lang: string,
  ) {
    const { limit, offset, ...searchFilters } = findMenuDto;
    return this.menusService.findMenusByBranch(
      branchId,
      { limit, offset },
      searchFilters,
      lang,
    );
  }

  @Get('menu/:menuId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findOneMenu(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Lang() lang: string,
  ) {
    return this.menusService.findOneMenu(menuId, lang);
  }

  @Post('menu/upload-file/:menuId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  @UseInterceptors(FileInterceptor('file'))
  uploadMenuFile(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @UploadedFile() file: Express.Multer.File,
    @Lang() lang: string,
  ) {
    if (!file) throw new BadRequestException('File is required');

    if (
      file.mimetype !== 'application/pdf' &&
      !file.originalname.endsWith('.pdf')
    ) {
      throw new BadRequestException('Only PDF files are allowed');
    }

    return this.menusService.uploadMenuFile(menuId, file, lang);
  }

  @Patch('menu/:menuId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  updateMenu(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Body() dto: UpdateMenuDto,
    @Lang() lang: string,
  ) {
    return this.menusService.updateMenu(menuId, dto, lang);
  }

  @Delete('menu/:menuId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  removeMenu(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Lang() lang: string,
  ) {
    return this.menusService.removeMenu(menuId, lang);
  }
  //#endregion

  //#region MenuItem
  @Post('menu/:menuId/items')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  createMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Body() dto: CreateMenuItemDto,
    @Lang() lang: string,
  ) {
    return this.menusService.createMenuItem(menuId, dto, lang);
  }

  @Get('menu/:menuId/items')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findMenuItems(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Query() findMenuItemDto: FindMenuItemDto,
    @Lang() lang: string,
  ) {
    const { limit, offset, ...searchFilters } = findMenuItemDto;
    return this.menusService.findMenuItems(
      menuId,
      { limit, offset },
      searchFilters,
      lang,
    );
  }

  @Get('menu/:menuId/items/:itemId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findOneMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Lang() lang: string,
  ) {
    return this.menusService.findOneMenuItem(menuId, itemId, lang);
  }

  @Patch('menu/:menuId/items/:itemId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  updateMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @Lang() lang: string,
  ) {
    return this.menusService.updateMenuItem(menuId, itemId, dto, lang);
  }

  @Delete('menu/:menuId/items/:itemId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  removeMenuItem(
    @Param('menuId', ParseUUIDPipe) menuId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Lang() lang: string,
  ) {
    return this.menusService.removeMenuItem(menuId, itemId, lang);
  }
  //#endregion
}
