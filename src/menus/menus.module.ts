import { Module } from '@nestjs/common';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { MenuItem } from './entities/menu-item.entity';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  controllers: [MenusController],
  providers: [MenusService],
  imports: [
    TypeOrmModule.forFeature([Menu, MenuItem]),
    CommonModule,
    CustomJwtModule,
    BranchesModule,
  ],
  exports: [TypeOrmModule, MenusService],
})
export class MenusModule {}
