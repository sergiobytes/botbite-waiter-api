import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { OpenAIService } from './services/openai.service';
import { MenusService } from '../menus/menus.service';
import { ProductsService } from '../products/products.service';
import { Branch } from '../branches/entities/branch.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AssistantResult } from './models/assistant-result';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(forwardRef(() => OpenAIService))
    private readonly openAIService: OpenAIService,
    private readonly menusService: MenusService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Procesa un mensaje del cliente y devuelve la respuesta del asistente
   */
  async processMessage(
    branch: Branch,
    customer: Customer,
    message: string,
    threadId?: string,
  ): Promise<AssistantResult> {
    try {
      // 1. Validar que la branch tenga un asistente registrado
      if (!branch.assistantId) {
        throw new BadRequestException(
          `Branch '${branch.name}' does not have an assistant configured`,
        );
      }

      this.logger.log(
        `Processing message for branch: ${branch.name} with assistant: ${branch.assistantId}`,
      );

      // 2. Obtener o crear el threadID del cliente
      if (!threadId) {
        threadId = await this.openAIService.createThread();
        this.logger.log(
          `Created new thread for customer ${customer.name}: ${threadId}`,
        );
      } else {
        this.logger.log(
          `Using existing thread for customer ${customer.name}: ${threadId}`,
        );
      }

      // 3. Preparar el contexto del cliente
      const customerContext = {
        customer: {
          name: customer.name,
          phone: customer.phone,
        },
        branch: {
          id: branch.id,
          name: branch.name,
          address: branch.address,
        },
        restaurant: {
          name: branch.restaurant.name,
        },
      };

      // 4. Enviar mensaje al asistente
      const response = await this.openAIService.sendMessageToAssistant(
        branch.assistantId,
        threadId,
        message,
        customerContext,
      );

      this.logger.log(
        `Assistant response generated for customer ${customer.name}`,
      );

      return {
        response,
        threadId,
      };
    } catch (error) {
      this.logger.error('Error processing message with assistant:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      // Respuesta de fallback si hay error con OpenAI
      return {
        response:
          'Lo siento, estoy teniendo problemas técnicos en este momento. ¿Puedes intentar de nuevo en unos minutos?',
        threadId: threadId || 'error',
      };
    }
  }

  async getMenu(branchId: string) {
    try {
      const menu = await this.menusService.findMenusByBranch(branchId, 'en');

      return {
        status: 'success',
        data: menu.menus,
      };
    } catch (error) {
      this.logger.error('Error getting menu:', error);
      return {
        status: 'error',
        message: 'No se pudo obtener el menú',
      };
    }
  }
}
