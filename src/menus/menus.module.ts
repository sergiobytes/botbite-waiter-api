import { Module } from '@nestjs/common';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { MenuItem } from './entities/menu-item.entity';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { BranchesModule } from '../branches/branches.module';
import { CreateMenuUseCase } from './use-cases/menus/create-menu.usecase';
import { FindMenusByBranchUseCase } from './use-cases/menus/find-menus-by-branch.usecase';
import { FindOneMenuUseCase } from './use-cases/menus/find-one-menu.usecase';
import { UploadMenuFileUseCase } from './use-cases/menus/upload-menu-file.usecase';
import { UpdateMenuUseCase } from './use-cases/menus/update-menu.usecase';
import { RemoveMenuUseCase } from './use-cases/menus/remove-menu.usecase';
import { CreateMenuItemUseCase } from './use-cases/menu-items/create-menu-item.usecase';
import { FindMenuItemsUseCase } from './use-cases/menu-items/find-menu-items.usecase';
import { FindOneMenuItemUseCase } from './use-cases/menu-items/find-one-menu-item.usecase';
import { UpdateMenuItemUseCase } from './use-cases/menu-items/update-menu-item.usecase';
import { RemoveMenuItemUseCase } from './use-cases/menu-items/remove-menu-item.usecase';

@Module({
  controllers: [MenusController],
  providers: [
    MenusService,
    CreateMenuUseCase,
    FindMenusByBranchUseCase,
    FindOneMenuUseCase,
    UploadMenuFileUseCase,
    UpdateMenuUseCase,
    RemoveMenuUseCase,
    CreateMenuItemUseCase,
    FindMenuItemsUseCase,
    FindOneMenuItemUseCase,
    UpdateMenuItemUseCase,
    RemoveMenuItemUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([Menu, MenuItem]),
    CommonModule,
    CustomJwtModule,
    BranchesModule,
  ],
  exports: [TypeOrmModule, MenusService],
})
export class MenusModule { }
