import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TranslationService } from '../../common/services/translation.service';
import { User } from '../../users/entities/user.entity';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { FindBranchDto } from '../dto/find-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { Branch } from '../entities/branch.entity';

export interface CsvBranchRow {
  nombre: string;
  direccion: string;
}

export interface CreateBranch {
  dto: CreateBranchDto;
  repository: Repository<Branch>;
  translationService: TranslationService;
  restaurantId: string;
  lang: string;
}

export interface UpdateBranch {
  dto: UpdateBranchDto;
  user: User;
  repository: Repository<Branch>;
  logger: Logger;
  translationService: TranslationService;
  branchId: string;
  restaurantId: string;
  lang: string;
}

export interface ChangeBranchStatus {
  user: User;
  repository: Repository<Branch>;
  logger: Logger;
  translationService: TranslationService;
  branchId: string;
  restaurantId: string;
  status: boolean;
  lang: string;
}

export interface FindBranches {
  term: string;
  logger: Logger;
  repository: Repository<Branch>;
  translationService: TranslationService;
  restaurantId?: string;
  lang: string;
}

export interface BranchesByRestaurant {
  restaurantId: string;
  paginationDto: PaginationDto;
  findBranchDto: FindBranchDto;
  repository: Repository<Branch>;
}

export interface BulkCreateBranches {
  file: Express.Multer.File;
  repository: Repository<Branch>;
  logger: Logger;
  translationService: TranslationService;
  restaurantId: string;
  lang: string;
}

export interface QrGeneration {
  branchId: string;
  restaurantId: string;
  lang: string;
  logger: Logger;
  repository: Repository<Branch>;
  translationService: TranslationService;
}

export interface BranchResponse {
  branch: Branch;
  message: string;
}

export interface BulkCreateBranchesResponse {
  branches: Branch[];
  count: number;
  message: string;
}

export interface BranchListResponse {
  branches: Branch[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface QrGenerationResponse {
  qrUrl: string;
}
