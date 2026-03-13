import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from '../entities/template.entity';

@Injectable()
export class FindTemplateUseCase {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {}

  async execute(key: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { key, isActive: true },
    });

    if (!template) {
      throw new Error(`Template with key "${key}" not found`);
    }

    return template;
  }

  async executeByCategory(category: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: { category, isActive: true },
    });
  }
}
