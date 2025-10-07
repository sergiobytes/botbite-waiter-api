import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CustomJwtModule } from './custom-jwt/custom-jwt.module';
import { CustomPassportModule } from './custom-passport/custom-passport.module';
import { CustomThrottlerModule } from './custom-throttler/custom-throttler.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { BranchesModule } from './branches/branches.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    UsersModule,
    AuthModule,
    CustomJwtModule,
    CustomPassportModule,
    CustomThrottlerModule,
    RestaurantsModule,
    CategoriesModule,
    ProductsModule,
    BranchesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
