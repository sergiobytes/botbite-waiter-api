import { User } from '../../users/entities/user.entity';
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) throw new InternalServerErrorException('Something went wrong');

    return !data ? user : user[data];
  },
);
