import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CustomJwtModule } from './custom-jwt/custom-jwt.module';
import { CustomPassportModule } from './custom-passport/custom-passport.module';

@Module({
  imports: [DatabaseModule, CommonModule, UsersModule, AuthModule, CustomJwtModule, CustomPassportModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
