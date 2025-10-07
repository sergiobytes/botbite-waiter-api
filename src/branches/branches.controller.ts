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
import { BranchesService } from './branches.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { FindBranchDto } from './dto/find-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { User } from '../users/entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post(':restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  createBranch(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() createBranchDto: CreateBranchDto,
    @Lang() lang: string,
  ) {
    return this.branchesService.create(restaurantId, createBranchDto, lang);
  }

  @Post('bulk-upload/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  @UseInterceptors(FileInterceptor('file'))
  bulkCreate(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Lang() lang: string,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    return this.branchesService.bulkCreateBranches(restaurantId, file, lang);
  }

  @Get('restaurant/:restaurantId/:term')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findByTerm(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('term') term: string,
  ) {
    return this.branchesService.findByTerm(term, restaurantId);
  }

  @Get('restaurant/:restaurantId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findAllByRestaurant(
    @Query() findBranchesDto: FindBranchDto,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    const { limit, offset, ...searchFilters } = findBranchesDto;
    return this.branchesService.findAllByRestaurant(restaurantId, {
      limit,
      offset,
      ...searchFilters,
    });
  }

  @Get('generate-qr/:restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  generateQr(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Lang() lang: string,
  ) {
    return this.branchesService.generateQrForBranch(
      branchId,
      restaurantId,
      lang,
    );
  }

  @Patch('restaurant/:restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  updateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.branchesService.update(
      branchId,
      restaurantId,
      updateBranchDto,
      user,
      lang,
    );
  }

  @Patch('activate/:restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  activateBranch(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.branchesService.activateBranch(
      branchId,
      restaurantId,
      user,
      lang,
    );
  }

  @Delete(':restaurantId/:branchId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  deactivateProduct(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: User,
    @Lang() lang: string,
  ) {
    return this.branchesService.deactivateBranch(
      branchId,
      restaurantId,
      user,
      lang,
    );
  }
}
