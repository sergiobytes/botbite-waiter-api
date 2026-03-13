import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';
import { Branch } from '../entities/branch.entity';
import { BranchResponse } from '../interfaces/branches.interfaces';


@Injectable()
export class FindOneBranchUseCase {
  private readonly logger = new Logger(FindOneBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly translationService: TranslationService,
  ) { }

  async execute(term: string, lang: string, restaurantId?: string): Promise<BranchResponse> {
    const whereCondition: FindOptionsWhere<Branch>[] = [];

    if (isUUID(term)) {
      whereCondition.push({ id: term });
    } else {
      whereCondition.push({ phoneNumberAssistant: term });
    }

    if (restaurantId) {
      whereCondition.push({ restaurant: { id: restaurantId } });
    }

    const branch = await this.branchRepository.findOne({
      where: whereCondition,
      relations: {
        restaurant: { user: true },
        menus: {
          menuItems: { category: true, product: true },
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        phoneNumberAssistant: true,
        phoneNumberReception: true,
        surveyUrl: true,
        qrUrl: true,
        qrToken: true,
        availableMessages: true,
        restaurant: {
          name: true,
          user: { id: true },
        },
        menus: true,
      },
    });

    if (!branch) {
      this.logger.warn(`Search failed - Branch not found: ${term}`);
      throw new NotFoundException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }

    return {
      branch,
      message: this.translationService.translate('branches.branch_found', lang),
    };

  }

}


