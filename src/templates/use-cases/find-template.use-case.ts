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

  async execute(key: string): Promise<Template | null> {
    return this.templateRepository.findOne({
      where: { key, isActive: true },
    });
  }

  async executeByCategory(category: string): Promise<Template[]> {
    return this.templateRepository.find({
      where: { category, isActive: true },
    });
  }
}
