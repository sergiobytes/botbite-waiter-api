import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import { CustomerResponse } from './interfaces/customers.interfaces';
import { createCustomerUseCase } from './use-cases/create-customer.use-case';
import { findOneCustomerUseCase } from './use-cases/find-one-customer.use-case';
import { removeCustomerUseCase } from './use-cases/remove-customer.use-case';
import { updateCustomerUseCase } from './use-cases/update-customer.use-case';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly translationService: TranslationService,
  ) {}

  async create(
    dto: CreateCustomerDto,
    lang: string,
  ): Promise<CustomerResponse> {
    return createCustomerUseCase({
      dto,
      logger: this.logger,
      lang,
      repository: this.customerRepo,
      translationService: this.translationService,
    });
  }

  async findByTerm(term: string, lang: string) {
    return findOneCustomerUseCase({
      term,
      lang,
      repository: this.customerRepo,
      translationService: this.translationService,
    });
  }

  async update(phone: string, dto: UpdateCustomerDto, lang: string) {
    return updateCustomerUseCase({
      phone,
      dto,
      logger: this.logger,
      lang,
      repository: this.customerRepo,
      translationService: this.translationService,
    });
  }

  async remove(phone: string, lang: string) {
    return removeCustomerUseCase({
      phone,
      logger: this.logger,
      lang,
      repository: this.customerRepo,
      translationService: this.translationService,
    });
  }
}
