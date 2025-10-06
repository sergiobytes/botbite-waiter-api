import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { TranslationService } from '../common/services/translation.service';
import { isUUID } from 'class-validator';
import { RegsiterUserDto } from './dto/register-user';

import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly translationService: TranslationService,
  ) {}

  async registerUser(registerUserDto: RegsiterUserDto, lang: string) {
    const { email, password } = registerUserDto;

    const [userExists, hashedPassword] = await Promise.all([
      this.findUserByTerm(email),
      argon2.hash(password),
    ]);

    if (userExists) {
      this.logger.warn(`User registration failed - User exists: ${email}`);
      throw new BadRequestException(
        this.translationService.translate('errors.user_exists', lang),
      );
    }

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    return {
      message: this.translationService.translate(
        'auth.registration_success',
        lang,
      ),
    };
  }

  async findUserByTerm(term: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: isUUID(term) ? [{ id: term }, { email: term }] : { email: term },
      select: ['id', 'email', 'password', 'roles', 'createdAt', 'updatedAt'],
    });
  }

  sanitizeUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
    };
  }
}
