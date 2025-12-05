import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { FindCategoryDto } from './dto/find-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  create(@Body() createCategoryDto: CreateCategoryDto, @Lang() lang: string) {
    return this.categoriesService.create(createCategoryDto, lang);
  }

  @Get()
  @Auth([UserRoles.CLIENT, UserRoles.USER])
  findAll(@Query() findCategoryDto: FindCategoryDto) {
    const { limit, offset, ...searchFilters } = findCategoryDto;
    return this.categoriesService.findAll({ limit, offset }, searchFilters);
  }

  @Get(':id')
  @Auth([UserRoles.CLIENT, UserRoles.USER])
  findOne(@Param('id') id: string, @Lang() lang: string) {
    return this.categoriesService.findOne(+id, lang);
  }

  @Patch(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Lang() lang: string,
  ) {
    return this.categoriesService.update(+id, updateCategoryDto, lang);
  }

  @Delete(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  remove(@Param('id') id: string, @Lang() lang: string) {
    return this.categoriesService.remove(+id, lang);
  }
}
