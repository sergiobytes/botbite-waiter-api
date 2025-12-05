import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TranslationService } from '../../common/services/translation.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { Customer } from '../entities/customer.entity';

export interface CreateCustomer {
  dto: CreateCustomerDto;
  logger: Logger;
  lang: string;
  repository: Repository<Customer>;
  translationService: TranslationService;
}

export interface UpdateCustomer {
  phone: string;
  dto: UpdateCustomerDto;
  lang: string;
  repository: Repository<Customer>;
  translationService: TranslationService;
  logger: Logger;
}

export interface RemoveCustomer {
  phone: string;
  lang: string;
  repository: Repository<Customer>;
  translationService: TranslationService;
  logger: Logger;
}

export interface FindCustomer {
  term: string;
  lang: string;
  repository: Repository<Customer>;
  translationService: TranslationService;
}

export interface CustomerResponse {
  customer: Customer;
  message: string;
}
