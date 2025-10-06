import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      ssl: process.env.NODE_ENV === 'production' ? true : false,
      extra: {
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : null,
      },
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      synchronize: false,
      autoLoadEntities: true,
      migrations: ['dist/database/migrations/*.js'],
      migrationsRun: process.env.NODE_ENV === 'production',
      migrationsTableName: 'migrations',
    }),
  ],
})
export class DatabaseModule {}
