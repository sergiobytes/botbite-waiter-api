import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from './enums/user-roles';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register-user')
  @Auth([UserRoles.ADMIN])
  registerUser(@Body() registerUserDto: RegisterUserDto, @Lang() lang: string) {
    return this.usersService.registerUser(registerUserDto, lang);
  }

  @Post('register-client')
  @Auth([UserRoles.ADMIN])
  registerClient(
    @Body() registerUserDto: RegisterUserDto,
    @Lang() lang: string,
  ) {
    return this.usersService.registerClient(registerUserDto, lang);
  }

  @Patch('deactivate-user/:id')
  @Auth([UserRoles.ADMIN])
  deactivateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    return this.usersService.deactivateUser(userId, lang);
  }

  @Patch('activate-user/:id')
  @Auth([UserRoles.ADMIN])
  activateUser(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    if (user.id === userId) {
      throw new Error('You cannot activate your own user');
    }
    return this.usersService.activateUser(userId, lang);
  }

  @Patch('add-admin-role/:id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  addAdminRole(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    if (user.id === userId) {
      throw new Error('You cannot assign yourself the admin role');
    }
    return this.usersService.addAdminRoleToUser(userId, lang);
  }

  @Patch('remove-admin-role/:id')
  @Auth([UserRoles.SUPER])
  removeAdminRole(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Lang() lang: string,
  ) {
    if (user.id === userId) {
      throw new Error('You cannot remove your own admin role');
    }
    return this.usersService.removeAdminRoleFromUser(userId, lang);
  }
}
