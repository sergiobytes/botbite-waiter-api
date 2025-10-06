import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      // Intentar verificar el token normalmente
      const payload = this.jwtService.verify(token);

      // Si llega aquí, el token es válido
      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
        select: ['id', 'email', 'roles', 'isActive'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User is inactive');
      }

      request.user = user;
      return true;
    } catch (error) {
      // Si el token está expirado, intentar decodificarlo sin verificar
      if (error.name === 'TokenExpiredError') {
        try {
          const payload = this.jwtService.decode(token);

          if (!payload || !payload.userId) {
            throw new UnauthorizedException('Invalid token structure');
          }

          // Buscar el usuario para validar que existe
          const user = await this.userRepository.findOne({
            where: { id: payload.userId },
            select: ['id', 'email', 'roles', 'isActive'],
          });

          if (!user) {
            throw new UnauthorizedException('User not found');
          }

          if (!user.isActive) {
            throw new UnauthorizedException('User is inactive');
          }

          // Agregar el usuario al request para que esté disponible
          request.user = user;
          return true;
        } catch (decodeError) {
          console.log(decodeError);
          throw new UnauthorizedException('Invalid expired token');
        }
      }

      // Otros errores (token malformado, etc.)
      throw new UnauthorizedException('Invalid token');
    }
  }
}
