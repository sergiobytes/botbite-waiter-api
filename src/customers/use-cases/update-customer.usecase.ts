import { Logger, NotFoundException } from '@nestjs/common';
import { CustomerResponse } from '../interfaces/customers.interfaces';
import { FindOneCustomerUseCase } from './find-one-customer.usecase';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from '../entities/customer.entity';
import { Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

export class UpdateCustomerUseCase {
  private readonly logger = new Logger(UpdateCustomerUseCase.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly translationService: TranslationService,
    private readonly findOneCustomerUseCase: FindOneCustomerUseCase,
  ) { }

  async execute(phone: string, dto: UpdateCustomerDto, lang: string): Promise<CustomerResponse> {

    const { customer } = await this.findOneCustomerUseCase.execute(phone, lang);

    if (!customer) {
      throw new NotFoundException(
        this.translationService.translate('customers.customer_not_found', lang),
      );
    }

    Object.assign(customer, dto);
    await this.customerRepo.save(customer);

    this.logger.log(`Customer updated: ${customer.name} (${phone})`);

    return {
      customer,
      message: this.translationService.translate('customers.customer_updated', lang),
    };
  };
}