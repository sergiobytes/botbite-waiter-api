import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from '../entities/template.entity';
import {
  IRenderTemplateParams,
  ITemplateVariables,
} from '../interfaces/template.interface';

@Injectable()
export class RenderTemplateUseCase {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {}

  async execute(params: IRenderTemplateParams): Promise<string> {
    const { key, language, variables = {} } = params;

    const template = await this.templateRepository.findOne({
      where: { key, isActive: true },
    });

    if (!template) {
      throw new NotFoundException(`Template with key "${key}" not found`);
    }

    const content = template.content[language] || template.content['es'];
    return this.replaceVariables(content, variables);
  }

  private replaceVariables(
    content: string,
    variables: ITemplateVariables,
  ): string {
    let result = content;

    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(variables[key]));
    });

    result = this.handleEachLoop(result, variables);

    result = this.handleConditionals(result, variables);

    return result;
  }

  private handleEachLoop(
    content: string,
    variables: ITemplateVariables,
  ): string {
    const eachRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;

    return content.replace(eachRegex, (match, arrayKey, template) => {
      const array = variables[arrayKey];

      if (!Array.isArray(array)) {
        return '';
      }

      return array
        .map((item, index) => {
          let itemContent = template;

          Object.keys(item).forEach((key) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            itemContent = itemContent.replace(regex, String(item[key]));
          });

          itemContent = itemContent.replace(/{{@index}}/g, String(index + 1));

          return itemContent;
        })
        .join('');
    });
  }

  private handleConditionals(
    content: string,
    variables: ITemplateVariables,
  ): string {
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;

    return content.replace(
      ifRegex,
      (match, condition, trueBranch, falseBranch = '') => {
        const value = variables[condition];
        const isTrue = Boolean(value);

        return isTrue ? trueBranch : falseBranch;
      },
    );
  }
}
