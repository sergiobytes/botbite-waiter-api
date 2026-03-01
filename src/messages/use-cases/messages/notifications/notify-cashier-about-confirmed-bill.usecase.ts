import { Injectable, Logger } from '@nestjs/common';
import { BranchesService } from '../../../../branches/branches.service';
import { Branch } from '../../../../branches/entities/branch.entity';
import { Customer } from '../../../../customers/entities/customer.entity';
import { OrdersService } from '../../../../orders/orders.service';
import { ConversationService } from '../../../services/conversation.service';
import { TwilioService } from '../../../services/twilio.service';
import { extractTableInfoFromConversationUtil } from '../../../utils/extract-table-information-from-conversation.util';
import { CreateOrderAfterBillRequestUseCase } from '../create-order-after-bill-request.usecase';
import { SendMessageUseCase } from '../send-message.usecase';

@Injectable()
export class NotifyCashierAboutConfirmedBillUseCase {
  private readonly logger = new Logger(NotifyCashierAboutConfirmedBillUseCase.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly twilioService: TwilioService,
    private readonly branchesService: BranchesService,
    private readonly ordersService: OrdersService,
    private readonly createOrderAfterBillRequestUseCase: CreateOrderAfterBillRequestUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
  ) { }

  async execute(from: string, paymentMethod: string, branch: Branch, customer: Customer): Promise<void> {
    try {
      const conversation = await this.conversationService.getOrCreateConversation(
        from,
        branch.id,
      );

      const orderFromField = conversation.lastOrderSentToCashier;

      if (!orderFromField || Object.keys(orderFromField).length === 0) {
        this.logger.warn('No order found in lastOrderSentToCashier field');
        return;
      }

      this.logger.log(
        `Using order from lastOrderSentToCashier: ${JSON.stringify(orderFromField)}`,
      );

      // Usar la ubicación guardada en la conversación, o extraerla si no existe
      let tableInfo = conversation.location;
      if (!tableInfo) {
        try {
          tableInfo = await extractTableInfoFromConversationUtil(
            conversation.conversationId,
            this.conversationService,
            this.logger,
          );
          // Guardar la ubicación en la conversación si se acaba de extraer
          await this.conversationService.updateConversationLocation(
            conversation.conversationId,
            tableInfo,
          );
        } catch (error) {
          // Enviar el mensaje de error al cliente (recepción)
          await this.sendMessageUseCase.execute(branch.phoneNumberReception!, error.message || 'Could not identify the table or location. Could you please specify which table or area you are referring to?', branch.phoneNumberAssistant!);
          this.logger.warn('Could not identify the table or location, message sent to reception.',);
          return;
        }
      }

      let totalAmount = 0;
      for (const [, { price, quantity }] of Object.entries(orderFromField)) {
        totalAmount += price * quantity;
      }

      const cashierMessage = `El cliente ${customer.name} en ${tableInfo}, ha solicitado su cuenta y está listo para pagar.

Total: $${totalAmount.toFixed(2)}
Método de pago: ${paymentMethod}`;

      await this.sendMessageUseCase.execute(branch.phoneNumberReception!, cashierMessage, branch.phoneNumberAssistant!);

      await this.branchesService.updateAvailableMessages(branch);

      const { messages } = await this.conversationService.getConversationHistory(
        conversation.conversationId,
      );

      const assistantInteractions = messages.filter(
        (msg) => msg.role === 'assistant',
      ).length;

      this.logger.log(
        `Assistant interactions in conversation: ${assistantInteractions}`,
      );

      const order = await this.createOrderAfterBillRequestUseCase.execute(customer.id, orderFromField, branch);

      if (order) {
        await this.ordersService.updateOrder(
          order.id,
          { interactions: assistantInteractions },
          'es',
        );
        this.logger.log(
          `Order ${order.id} updated with ${assistantInteractions} interactions`,
        );
      }

      await this.conversationService.deleteConversation(conversation.conversationId);

      this.logger.log(
        `Bill confirmation notification sent and order created for customer ${customer.name}`,
      );
    } catch (error) {
      this.logger.error('Error notifying cashier about confirmed bill:', error);
    }
  };
}