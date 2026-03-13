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
  ) { }

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

    // Primero manejar variables anidadas como {{object.property}}
    Object.keys(variables).forEach((key) => {
      const value = variables[key];

      // Si el valor es un objeto, reemplazar propiedades anidadas
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.keys(value).forEach((nestedKey) => {
          const nestedValue = value[nestedKey];
          const stringValue =
            nestedValue !== null && nestedValue !== undefined
              ? String(nestedValue)
              : '';
          const nestedRegex = new RegExp(`{{${key}\\.${nestedKey}}}`, 'g');
          result = result.replace(nestedRegex, stringValue);
        });
      }

      // Luego reemplazar variables simples
      const stringVariable =
        value !== null && value !== undefined
          ? typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)
          : '';
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, stringVariable);
    });

    result = this.handleEachLoop(result, variables);

    result = this.handleConditionals(result, variables);

    // Procesar caracteres escapados (\n, \t, etc)
    result = result.replace(/\\n/g, '\n');
    result = result.replace(/\\t/g, '\t');

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

          // Manejar condicionales {{#if this.property}} dentro del loop
          const ifThisRegex = /{{#if\s+this\.(\w+)}}([\s\S]*?){{\/if}}/g;
          itemContent = itemContent.replace(ifThisRegex, (match, prop, trueBranch) => {
            const value = item[prop];
            const isTrue = Boolean(value);
            return isTrue ? trueBranch : '';
          });

          // Reemplazar variables {{this.property}}
          Object.keys(item).forEach((key) => {
            const value = item[key];
            const stringVariable =
              value !== null && value !== undefined
                ? typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)
                : '';

            // Reemplazar tanto {{this.key}} como {{key}}
            const thisRegex = new RegExp(`{{this\\.${key}}}`, 'g');
            const directRegex = new RegExp(`{{${key}}}`, 'g');
            itemContent = itemContent.replace(thisRegex, stringVariable);
            itemContent = itemContent.replace(directRegex, stringVariable);
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
    // Manejar {{#if object.property}}
    const ifNestedRegex = /{{#if\s+(\w+)\.(\w+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    let result = content.replace(
      ifNestedRegex,
      (match, objKey, propKey, trueBranch, falseBranch = '') => {
        const obj = variables[objKey];
        const value = obj && typeof obj === 'object' ? obj[propKey] : undefined;
        const isTrue = Boolean(value);
        return isTrue ? trueBranch : falseBranch;
      },
    );

    // Manejar {{#if property}} simple
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?)(?:{{else}}([\s\S]*?))?{{\/if}}/g;
    result = result.replace(
      ifRegex,
      (match, condition, trueBranch, falseBranch = '') => {
        const value = variables[condition];
        const isTrue = Boolean(value);
        return isTrue ? trueBranch : falseBranch;
      },
    );

    return result;
  }
}
