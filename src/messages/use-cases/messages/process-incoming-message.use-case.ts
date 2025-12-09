import { isBillRequestUtil } from 'src/messages/utils/is-bill-request.util';
import { Customer } from '../../../customers/entities/customer.entity';
import { ProcessIncomingMessage } from '../../interfaces/messages.interfaces';
import { detectInappropriateBehaviorUtil } from '../../utils/detect-inappropriate-behavior.util';
import { detectInvalidTableResponseUtil } from '../../utils/detect-invalid-table-response.util';
import { isInitialOrderConfirmationUtil } from '../../utils/is-initial-order-confirmation.util';
import { isProductUpdateUtil } from '../../utils/is-product-update.util';
import { removeMenuItemsIdsUtil } from '../../utils/remove-menu-items-ids.util';
import { notifyCashierAboutConfirmedBillUseCase } from './notifications/notify-cashier-about-confirmed-bill.use-case';
import { notifyCashierAboutConfirmedProductsUseCase } from './notifications/notify-cashier-about-confirmed-products.use-case';
import { notifyCashierAboutInappropriateBehaviorUseCase } from './notifications/notify-cashier-about-inappropriate-behavior.use-case';
import { sendMessageUseCase } from './send-message.use-case';
import { downloadTwilioMediaUtil } from '../../utils/download-twilio-media.util';
import { transcribeAudioUseCase } from '../../../openai/use-cases/transcribe-audio.use-case';

