import { Injectable, Logger } from '@nestjs/common';
import { isPaymentMethodResponseUtil } from 'src/messages/utils/is-payment-method-response.util';
import { BranchesService } from '../../../branches/branches.service';
import { CustomersService } from '../../../customers/customers.service';
import { Customer } from '../../../customers/entities/customer.entity';
import { WebhookDataTwilio } from '../../../messages/models/webhook-data.twilio';
import { transcribeAudioUseCase } from '../../../openai/use-cases/transcribe-audio.use-case';
import { ConversationService } from '../../services/conversation.service';
import { TwilioService } from '../../services/twilio.service';
import { detectInappropriateBehaviorUtil } from '../../utils/detect-inappropriate-behavior.util';
import { detectInvalidTableResponseUtil } from '../../utils/detect-invalid-table-response.util';
import { detectOffTopicTerminationUtil } from '../../utils/detect-off-topic-termination.util';
import { downloadTwilioMediaUtil } from '../../utils/download-twilio-media.util';
import { extractLocationFromMessageUtil } from '../../utils/extract-location-from-message.util';
import { isInitialOrderConfirmationUtil } from '../../utils/is-initial-order-confirmation.util';
import { isOrderAndBillRequestUtil } from '../../utils/is-order-and-bill-request.util';
import { isProductUpdateUtil } from '../../utils/is-product-update.util';
import { removeMenuItemsIdsUtil } from '../../utils/remove-menu-items-ids.util';
import { NotifyCashierAboutConfirmedBillUseCase } from './notifications/notify-cashier-about-confirmed-bill.usecase';
import { NotifyCashierAboutConfirmedProductsUseCase } from './notifications/notify-cashier-about-confirmed-products.usecase';
import { NotifyCashierAboutInappropriateBehaviorUseCase } from './notifications/notify-cashier-about-inappropriate-behavior.usecase';
import { SendMessageUseCase } from './send-message.usecase';

@Injectable()
export class ProcessIncomingMessageUseCase {

  private readonly logger = new Logger(ProcessIncomingMessageUseCase.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly conversationService: ConversationService,
    private readonly branchService: BranchesService,
    private readonly customerService: CustomersService,
    private readonly notifyCashierAboutConfirmedBillUseCase: NotifyCashierAboutConfirmedBillUseCase,
    private readonly notifyCashierAboutConfirmedProductsUseCase: NotifyCashierAboutConfirmedProductsUseCase,
    private readonly notifyCashierAboutInappropriateBehaviorUseCase: NotifyCashierAboutInappropriateBehaviorUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
  ) { }


