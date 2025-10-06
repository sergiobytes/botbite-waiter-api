import { Module } from '@nestjs/common';
import { TranslationService } from './services/translation.service';

@Module({
  providers: [TranslationService],
  exports: [TranslationService],
})
export class CommonModule {}
