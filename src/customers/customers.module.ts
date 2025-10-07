import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { CommonModule } from '../common/common.module';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
  imports: [
    TypeOrmModule.forFeature([Customer]),
    CommonModule,
    CustomJwtModule,
  ],
  exports: [TypeOrmModule, CustomersService],
})
export class CustomersModule {}
