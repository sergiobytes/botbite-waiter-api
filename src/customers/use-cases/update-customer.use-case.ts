import { NotFoundException } from '@nestjs/common';
import {
  CustomerResponse,
  UpdateCustomer,
} from '../interfaces/customers.interfaces';
import { findOneCustomerUseCase } from './find-one-customer.use-case';

export const updateCustomerUseCase = async (
  params: UpdateCustomer,
): Promise<CustomerResponse> => {
  const { phone, dto, logger, lang, repository, translationService } = params;

  const { customer } = await findOneCustomerUseCase({
    term: phone,
    lang,
    repository,
    translationService,
  });

  if (!customer) {
    throw new NotFoundException(
      translationService.translate('customers.customer_not_found', lang),
    );
  }

  Object.assign(customer, dto);
  await repository.save(customer);

  logger.log(`Customer updated: ${customer.name} (${phone})`);

  return {
    customer,
    message: translationService.translate('customers.customer_updated', lang),
  };
};
