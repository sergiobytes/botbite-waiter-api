import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { User } from '../users/entities/user.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { FindBranchDto } from './dto/find-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch } from './entities/branch.entity';
import { BranchListResponse, BranchResponse, BulkCreateBranchesResponse, } from './interfaces/branches.interfaces';
import { BulkCreateBranchesUseCase } from './use-cases/bulk-create-branches.usecase';
import { ChangeBranchStatusUseCase } from './use-cases/change-branch-status.usecase';
import { CreateBranchUseCase } from './use-cases/create-branch.usecase';
import { FindAllBranchesByRestaurantUseCase } from './use-cases/find-all-branches-by-restaurant.usecase';
import { FindOneBranchUseCase } from './use-cases/find-one-branch.usecase';
import { GenerateQrForBranchUseCase } from './use-cases/generate-qr-for-branch.usecase';
import { UpdateBranchUseCase } from './use-cases/update-branch.usecase';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly createBranchUseCase: CreateBranchUseCase,
    private readonly bulkCreateBranchesUseCase: BulkCreateBranchesUseCase,
    private readonly updateBranchUseCase: UpdateBranchUseCase,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
    private readonly changeBranchStatusUseCase: ChangeBranchStatusUseCase,
    private readonly findAllBranchesByRestaurantUseCase: FindAllBranchesByRestaurantUseCase,
    private readonly generateQrForBranchUseCase: GenerateQrForBranchUseCase,
  ) { }

  async create(restaurantId: string, createBranchDto: CreateBranchDto, lang: string,): Promise<BranchResponse> {
    return await this.createBranchUseCase.execute(restaurantId, createBranchDto, lang);
  }

  async bulkCreateBranches(restaurantId: string, file: Express.Multer.File, lang: string,): Promise<BulkCreateBranchesResponse> {
    return await this.bulkCreateBranchesUseCase.execute(restaurantId, file, lang,);
  }

  async update(branchId: string, restaurantId: string, updateBranchDto: UpdateBranchDto, user: User, lang: string,): Promise<BranchResponse> {
    return await this.updateBranchUseCase.execute(branchId, restaurantId, updateBranchDto, user, lang);
  }

  async activateBranch(branchId: string, restaurantId: string, user: User, lang: string,): Promise<BranchResponse> {
    return await this.changeBranchStatusUseCase.execute(branchId, restaurantId, user, lang, true);
  }

  async deactivateBranch(branchId: string, restaurantId: string, user: User, lang: string,) {
    return await this.changeBranchStatusUseCase.execute(branchId, restaurantId, user, lang, false);
  }

  async findByTerm(term: string, lang: string, restaurantId?: string) {
    return await this.findOneBranchUseCase.execute(term, lang, restaurantId);
  }

  async findAllByRestaurant(restaurantId: string, paginationDto: PaginationDto = {}, findBranchDto: FindBranchDto = {}): Promise<BranchListResponse> {
    return await this.findAllBranchesByRestaurantUseCase.execute(restaurantId, paginationDto, findBranchDto);
  }

  async generateQrForBranch(branchId: string, restaurantId: string, lang: string,) {
    return await this.generateQrForBranchUseCase.execute(branchId, restaurantId, lang);
  }

  async updateAvailableMessages(branch: Branch) {
    branch.availableMessages -= 1;
    await this.branchRepository.save(branch);
  }
}
