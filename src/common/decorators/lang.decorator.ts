import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Lang = createParamDecorator(
  (data: string, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const header = request.headers['accept-language'];

    return header?.split(',')[0]?.split('-')[0] ?? 'es';
  },
);
