import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { TranslationService } from '../../common/services/translation.service';
import { UsersService } from '../../users/users.service';
import { LoginUserDto } from '../dto/login-user.dto';
import { LoginResponse } from '../interfaces/auth.interfaces';

@Injectable()
export class LoginUseCase {
    private readonly logger = new Logger(LoginUseCase.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
        private readonly translationService: TranslationService
    ) { }

    async execute(loginUserDto: LoginUserDto, lang: string, ip: string): Promise<LoginResponse> {
        const { email, password } = loginUserDto;

        const loginStart = Date.now();

        this.logger.debug(`Login attempt for user: ${email} from IP: ${ip}`);

        const { user } = await this.usersService.findUserByTerm(email);

        let loginTime: number;

        if (!user) {
            loginTime = Date.now() - loginStart;
            this.logger.warn(`Failed login attempt - User not found: ${email} from IP: ${ip} (${loginTime}ms)`);
            throw new BadRequestException(this.translationService.translate('errors.user_not_found', lang));
        }

        if (!user.isActive) {
            loginTime = Date.now() - loginStart;
            this.logger.warn(`Failed login attempt - User inactive: ${email} from IP: ${ip} (${loginTime}ms)`,);
            throw new BadRequestException(this.translationService.translate('errors.user_inactive', lang),);
        }

        const isValidPassword = await argon2.verify(user.password, password);

        if (!isValidPassword) {
            loginTime = Date.now() - loginStart;
            this.logger.warn(`Failed login attempt - Invalid credentials: ${email} from IP: ${ip} (${loginTime}ms)`,);
            throw new BadRequestException(this.translationService.translate('errors.invalid_credentials', lang),);
        }

        loginTime = Date.now() - loginStart;
        this.logger.log(`Successful login for user: ${email} (${user.roles.join(', ')}) from IP: ${ip} (${loginTime}ms)`,);

        const accessPayload = { userId: user.id, type: 'access' };
        const refreshPayload = { userId: user.id, type: 'refresh' };

        const accessToken = this.jwtService.sign(accessPayload);

        const refreshTokenExpiry = this.configService.get('JWT_REFRESH_EXPIRY', '7d');

        const refreshToken = this.jwtService.sign(refreshPayload, {
            expiresIn: refreshTokenExpiry,
        });

        return {
            message: this.translationService.translate('auth.welcome', lang),
            access_token: accessToken,
            refresh_token: refreshToken,
        };
    }


}