import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Branch } from './entities/branch.entity';
import { ILike, Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Readable } from 'stream';
import { ICsvBranchtRow } from './interfaces/csv-branch-row.interface';
import * as csv from 'csv-parser';
import { isUUID } from 'class-validator';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { User } from '../users/entities/user.entity';
import { UserRoles } from '../users/enums/user-roles';
import { PaginationDto } from '../common/dto/pagination.dto';
import { FindBranchDto } from './dto/find-branch.dto';
import { createQr } from '../utils/create-qr';
import { uploadToCloudinary } from '../utils/upload-to-cloudinary';

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
  ) {
    const branch = this.branchRepository.create({
      ...createBranchDto,
      restaurant: { id: restaurantId },
    });

    await this.branchRepository.save(branch);

    return {
      message: this.translationService.translate(
        'branches.branch_created',
        lang,
      ),
    };
  }

  async bulkCreateBranches(
    restaurantId: string,
    file: Express.Multer.File,
    lang: string,
  ) {
    try {
      const stream = Readable.from(file.buffer.toString());
      const branches: CreateBranchDto[] = await this.parseCsvFile(stream);

      if (branches.length === 0) {
        throw new BadRequestException(
          this.translationService.translate('errors.empty_csv_file', lang),
        );
      }

      const branchesToSave = branches.map((branch) =>
        this.branchRepository.create({
          ...branch,
          restaurant: { id: restaurantId },
        }),
      );

      const savedBranches = await this.branchRepository.save(branchesToSave);

      this.logger.log(
        `Bulk created ${savedBranches.length} branches for restaurant: ${restaurantId}`,
      );

      return {
        branches: savedBranches,
        count: savedBranches.length,
        message: this.translationService.translate(
          'branches.branches_bulk_created',
          lang,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Bulk create failed for restaurant ${restaurantId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        this.translationService.translate('errors.csv_processing_failed', lang),
      );
    }
  }

  async update(
    branchId: string,
    restaurantId: string,
    updateBranchDto: UpdateBranchDto,
    user: User,
    lang: string,
  ) {
    const branch = await this.findByTerm(branchId, restaurantId);

    if (!branch) {
      this.logger.warn(`Update failed - Branch not found: ${branchId}`);
      throw new BadRequestException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }

    const canModifyAnyBranch =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
      this.logger.warn(
        `Update failed - User ${user.id} tried to modify branch ${branch.id} not owned by them`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.branch_not_owned', lang),
      );
    }
    Object.assign(branch, updateBranchDto);
    const updatedBranch = await this.branchRepository.save(branch);

    this.logger.log(
      `Branch updated: ${updatedBranch.name} by user: ${user.email}`,
    );

    return {
      branch: updatedBranch,
      message: this.translationService.translate(
        'branches.branch_updated',
        lang,
      ),
    };
  }

  async activateBranch(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    const branch = await this.findByTerm(branchId, restaurantId);

    if (!branch) {
      this.logger.warn(`Activate failed - Branch not found: ${branchId}`);
      throw new NotFoundException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }

    const canModifyAnyBranch =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
      this.logger.warn(
        `Activate failed - User ${user.id} tried to activate branch ${branch.id} not owned by them`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.branch_not_owned', lang),
      );
    }

    if (branch.isActive) {
      this.logger.warn(`Activate failed - Branch already active: ${branch.id}`);
      throw new BadRequestException(
        this.translationService.translate(
          'branches.branch_already_active',
          lang,
        ),
      );
    }

    branch.isActive = true;
    await this.branchRepository.save(branch);

    this.logger.log(`Branch activated: ${branch.id} by user: ${user.email}`);

    return {
      message: this.translationService.translate(
        'branches.branch_activated',
        lang,
      ),
    };
  }

  async deactivateBranch(
    branchId: string,
    restaurantId: string,
    user: User,
    lang: string,
  ) {
    const branch = await this.findByTerm(branchId, restaurantId);

    if (!branch) {
      this.logger.warn(`Activate failed - Branch not found: ${branchId}`);
      throw new NotFoundException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }

    const canModifyAnyBranch =
      user.roles.includes(UserRoles.ADMIN) ||
      user.roles.includes(UserRoles.SUPER);

    if (!canModifyAnyBranch && branch.restaurant.user.id !== user.id) {
      this.logger.warn(
        `Activate failed - User ${user.id} tried to activate branch ${branch.id} not owned by them`,
      );
      throw new BadRequestException(
        this.translationService.translate('errors.branch_not_owned', lang),
      );
    }

    if (!branch.isActive) {
      this.logger.warn(
        `Activate failed - Branch already inactive: ${branch.id}`,
      );
      throw new BadRequestException(
        this.translationService.translate(
          'branches.branch_already_inactive',
          lang,
        ),
      );
    }

    branch.isActive = false;
    await this.branchRepository.save(branch);

    this.logger.log(`Branch deactivated: ${branch.id} by user: ${user.email}`);

    return {
      message: this.translationService.translate(
        'branches.branch_deactivated',
        lang,
      ),
    };
  }

  async findByTerm(term: string, restaurantId: string) {
    const whereCondition = isUUID(term)
      ? [
          { id: term, restaurant: { id: restaurantId } },
          { name: term, restaurant: { id: restaurantId } },
        ]
      : [{ name: term, restaurant: { id: restaurantId } }];

    return await this.branchRepository.findOne({
      where: whereCondition,
      relations: {
        restaurant: {
          user: true,
        },
      },
      select: {
        id: true,
        name: true,
        address: true,
        assistantId: true,
        isActive: true,
        phoneNumberAssistant: true,
        phoneNumberReception: true,
        qrUrl: true,
        restaurant: {
          name: true,
          user: {
            id: true,
          },
        },
      },
    });
  }

  async findAllByRestaurant(
    restaurantId: string,
    paginationDto: PaginationDto,
    findBranchDto: FindBranchDto = {},
  ) {
    const { limit = 10, offset = 0 } = paginationDto;
    const { name, search, isActive } = findBranchDto;

    const whereConditions: any = { restaurant: { id: restaurantId } };

    if (name) {
      whereConditions.name = name;
    } else if (search) {
      whereConditions.name = ILike(`%${search}%`);
    }

    if (isActive !== undefined) {
      whereConditions.isActive = isActive;
    }

    const [branches, total] = await this.branchRepository.findAndCount({
      where: whereConditions,
      relations: {
        restaurant: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        restaurant: {
          name: true,
        },
      },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      branches,
      total,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  }

  async generateQrForBranch(
    branchId: string,
    restaurantId: string,
    lang: string,
  ) {
    const branch = await this.findByTerm(branchId, restaurantId);

    if (!branch) {
      this.logger.warn(`Update failed - Branch not found: ${branchId}`);
      throw new BadRequestException(
        this.translationService.translate('errors.branch_not_found', lang),
      );
    }

    const targetUrl = `https://wa.me/${branch.phoneNumberAssistant}?text=Hola!`;

    const finalImage = await createQr(targetUrl);
    const uploadedImageUrl = await uploadToCloudinary(
      finalImage,
      'botbite/branches',
      `qr-${branch.id}`,
    );

    branch.qrUrl = uploadedImageUrl;
    await this.branchRepository.save(branch);

    return {
      qrUrl: uploadedImageUrl,
    };
  }

  private parseCsvFile(stream: Readable): Promise<CreateBranchDto[]> {
    return new Promise((resolve, reject) => {
      const branches: CreateBranchDto[] = [];

      stream
        .pipe(csv())
        .on('data', (row: ICsvBranchtRow) => {
          if (row.nombre && row.nombre.trim()) {
            branches.push({
              name: row.nombre.trim(),
              address: row.direccion?.trim() || '',
            });
          }
        })
        .on('end', () => {
          resolve(branches);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}
