import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTemplateDto } from './dto/create-template.dto';
import { Template } from './entities/template.entity';
import { IRenderTemplateParams } from './interfaces/template.interface';
import { CreateTemplateUseCase } from './use-cases/create-template.use-case';
import { FindTemplateUseCase } from './use-cases/find-template.use-case';
import { RenderTemplateUseCase } from './use-cases/render-template.use-case';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
    private readonly renderTemplateUseCase: RenderTemplateUseCase,
    private readonly findTemplateUseCase: FindTemplateUseCase,
    private readonly createTemplateUseCase: CreateTemplateUseCase,
  ) {}

  async create(createTemplateDto: CreateTemplateDto): Promise<Template> {
    return this.createTemplateUseCase.execute(createTemplateDto);
  }

  async findByKey(key: string): Promise<Template> {
    return this.findTemplateUseCase.execute(key);
  }

  async findAll(): Promise<Template[]> {
    return this.templateRepository.find({ where: { isActive: true } });
  }

  async findByCategory(category: string): Promise<Template[]> {
    return this.findTemplateUseCase.executeByCategory(category);
  }

  async render(params: IRenderTemplateParams): Promise<string> {
    return this.renderTemplateUseCase.execute(params);
  }

  async bulkCreate(templates: CreateTemplateDto[]): Promise<Template[]> {
    return this.createTemplateUseCase.bulkCreate(templates);
  }

  async update(key: string, updateData: UpdateTemplateDto): Promise<Template> {
    const template = await this.findByKey(key);
    Object.assign(template, updateData);
    return this.templateRepository.save(template);
  }

  async deactivate(key: string): Promise<Template> {
    const template = await this.findByKey(key);
    template.isActive = false;
    return this.templateRepository.save(template);
  }

  async activate(key: string): Promise<Template> {
    const template = await this.findByKey(key);
    template.isActive = true;
    return this.templateRepository.save(template);
  }
}
