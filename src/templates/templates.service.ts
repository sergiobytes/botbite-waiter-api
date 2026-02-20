import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { Repository } from 'typeorm';
import { RenderTemplateUseCase } from './use-cases/render-template.use-case';
import { FindTemplateUseCase } from './use-cases/find-template.use-case';
import { CreateTemplateDto } from './dto/create-template.dto';
import { IRenderTemplateParams } from './interfaces/template.interface';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    private readonly renderTemplateUseCase: RenderTemplateUseCase,
    private readonly findTemplateUseCase: FindTemplateUseCase,
  ) {}

  async create(createTemplateDto: CreateTemplateDto): Promise<Template> {
    const template = this.templateRepository.create(createTemplateDto);
    return this.templateRepository.save(template);
  }

  async findByKey(key: string): Promise<Template | null> {
    return this.findTemplateUseCase.execute(key);
  }

  async findAll(): Promise<Template[]> {
    return this.templateRepository.find({ where: { isActive: true } });
  }

  async render(params: IRenderTemplateParams): Promise<string> {
    return this.renderTemplateUseCase.execute(params);
  }

  async bulkCreate(templates: CreateTemplateDto[]): Promise<Template[]> {
    const entities = this.templateRepository.create(templates);
    return this.templateRepository.save(entities);
  }
}
