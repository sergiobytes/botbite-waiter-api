import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TranslationService {
  private readonly translation: Record<string, any> = {};

  constructor() {
    this.loadTranslations();
  }

  private loadTranslations() {
    const langs = ['es', 'en'];

    for (const lang of langs) {
      const filePath = path.join(
        process.cwd(),
        'src',
        'i18n',
        lang,
        'translation.json',
      );

      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        this.translation[lang] = JSON.parse(data);
      } catch (err) {
        console.log(err);
        console.warn(`⚠️ No se pudo cargar traducciones para '${lang}'`);
      }
    }
  }

  translate(
    key: string,
    lang: string = 'es',
    variables?: Record<string, string>,
  ): string {
    const keys = key.split('.');
    let result = this.translation[lang];

    for (const key of keys) {
      if (result && result[key]) result = result[key];
      else return key;
    }

    if (typeof result === 'string' && variables) {
      for (const [varName, value] of Object.entries(variables)) {
        const pattern = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
        result = result.replace(pattern, value);
      }
    }

    return result;
  }
}
