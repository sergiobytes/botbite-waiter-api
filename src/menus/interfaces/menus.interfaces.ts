import { Logger } from 'openai/client';
import { CreateMenuDto } from '../dto/create-menu.dto';
import { Repository } from 'typeorm';
import { Menu } from '../entities/menu.entity';
import { TranslationService } from '../../common/services/translation.service';

export interface CreateMenu {
  branchId: string;
  lang: string;
  dto: CreateMenuDto;
  logger: Logger;
  repository: Repository<Menu>;
  translationService: TranslationService;
}
