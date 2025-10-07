import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly translationService: TranslationService,
  ) {}

  async create(
    restaurantId: string,
    createProductDto: CreateProductDto,
    lang: string,
  ) {
    const product = this.productRepository.create({
      ...createProductDto,
      restaurant: { id: restaurantId },
    });

    await this.productRepository.save(product);
    return {
      message: this.translationService.translate(
        'products.product_created',
        lang,
      ),
    };
  }

  async bulkCreate() {}

  async activateProduct() {}

  async deactivateProduct() {}

  async findByTerm() {}

  async findAllByRestaurant() {}
}
