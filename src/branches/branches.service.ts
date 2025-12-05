import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { TranslationService } from '../common/services/translation.service';
import { User } from '../users/entities/user.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { FindBranchDto } from './dto/find-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch } from './entities/branch.entity';
import {
  BranchListResponse,
  BranchResponse,
  BulkCreateBranchesResponse,
} from './interfaces/branches.interfaces';
import { createBranchUseCase } from './use-cases/create-branch.use-case';
import { bulkCreateBranchesUseCase } from './use-cases/bulk-create-branches.use-case';
import { updateBranchUseCase } from './use-cases/update-branch.use-case';
import { findOneBranchUseCase } from './use-cases/find-one-branch.use-case';
import { changeBranchStatusUseCase } from './use-cases/change-branch-status.use-case';
import { findAllBranchesByRestaurantUseCase } from './use-cases/find-all-branches-by-restaurant.use-case';
import { generateQrForBranchUseCase } from './use-cases/generate-qr-for-branch.use-case';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) {}

  async create(
    restaurantId: string,
    createBranchDto: CreateBranchDto,
    lang: string,
  ): Promise<BranchResponse> {
    return await createBranchUseCase({
      dto: createBranchDto,
      repository: this.branchRepository,
      translationService: this.translationService,
      restaurantId,
      lang,
    });
  }

  async bulkCreateBranches(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ): Promise<BulkCreateBranchesResponse> {
    return await bulkCreateBranchesUseCase({
      file,
      repository: this.branchRepository,
      logger: this.logger,
      translationService: this.translationService,
      restaurantId,
      lang,
    });
  }

  async update(
    branchId: string,
    restaurantId: string,
    updateBranchDto: UpdateBranchDto,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    return await updateBranchUseCase({
      dto: updateBranchDto,
      user,
      repository: this.branchRepository,
      logger: this.logger,
      translationService: this.translationService,
      branchId,
      restaurantId,
      lang,
    });
  }

  async activateBranch(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ): Promise<BranchResponse> {
    return await changeBranchStatusUseCase({
      user,
      repository: this.branchRepository,
      logger: this.logger,
      translationService: this.translationService,
      branchId,
      restaurantId,
      status: true,
      lang,
    });
  }

  async deactivateBranch(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    return await changeBranchStatusUseCase({
      user,
      repository: this.branchRepository,
      logger: this.logger,
      translationService: this.translationService,
      branchId,
      restaurantId,
      status: false,
      lang,
    });
  }

  async findByTerm(term: string, lang: string, restaurantId?: string) {
    return await findOneBranchUseCase({
      term,
      restaurantId,
      repository: this.branchRepository,
      translationService: this.translationService,
      lang,
      logger: this.logger,
    });
  }

  async findAllByRestaurant(
    restaurantId: string,
    paginationDto: PaginationDto = {},
    findBranchDto: FindBranchDto = {},
  ): Promise<BranchListResponse> {
    return await findAllBranchesByRestaurantUseCase({
      restaurantId,
      paginationDto,
      findBranchDto,
      repository: this.branchRepository,
    });
  }

  async generateQrForBranch(
    branchId: string,
    restaurantId: string,
    lang: string,
  ) {
    return await generateQrForBranchUseCase({
      branchId,
      restaurantId,
      lang,
      logger: this.logger,
      repository: this.branchRepository,
      translationService: this.translationService,
    });
  }

  async updateAvailableMessages(branch: Branch) {
    branch.availableMessages -= 1;
    await this.branchRepository.save(branch);
  }
}
