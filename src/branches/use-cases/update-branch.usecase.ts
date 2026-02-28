import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';
import { User } from '../../users/entities/user.entity';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { Branch } from '../entities/branch.entity';
import {
  BranchResponse
} from '../interfaces/branches.interfaces';
import { canModifyBranchesUtil } from '../utils/can-modify-branches.util';
import { FindOneBranchUseCase } from './find-one-branch.usecase';

@Injectable()
export class UpdateBranchUseCase {

  private readonly logger = new Logger(UpdateBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) { }

  async execute(branchId: string, restaurantId: string, updateBranchDto: UpdateBranchDto, user: User, lang: string): Promise<BranchResponse> {


    const { branch } = await this.findOneBranchUseCase.execute(branchId, lang, restaurantId);

    const canModifyAnyBranch = canModifyBranchesUtil(user.roles);

    if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
      this.logger.warn(`Update failed - User ${user.id} tried to modify branch ${branch.id} not owned by them`,);
      throw new BadRequestException(this.translationService.translate('errors.branch_not_owned', lang),);
    }

    if (updateBranchDto.availableMessages !== undefined) {
      const { availableMessages } = updateBranchDto;
      branch.availableMessages += availableMessages;

      updateBranchDto.availableMessages = branch.availableMessages;
    }

    if (updateBranchDto.phoneNumberAssistant === null) {
      branch.qrUrl = null;
      branch.qrToken = null;
    }

    Object.assign(branch, updateBranchDto);

    // Si después del assign, phoneNumberAssistant es null, limpiar QR
    if (branch.phoneNumberAssistant === null) {
      branch.qrUrl = null;
      branch.qrToken = null;
    }

    await this.branchRepository.save(branch);

    this.logger.log(`Branch updated: ${branch.name} by user: ${user.email}. Available messages: ${branch.availableMessages}`,);

    return {
      branch,
      message: this.translationService.translate('branches.branch_updated', lang),
    };
  };

}