import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { Branch } from '../entities/branch.entity';
import {
  BranchResponse
} from '../interfaces/branches.interfaces';

@Injectable()
export class CreateBranchUseCase {
  private readonly logger = new Logger(CreateBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) { }

  async execute(restaurantId: string, createBranchDto: CreateBranchDto, lang: string): Promise<BranchResponse> {
    const newBranch = this.branchRepository.create({
      ...createBranchDto,
      restaurant: { id: restaurantId },
    });

    await this.branchRepository.save(newBranch);


    this.logger.debug(`Branch created with ID: ${newBranch.id} for restaurant ID: ${restaurantId}`);

    return {
      branch: newBranch,
      message: this.translationService.translate('branches.branch_created', lang),
    };
  }
}
