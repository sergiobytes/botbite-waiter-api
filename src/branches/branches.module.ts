import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { Branch } from './entities/branch.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { CreateBranchUseCase } from './use-cases/create-branch.usecase';
import { BulkCreateBranchesUseCase } from './use-cases/bulk-create-branches.usecase';
import { UpdateBranchUseCase } from './use-cases/update-branch.usecase';
import { FindOneBranchUseCase } from './use-cases/find-one-branch.usecase';
import { ChangeBranchStatusUseCase } from './use-cases/change-branch-status.usecase';
import { FindAllBranchesByRestaurantUseCase } from './use-cases/find-all-branches-by-restaurant.usecase';
import { GenerateQrForBranchUseCase } from './use-cases/generate-qr-for-branch.usecase';

@Module({
  controllers: [BranchesController],
  providers: [
    BranchesService,
    CreateBranchUseCase,
    BulkCreateBranchesUseCase,
    UpdateBranchUseCase,
    FindOneBranchUseCase,
    ChangeBranchStatusUseCase,
    FindAllBranchesByRestaurantUseCase,
    GenerateQrForBranchUseCase
  ],
  imports: [TypeOrmModule.forFeature([Branch]), CommonModule, CustomJwtModule],
  exports: [TypeOrmModule, BranchesService, FindOneBranchUseCase],
})
export class BranchesModule { }
