import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslationService } from '../../common/services/translation.service';

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly logger = new Logger(LoginThrottleGuard.name);
  private readonly failedAttempts = new Map<string, LoginAttempt>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly translation: TranslationService,
  ) {
    this.maxAttempts = parseInt(
      this.configService.get('THROTTLE_LOGIN_LIMIT', '5'),
    );
    this.windowMs =
      parseInt(this.configService.get('THROTTLE_TTL', '60')) * 1000;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection.remoteAddress;
    const lang = request.headers['accept-language']?.split(',')[0] || 'es';

    // Obtener intentos previos para esta IP
    const attempts = this.getAttempts(ip);
    const now = Date.now();

    // Limpiar intentos antiguos
    if (attempts && now - attempts.firstAttempt > this.windowMs) {
      this.failedAttempts.delete(ip);
      return true;
    }

    // Verificar si ha excedido el límite
    if (attempts && attempts.count >= this.maxAttempts) {
      const remainingTime = Math.ceil(
        (this.windowMs - (now - attempts.firstAttempt)) / 1000,
      );

      this.logger.warn(
        `Login throttled for IP ${ip}. ${attempts.count} failed attempts.`,
      );

      throw new BadRequestException(
        this.translation.translate('errors.too_many_requests', lang, {
          seconds: remainingTime.toString(),
        }),
      );
    }

    return true;
  }

  // Método público para registrar intento fallido
  recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const attempts = this.getAttempts(ip);

    if (!attempts) {
      this.failedAttempts.set(ip, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
    } else {
      // Si han pasado más del tiempo de ventana, reiniciar contador
      if (now - attempts.firstAttempt > this.windowMs) {
        this.failedAttempts.set(ip, {
          count: 1,
          firstAttempt: now,
          lastAttempt: now,
        });
      } else {
        // Incrementar contador
        attempts.count++;
        attempts.lastAttempt = now;
      }
    }

    this.logger.warn(
      `Failed login attempt recorded for IP ${ip}. Total: ${this.getAttempts(ip)?.count}`,
    );
  }

  // Método público para limpiar intentos tras login exitoso
  clearFailedAttempts(ip: string): void {
    if (this.failedAttempts.has(ip)) {
      this.failedAttempts.delete(ip);
      this.logger.log(
        `Cleared failed attempts for IP ${ip} after successful login`,
      );
    }
  }

  private getAttempts(ip: string): LoginAttempt | undefined {
    return this.failedAttempts.get(ip);
  }
}
