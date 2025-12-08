import { Logger } from '@nestjs/common';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';

export interface ICreateProductParams {
  restaurantId: string;
  dto: CreateProductDto;
  lang: string;
  repository: Repository<Product>;
  translationService: TranslationService;
}

export interface IBulkCreateProductParams {
  file: Express.Multer.File;
  repository: Repository<Product>;
  logger: Logger;
  translationService: TranslationService;
  restaurantId: string;
  lang: string;
}

export interface IFindProductParams {
  term: string;
  restaurantId: string;
  lang: string;
  repository: Repository<Product>;
  translationService: TranslationService;
  logger: Logger;
}

export interface IProductResponse {
  product: Product;
  message: string;
}

export interface IBulkCreateProductResponse {
  products: Product[];
  count: number;
  message: string;
}
