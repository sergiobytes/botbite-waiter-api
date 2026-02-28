import { Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginResponse, RefreshTokenResponse, } from './interfaces/auth.interfaces';
import { LoginUseCase } from './use-cases/login.usecase';
import { RefreshTokenUseCase } from './use-cases/refresh-token.usecase';
@Injectable()
export class AuthService {

  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase
  ) { }

  async login(loginUserDto: LoginUserDto, lang: string, ip: string,): Promise<LoginResponse> {
    return await this.loginUseCase.execute(loginUserDto, lang, ip);
  }

  async refreshToken(
    refreshToken: string,
    currentUser: User,
    lang: string,
  ): Promise<RefreshTokenResponse> {
    return await this.refreshTokenUseCase.execute(refreshToken, currentUser, lang);
  }
}
