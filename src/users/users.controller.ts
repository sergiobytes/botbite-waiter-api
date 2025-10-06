import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from './enums/user-roles';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register-user')
  @Auth([UserRoles.ADMIN])
  registerUser(@Body() registerUserDto: RegisterUserDto, @Lang() lang: string) {
    return this.usersService.registerUser(registerUserDto, lang);
  }
}
