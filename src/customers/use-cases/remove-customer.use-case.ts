import {
    CustomerResponse,
    RemoveCustomer,
} from '../interfaces/customers.interfaces';
import { findOneCustomerUseCase } from './find-one-customer.use-case';

export const removeCustomerUseCase = async (
  params: RemoveCustomer,
): Promise<CustomerResponse> => {
  const { phone, logger, lang, repository, translationService } = params;

  const { customer } = await findOneCustomerUseCase({
    term: phone,
    lang,
    repository,
    translationService,
  });

  customer.isActive = false;
  await repository.save(customer);

  logger.log(`Customer deleted: ${customer.name} (${phone})`);

  return {
    customer,
    message: translationService.translate('customers.customer_deleted', lang),
  };
};
