import { BadRequestException } from '@nestjs/common';
import {
  CreateCustomer,
  CustomerResponse,
} from '../interfaces/customers.interfaces';
import { findOneCustomerUseCase } from './find-one-customer.use-case';

export const createCustomerUseCase = async (
  params: CreateCustomer,
): Promise<CustomerResponse> => {
  const { dto, logger, lang, repository, translationService } = params;

  const { customer: existingCustomer } = await findOneCustomerUseCase({
    term: dto.phone,
    lang,
    repository,
    translationService,
  });

  if (existingCustomer) {
    logger.warn(
      `Create failed - Customer already exists with phone: ${dto.phone}`,
    );
    throw new BadRequestException(
      translationService.translate('customers.customer_already_exists', lang),
    );
  }

  const customer = repository.create(dto);
  await repository.save(customer);

  return {
    customer,
    message: translationService.translate('customers.customer_created', lang),
  };
};
