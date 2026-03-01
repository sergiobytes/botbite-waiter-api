import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { CommonModule } from '../common/common.module';
import { CreateCustomerUseCase } from './use-cases/create-customer.usecase';
import { FindOneCustomerUseCase } from './use-cases/find-one-customer.usecase';
import { UpdateCustomerUseCase } from './use-cases/update-customer.usecase';
import { RemoveCustomerUseCase } from './use-cases/remove-customer.usecase';


@Module({
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CreateCustomerUseCase,
    FindOneCustomerUseCase,
    UpdateCustomerUseCase,
    RemoveCustomerUseCase
  ],
  imports: [
    TypeOrmModule.forFeature([Customer]),
    CommonModule,
    CustomJwtModule,
  ],
  exports: [TypeOrmModule, CustomersService],
})
export class CustomersModule { }
