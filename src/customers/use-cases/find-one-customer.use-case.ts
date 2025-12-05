import { isUUID } from 'class-validator';
import {
  CustomerResponse,
  FindCustomer,
} from '../interfaces/customers.interfaces';
import { NotFoundException } from '@nestjs/common';

export const findOneCustomerUseCase = async (
  params: FindCustomer,
): Promise<CustomerResponse> => {
  const { term, lang, repository, translationService } = params;

  const customer = await repository.findOne({
    where: isUUID(term)
      ? { id: term, isActive: true }
      : { phone: term, isActive: true },
  });

  if (!customer) {
    throw new NotFoundException(
      translationService.translate('customers.customer_not_found', lang),
    );
  }

  return {
    customer,
    message: translationService.translate('customers.customer_found', lang),
  };
};
