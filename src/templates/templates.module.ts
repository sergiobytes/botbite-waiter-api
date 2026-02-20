import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { RenderTemplateUseCase } from './use-cases/render-template.use-case';
import { FindTemplateUseCase } from './use-cases/find-template.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([Template])],
  providers: [TemplatesService, RenderTemplateUseCase, FindTemplateUseCase],
  exports: [TemplatesService],
})
export class TemplatesModule {}
