import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { Category } from './entities/category.entity';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateCategoryUseCase } from './use-cases/create-category.usecase';
import { FindAllCategoriesUseCase } from './use-cases/find-all-categories.usecase';
import { FindOneCategoryUseCase } from './use-cases/find-one-category.usecase';
import { UpdateCategoryUseCase } from './use-cases/update-category.usecase';
import { RemoveCategoryUseCase } from './use-cases/remove-category.usecase';


@Module({
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    CreateCategoryUseCase,
    FindAllCategoriesUseCase,
    FindOneCategoryUseCase,
    UpdateCategoryUseCase,
    RemoveCategoryUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([Category]),
    CommonModule,
    CustomJwtModule,
  ],
  exports: [TypeOrmModule, CategoriesService],
})
export class CategoriesModule { }
