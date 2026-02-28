import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';
import { User } from '../../users/entities/user.entity';
import { Branch } from '../entities/branch.entity';
import { BranchResponse } from '../interfaces/branches.interfaces';
import { canModifyBranchesUtil } from '../utils/can-modify-branches.util';
import { FindOneBranchUseCase } from './find-one-branch.usecase';


@Injectable()
export class ChangeBranchStatusUseCase {
  private readonly logger = new Logger(ChangeBranchStatusUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) { }

  async execute(branchId: string, restaurantId: string, user: User, lang: string, status: boolean): Promise<BranchResponse> {
    const { branch } = await this.findOneBranchUseCase.execute(branchId, lang, restaurantId);

    const canModifyAnyBranch = canModifyBranchesUtil(user.roles);

    const messages: string[] =
      status === true
        ? [
          `Activate failed - User ${user.id} tried to activate branch ${branch.id} not owned by them`,
          `Activate failed - Branch already active: ${branch.id}`,
          'branches.branch_already_active',
          'branches.branch_activated',
        ]
        : [
          `Deactivate failed - User ${user.id} tried to deactivate branch ${branch.id} not owned by them`,
          `Deactivate failed - Branch already inactive: ${branch.id}`,
          'branches.branch_already_inactive',
          'branches.branch_deactivated',
        ];

    if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
      this.logger.warn(messages[0]);
      throw new BadRequestException(this.translationService.translate('errors.branch_not_owned', lang),);
    }

    if (branch.isActive) {
      this.logger.warn(messages[1]);
      throw new BadRequestException(this.translationService.translate(messages[2], lang),);
    }

    branch.isActive = status;
    await this.branchRepository.save(branch);

    this.logger.log(`Branch status changed to ${status}: ${branch.id} by user: ${user.email}`,);
    return {
      branch,
      message: this.translationService.translate(messages[3], lang),
    };
  }

}