  async execute(body: WebhookDataTwilio): Promise<void> {


    const { to, from, profileName, message, hasAudio, audioUrl, audioMimeType } =
      this.twilioService.processIncomingWhatsappMessage(body);

    let processedMessage = message;

    if (hasAudio && audioUrl && audioMimeType) {
      try {
        this.logger.log(`Received audio message from ${from}. Transcribing...`);

        const audioBuffer = await downloadTwilioMediaUtil(audioUrl);
        const transcription = await transcribeAudioUseCase({
          audioBuffer,
          mimeType: audioMimeType,
        });

        this.logger.log(`Audio transcribed: "${transcription}"`);

        processedMessage = transcription;
      } catch (error) {
        this.logger.error('Error transcribing audio:', error);

        let errorMessage =
          'Lo siento, no pude procesar tu nota de voz. Por favor intenta nuevamente o escribe tu mensaje. 🎤\n\n' +
          "Sorry, I couldn't process your voice note. Please try again or send a text message. 🎤";

        // Solo mensaje específico para archivo demasiado grande
        if (error.message === 'AUDIO_TOO_LARGE') {
          errorMessage =
            'El archivo de audio es muy grande. Por favor intenta con un audio más corto o escribe tu mensaje. 📁\n\n' +
            'The audio file is too large. Please try with a shorter audio or send a text message. 📁';
        }

        await this.sendMessageUseCase.execute(from, errorMessage, to);

        return;
      }
    }

    if (!processedMessage || processedMessage.trim() === '') {
      this.logger.warn(`Empty message received from ${from}`);
      return;
    }

    const { branch } = await this.branchService.findByTerm(to, 'es');
    const { name, phoneNumberReception } = branch;

    if (branch.availableMessages === 0) {
      this.logger.warn(
        `Branch ${name} has no available messages left. Message from ${from} will not be processed.`,
      );
      return;
    }

    const isCashier = from === phoneNumberReception;
    let customerData: Customer | null;

    if (!isCashier) {
      const { customer } = await this.customerService.findByTerm(from, 'es');

      customerData = customer;

      if (!customer) {
        const { customer } = await this.customerService.create(
          {
            name: profileName,
            phone: from,
          },
          'es',
        );
        customerData = customer;
      } else {
        if (customerData !== null && customerData.name !== profileName) {
          const { customer } = await this.customerService.update(
            from,
            { name: profileName },
            'es',
          );
          customerData = customer;
        }
      }
    } else {
      customerData = {
        id: 'xxxx',
        name: profileName,
        phone: from,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };
    }

    const inappropriateBehavior =
      detectInappropriateBehaviorUtil(processedMessage);
    const invalidTableResponse = detectInvalidTableResponseUtil(processedMessage);

    if (inappropriateBehavior || invalidTableResponse) {
      // Obtener conversación antes de borrarla
      const conversation = await this.conversationService.getOrCreateConversation(
        from,
        branch.id,
      );

      await this.notifyCashierAboutInappropriateBehaviorUseCase.execute(from, processedMessage, conversation.location!, branch, customerData!);

      await this.sendMessageUseCase.execute(from, 'Su comunicación ha sido terminada por comportamiento inapropiado. El personal ha sido notificado.', to);

      // Borrar conversación para que no puedan seguir escribiendo
      this.logger.warn(
        `Deleting conversation ${conversation.conversationId} due to inappropriate behavior`,
      );
      await this.conversationService.deleteConversation(conversation.conversationId);

      return;
    }

    const response = await this.conversationService.processMessage(
      from,
      processedMessage,
      branch.id,
      customerData!,
      branch,
    );

    // ✅ Manejar flags de validación de QR
    if (response === 'QR_VALIDATION_FAILED') {
      await this.sendMessageUseCase.execute(from, 'Por favor, escanea el código QR de tu mesa para iniciar tu pedido. 📱\n\nPlease scan the QR code on your table to start your order. 📱', to);
      return;
    }

    if (response === 'QR_TOKEN_INVALID') {
      await this.sendMessageUseCase.execute(from, 'El código QR ha expirado. Por favor, solicita uno nuevo al personal. ⚠️\n\nThe QR code has expired. Please request a new one from staff. ⚠️', to);
      return;
    }

    if (response === 'QR_VALIDATION_SUCCESS') {
      const restaurantName = branch.restaurant?.name || 'our restaurant';
      const branchName = branch.name;
      const customerName = customerData?.name || '';

      const greeting = customerName
        ? `Hello ${customerName}! 👋 Welcome to ${restaurantName} - ${branchName}.`
        : `Hello! 👋 Welcome to ${restaurantName} - ${branchName}.`;

      await this.sendMessageUseCase.execute(
        from,
        `${greeting}\n\n` +
        '📝 You can send text messages or voice notes (max 30 seconds).\n' +
        '📝 Puedes enviar mensajes de texto o notas de voz (máximo 30 segundos).\n\n' +
        'Please select your preferred language:\n\n' +
        '🇲🇽 Español\n' +
        '🇺🇸 English\n' +
        '🇫🇷 Français\n' +
        '🇰🇷 한국어',
        to);
      return;
    }

    // ✅ Continuar con el flujo normal
    const cleanResponse = removeMenuItemsIdsUtil(response);

    await this.sendMessageUseCase.execute(from, cleanResponse, to);

    await this.branchService.updateAvailableMessages(branch);

    // ✅ Detectar si el bot terminó cortésmente la conversación por persistencia fuera de contexto
    const isOffTopicTermination = detectOffTopicTerminationUtil(response);
    if (isOffTopicTermination) {
      this.logger.warn(
        `Off-topic termination detected for customer ${from}. Notifying cashier.`,
      );

      // Obtener conversación antes de borrarla
      const conversation = await this.conversationService.getOrCreateConversation(
        from,
        branch.id,
      );

      await this.notifyCashierAboutInappropriateBehaviorUseCase.execute(from, processedMessage, conversation.location!, branch, customerData!);

      // Borrar conversación para que no puedan seguir escribiendo
      this.logger.warn(
        `Deleting conversation ${conversation.conversationId} due to off-topic persistence`,
      );
      await this.conversationService.deleteConversation(conversation.conversationId);

      return; // Terminar aquí para no procesar más
    }

    const conversation = await this.conversationService.getOrCreateConversation(
      from,
      branch.id,
    );

    // Detectar y guardar la ubicación tan pronto como se menciona
    const location = extractLocationFromMessageUtil(processedMessage);
    if (location && location !== conversation.location) {
      this.logger.log(`Detected location in message: ${location}`);
      await this.conversationService.updateConversationLocation(
        conversation.conversationId,
        location,
      );
    }

    // Detectar si el cliente pidió productos Y la cuenta en el mismo mensaje
    const { isOrderAndBill } = isOrderAndBillRequestUtil(
      processedMessage,
      response,
    );

    if (isOrderAndBill) {
      this.logger.log(
        'Detected order AND bill request in same message - processing order directly without confirmation',
      );

      // 1. Procesar el pedido SIN pedir confirmación al cliente (ya pidió la cuenta)
      await this.notifyCashierAboutConfirmedProductsUseCase.execute(from, branch, customerData!);

      // 2. Inmediatamente después, iniciar el flujo de solicitud de cuenta
      // El AI ya debería haber mostrado la cuenta en su respuesta
      // Ahora solo necesitamos esperar el método de pago
      this.logger.log(
        'Order processed. Waiting for payment method response to complete bill request.',
      );

      return; // No procesar más, esperar método de pago en siguiente mensaje
    }

    const isInitialConfirmation = isInitialOrderConfirmationUtil(response);
    const isProductUpdate = isProductUpdateUtil(processedMessage, response);

    if (isInitialConfirmation || isProductUpdate) {
      const isInitialOrder =
        !conversation.lastOrderSentToCashier ||
        Object.keys(conversation.lastOrderSentToCashier).length === 0;

      if (isInitialOrder) {
        this.logger.log(
          'Detected initial order confirmation (lastOrderSentToCashier is empty)',
        );
      } else {
        this.logger.log(
          'Detected product update confirmation (lastOrderSentToCashier has data)',
        );
      }

      await this.notifyCashierAboutConfirmedProductsUseCase.execute(from, branch, customerData!);
    }

    // Ya NO notificar cuando se pide la cuenta (solo muestra cuenta y pregunta método de pago)
    // Notificar solo cuando el cliente responde con el método de pago
    const { isPaymentMethod, paymentMethod } = isPaymentMethodResponseUtil(
      processedMessage,
      response,
    );

    if (isPaymentMethod) {
      await this.notifyCashierAboutConfirmedBillUseCase.execute(from, paymentMethod!, branch, customerData!);
    }
  };
}