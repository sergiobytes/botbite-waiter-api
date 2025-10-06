import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy],
  imports: [TypeOrmModule.forFeature([User]), CustomJwtModule],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
