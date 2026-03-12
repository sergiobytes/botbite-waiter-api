import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
// import { CacheService } from '../../common/services/cache.service'; // ⚠️ Cache deshabilitado
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly maxRequests: number;
  private readonly windowSeconds: number;

  constructor(
    // private readonly cacheService: CacheService, // ⚠️ Cache deshabilitado
    private readonly configService: ConfigService,
  ) {
    this.maxRequests = this.configService.get<number>('RATE_LIMIT_MAX') || 10;
    this.windowSeconds = this.configService.get<number>('RATE_LIMIT_TTL') || 60;
    this.logger.warn('⚠️ RateLimitMiddleware: Cache deshabilitado - rate limiting no funciona');
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // ⚠️ Rate limiting deshabilitado - siempre permite todas las requests ⚠️
    this.logger.log('⚠️ Rate limit middleware: DESHABILITADO - permitiendo request');
    next();

    // this.logger.log('🔍 Rate limit middleware triggered');
    // try {
    //   // Extraer número de teléfono del body (Twilio webhook)
    //   const phoneNumber = req.body?.From || req.ip;
    //   this.logger.log(`📱 Phone number: ${phoneNumber}`);

    //   if (!phoneNumber) {
    //     this.logger.log('⚠️ No phone number, skipping rate limit');
    //     return next();
    //   }

    //   const { allowed, remaining, resetIn } =
    //     await this.cacheService.checkRateLimit(
    //       phoneNumber,
    //       this.maxRequests,
    //       this.windowSeconds,
    //     );

    //   // Agregar headers de rate limit
    //   res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
    //   res.setHeader('X-RateLimit-Remaining', remaining.toString());
    //   res.setHeader('X-RateLimit-Reset', resetIn.toString());

    //   if (!allowed) {
    //     this.logger.warn(
    //       `⚠️ Rate limit exceeded for ${phoneNumber}. Rejecting request.`,
    //     );

    //     return res.status(429).json({
    //       statusCode: 429,
    //       message: `Too many requests. Please try again in ${resetIn} seconds.`,
    //       error: 'Too Many Requests',
    //     });
    //   }

    //   this.logger.log('✅ Rate limit passed, calling next()');
    //   next();
    // } catch (error) {
    //   this.logger.error('Error in rate limit middleware:', error);
    //   // En caso de error, permitir la request
    //   next();
    // }
  }
}
