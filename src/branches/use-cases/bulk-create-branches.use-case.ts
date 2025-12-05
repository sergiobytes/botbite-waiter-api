import { BadRequestException } from '@nestjs/common';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { CreateBranchDto } from '../dto/create-branch.dto';
import {
    BulkCreateBranches,
    BulkCreateBranchesResponse,
    CsvBranchRow,
} from '../interfaces/branches.interfaces';

export const bulkCreateBranchesUseCase = async (
  params: BulkCreateBranches,
): Promise<BulkCreateBranchesResponse> => {
  const { file, repository, logger, translationService, restaurantId, lang } =
    params;

  try {
    const stream = Readable.from(file.buffer.toString());

    const branches: CreateBranchDto[] = await parseBranchesCsvFile(stream);

    if (branches.length === 0) {
      throw new BadRequestException(
        translationService.translate('errors.empty_csv_file', lang),
      );
    }

    const newBranches = branches.map((branch) =>
      repository.create({ ...branch, restaurant: { id: restaurantId } }),
    );

    await repository.save(newBranches);

    logger.log(
      `Bulk created ${newBranches.length} branches for restaurant: ${restaurantId}`,
    );

    return {
      branches: newBranches,
      count: newBranches.length,
      message: translationService.translate(
        'branches.branches_bulk_created',
        lang,
      ),
    };
  } catch (error) {
    logger.error(
      `Bulk create failed for restaurant ${restaurantId}: ${error.message}`,
      error.stack,
    );

    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(
      translationService.translate('errors.csv_processing_failed', lang),
    );
  }
};

const parseBranchesCsvFile = (stream: Readable): Promise<CreateBranchDto[]> => {
  return new Promise((resolve, reject) => {
    const branches: CreateBranchDto[] = [];

    stream
      .pipe(csv())
      .on('data', (row: CsvBranchRow) => {
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
};
