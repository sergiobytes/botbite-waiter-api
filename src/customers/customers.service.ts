import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { TranslationService } from '../common/services/translation.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { isUUID } from 'class-validator';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly translationService: TranslationService,
  ) {}

  async create(dto: CreateCustomerDto, lang: string) {
    const exists = await this.findByTerm(dto.phone, lang);

    if (exists.customer) {
      this.logger.warn(
        `Create failed - Customer already exists with phone: ${dto.phone}`,
      );
      throw new BadRequestException(
        this.translationService.translate(
          'customers.customer_already_exists',
          lang,
        ),
      );
    }

    const customer = this.customerRepo.create(dto);
    const savedCustomer = await this.customerRepo.save(customer);

    this.logger.log(
      `Customer created: ${savedCustomer.name} (${savedCustomer.phone})`,
    );

    return {
      customer: savedCustomer,
      message: this.translationService.translate(
        'customers.customer_created',
        lang,
      ),
    };
  }

  async findAll(paginationDto: PaginationDto, lang: string) {
    const { limit = 10, offset = 0 } = paginationDto;

    const customers = await this.customerRepo.find({
      where: { isActive: true },
      take: limit,
      skip: offset,
    });

    return {
      customers,
      message: this.translationService.translate(
        'customers.customers_found',
        lang,
      ),
    };
  }

  async findByTerm(term: string, lang: string) {
    const customer = await this.customerRepo.findOne({
      where: isUUID(term)
        ? { id: term, isActive: true }
        : { phone: term, isActive: true },
    });

    return {
      customer,
      message: this.translationService.translate(
        'customers.customer_found',
        lang,
      ),
    };
  }

  async update(phone: string, dto: UpdateCustomerDto, lang: string) {
    const customer = await this.findByTerm(phone, lang);

    if (!customer.customer) {
      throw new NotFoundException(
        this.translationService.translate('customers.customer_not_found', lang),
      );
    }

    Object.assign(customer, dto);
    const updatedCustomer = await this.customerRepo.save(customer.customer);

    this.logger.log(`Customer updated: ${updatedCustomer.name} (${phone})`);

    return {
      customer: updatedCustomer,
      message: this.translationService.translate(
        'customers.customer_updated',
        lang,
      ),
    };
  }

  async remove(phone: string, lang: string) {
    const customer = await this.findByTerm(phone, lang);

    if (!customer.customer) {
      throw new NotFoundException(
        this.translationService.translate('customers.customer_not_found', lang),
      );
    }

    customer.customer.isActive = false;

    await this.customerRepo.save(customer.customer);

    this.logger.log(`Customer deleted: ${customer.customer.name} (${phone})`);

    return {
      message: this.translationService.translate(
        'customers.customer_deleted',
        lang,
      ),
    };
  }
}
