import { Module } from '@nestjs/common';
import { TranslationService } from './services/translation.service';
import { CacheService } from './services/cache.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [TranslationService, CacheService],
  exports: [TranslationService, CacheService],
})
export class CommonModule {}
