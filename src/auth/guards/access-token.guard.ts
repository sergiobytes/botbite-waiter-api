import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.jwtService.verify(token);
      
      // Validar que sea un access token
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type. Access token required.');
      }

      return true;
    } catch (error) {
      // Si es una UnauthorizedException que ya lanzamos, la re-lanzamos
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Para otros errores (JWT inválido, expirado, etc.)
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
