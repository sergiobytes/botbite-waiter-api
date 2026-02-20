import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Template } from '../entities/template.entity';
import { Repository } from 'typeorm';
import { CreateTemplateDto } from '../dto/create-template.dto';

@Injectable()
export class CreateTemplateUseCase {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {}

  async execute(createTemplateDto: CreateTemplateDto): Promise<Template> {
    const existingTemplate = await this.templateRepository.findOne({
      where: { key: createTemplateDto.key },
    });

    if (existingTemplate) {
      throw new ConflictException(
        `A template with the key '${createTemplateDto.key}' already exists.`,
      );
    }

    const template = this.templateRepository.create(createTemplateDto);
    return this.templateRepository.save(template);
  }

  async bulkCreate(templates: CreateTemplateDto[]): Promise<Template[]> {
    const results: Template[] = [];

    for (const templateDto of templates) {
      try {
        const template = await this.execute(templateDto);
        results.push(template);
      } catch (error) {
        if (error instanceof ConflictException) continue;
        throw error;
      }
    }

    return results;
  }
}
