import { Customer } from '../entities/customer.entity';

export interface CustomerResponse {
  customer: Customer | null;
  message: string;
}