export const processIncomingMessageUseCase = async (
  params: ProcessIncomingMessage,
): Promise<void> => {
  const {
    body,
    logger,
    twilioService,
    branchesService,
    customersService,
    conversationService,
    menuService,
    ordersService,
  } = params;

  const { to, from, profileName, message, hasAudio, audioUrl, audioMimeType } =
    twilioService.processIncomingWhatsappMessage(body);

  let processedMessage = message;

  if (hasAudio && audioUrl && audioMimeType) {
    try {
      logger.log(`Received audio message from ${from}. Transcribing...`);

      const audioBuffer = await downloadTwilioMediaUtil(audioUrl);
      const transcription = await transcribeAudioUseCase({
        audioBuffer,
        mimeType: audioMimeType,
      });

      logger.log(`Audio transcribed: "${transcription}"`);

      processedMessage = transcription;
    } catch (error) {
      logger.error('Error transcribing audio:', error);

      let errorMessage =
        'Lo siento, no pude procesar tu nota de voz. Por favor intenta nuevamente o escribe tu mensaje. 🎤\n\n' +
        "Sorry, I couldn't process your voice note. Please try again or send a text message. 🎤";

      // Solo mensaje específico para archivo demasiado grande
      if (error.message === 'AUDIO_TOO_LARGE') {
        errorMessage =
          'El archivo de audio es muy grande. Por favor intenta con un audio más corto o escribe tu mensaje. 📁\n\n' +
          'The audio file is too large. Please try with a shorter audio or send a text message. 📁';
      }

      await sendMessageUseCase({
        assistantPhone: to,
        customerPhone: from,
        message: errorMessage,
        twilioService,
        logger,
      });

      return;
    }
  }

  if (!processedMessage || processedMessage.trim() === '') {
    logger.warn(`Empty message received from ${from}`);
    return;
  }

  const { branch } = await branchesService.findByTerm(to, 'es');
  const { name, phoneNumberReception } = branch;

  if (branch.availableMessages === 0) {
    logger.warn(
      `Branch ${name} has no available messages left. Message from ${from} will not be processed.`,
    );
    return;
  }

  const isCashier = from === phoneNumberReception;
  let customerData: Customer | null;

  if (!isCashier) {
    const { customer } = await customersService.findByTerm(from, 'es');

    customerData = customer;

    if (!customer) {
      const { customer } = await customersService.create(
        {
          name: profileName,
          phone: from,
        },
        'es',
      );
      customerData = customer;
    } else {
      if (customerData !== null && customerData.name !== profileName) {
        const { customer } = await customersService.update(
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
    await notifyCashierAboutInappropriateBehaviorUseCase({
      branch,
      customer: customerData!,
      message: processedMessage,
      conversationService,
      twilioService,
      logger,
      from,
      branchesService,
      menuService,
      ordersService,
    });

    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: from,
      message:
        'Su comunicación ha sido terminada por comportamiento inapropiado. El personal ha sido notificado.',
      twilioService,
      logger,
    });

    return;
  }

  const response = await conversationService.processMessage(
    from,
    processedMessage,
    branch.id,
    customerData!,
    branch,
  );

  // ✅ Manejar flags de validación de QR
  if (response === 'QR_VALIDATION_FAILED') {
    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: from,
      message:
        'Por favor, escanea el código QR de tu mesa para iniciar tu pedido. 📱\n\n' +
        'Please scan the QR code on your table to start your order. 📱',
      twilioService,
      logger,
    });
    return;
  }

  if (response === 'QR_TOKEN_INVALID') {
    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: from,
      message:
        'El código QR ha expirado. Por favor, solicita uno nuevo al personal. ⚠️\n\n' +
        'The QR code has expired. Please request a new one from staff. ⚠️',
      twilioService,
      logger,
    });
    return;
  }

  if (response === 'QR_VALIDATION_SUCCESS') {
    const restaurantName = branch.restaurant?.name || 'our restaurant';
    const branchName = branch.name;
    const customerName = customerData?.name || '';

    const greeting = customerName
      ? `Hello ${customerName}! 👋 Welcome to ${restaurantName} - ${branchName}.`
      : `Hello! 👋 Welcome to ${restaurantName} - ${branchName}.`;

    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: from,
      message:
        `${greeting}\n\n` +
        '📝 You can send text messages or voice notes (max 30 seconds).\n' +
        '📝 Puedes enviar mensajes de texto o notas de voz (máximo 30 segundos).\n\n' +
        'Please select your preferred language:\n\n' +
        '🇲🇽 Español\n' +
        '🇺🇸 English\n' +
        '🇫🇷 Français\n' +
        '🇰🇷 한국어',
      twilioService,
      logger,
    });
    return;
  }

  // ✅ Continuar con el flujo normal
  const cleanResponse = removeMenuItemsIdsUtil(response);

  await sendMessageUseCase({
    assistantPhone: branch.phoneNumberAssistant,
    customerPhone: from,
    message: cleanResponse,
    twilioService,
    logger,
  });

  await branchesService.updateAvailableMessages(branch);

  const conversation = await conversationService.getOrCreateConversation(
    from,
    branch.id,
  );

  const isInitialConfirmation = isInitialOrderConfirmationUtil(response);
  const isProductUpdate = isProductUpdateUtil(processedMessage, response);

  if (isInitialConfirmation || isProductUpdate) {
    const isInitialOrder =
      !conversation.lastOrderSentToCashier ||
      Object.keys(conversation.lastOrderSentToCashier).length === 0;

    if (isInitialOrder) {
      logger.log(
        'Detected initial order confirmation (lastOrderSentToCashier is empty)',
      );
    } else {
      logger.log(
        'Detected product update confirmation (lastOrderSentToCashier has data)',
      );
    }

    await notifyCashierAboutConfirmedProductsUseCase({
      branch,
      customer: customerData!,
      logger,
      from,
      message: processedMessage,
      conversationService,
      twilioService,
      branchesService,
      menuService,
      ordersService,
    });
  }

  if (isBillRequestUtil(processedMessage, response)) {
    await notifyCashierAboutConfirmedBillUseCase({
      branch,
      conversationService,
      branchesService,
      from,
      logger,
      ordersService,
      twilioService,
      menuService,
      message: processedMessage,
      customer: customerData!,
    });
  }
};
