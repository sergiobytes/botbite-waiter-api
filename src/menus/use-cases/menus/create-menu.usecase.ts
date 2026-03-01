import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FindOneBranchUseCase } from '../../../branches/use-cases/find-one-branch.usecase';
import { TranslationService } from '../../../common/services/translation.service';
import { CreateMenuDto } from '../../dto/create-menu.dto';
import { Menu } from '../../entities/menu.entity';
import { MenuResponse } from '../../interfaces/menus.interfaces';

@Injectable()
export class CreateMenuUseCase {

  private readonly logger = new Logger(CreateMenuUseCase.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly translationService: TranslationService,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) { }

  async execute(branchId: string, createMenuDto: CreateMenuDto, lang: string,): Promise<MenuResponse> {
    await this.findOneBranchUseCase.execute(branchId, lang);

    const menu = this.menuRepository.create({ ...createMenuDto, branchId });
    await this.menuRepository.save(menu);

    this.logger.log(`Menu created: ${menu.name} for branch: ${branchId}`);

    return {
      menu, message: this.translationService.translate('menus.menu_created', lang),
    };
  };
}
