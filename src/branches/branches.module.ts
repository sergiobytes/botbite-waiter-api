import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { Branch } from './entities/branch.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService],
  imports: [TypeOrmModule.forFeature([Branch]), CommonModule, CustomJwtModule],
  exports: [TypeOrmModule, BranchesService],
})
export class BranchesModule {}
