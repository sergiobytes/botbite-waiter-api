import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category } from './entities/category.entity';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  imports: [
    TypeOrmModule.forFeature([Category]),
    CommonModule,
    CustomJwtModule,
  ],
  exports: [TypeOrmModule, CategoriesService],
})
export class CategoriesModule {}
