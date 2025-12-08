import { Readable } from 'stream';
import { CreateProductDto } from '../dto/create-product.dto';
import { ICsvProductRow } from '../interfaces/csv-product-row.interface';
import * as csv from 'csv-parser';
import {
  IBulkCreateProductParams,
  IBulkCreateProductResponse,
} from '../interfaces/products.interfaces';
import { BadRequestException } from '@nestjs/common';

export const bulkCreateProductsUseCase = async (
  params: IBulkCreateProductParams,
): Promise<IBulkCreateProductResponse> => {
  const { file, repository, logger, translationService, restaurantId, lang } =
    params;

  try {
    const stream = Readable.from(file.buffer.toString());
    const products: CreateProductDto[] = await parseProductsCsvFile(stream);

    if (products.length === 0) {
      throw new BadRequestException(
        translationService.translate('errors.empty_csv_file', lang),
      );
    }

    const productsToSave = products.map((product) =>
      repository.create({
        ...product,
        restaurant: { id: restaurantId },
      }),
    );

    await repository.save(productsToSave);

    logger.log(
      `Bulk created ${productsToSave.length} products for restaurant: ${restaurantId}`,
    );

    return {
      products: productsToSave,
      count: productsToSave.length,
      message: translationService.translate(
        'products.products_bulk_created',
        lang,
        { count: productsToSave.length.toString() },
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

const parseProductsCsvFile = (
  stream: Readable,
): Promise<CreateProductDto[]> => {
  return new Promise((resolve, reject) => {
    const products: CreateProductDto[] = [];

    stream
      .pipe(csv())
      .on('data', (row: ICsvProductRow) => {
        if (row.nombre && row.nombre.trim()) {
          products.push({
            name: row.nombre.trim(),
            description: row.descripcion?.trim() || '',
          });
        }
      })
      .on('end', () => {
        resolve(products);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};
