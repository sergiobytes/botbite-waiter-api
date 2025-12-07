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

  const { to, from, profileName, message } =
    twilioService.processIncomingWhatsappMessage(body);

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

  const inappropriateBehavior = detectInappropriateBehaviorUtil(message);
  const invalidTableResponse = detectInvalidTableResponseUtil(message);

  if (inappropriateBehavior || invalidTableResponse) {
    await notifyCashierAboutInappropriateBehaviorUseCase({
      branch,
      customer: customerData!,
      message,
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
    message,
    branch.id,
    customerData!,
    branch,
  );

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
  const isProductUpdate = isProductUpdateUtil(message, response);

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
      message,
      conversationService,
      twilioService,
      branchesService,
      menuService,
      ordersService,
    });
  }

  if (isBillRequestUtil(message, response)) {
    await notifyCashierAboutConfirmedBillUseCase({
      branch,
      conversationService,
      branchesService,
      from,
      logger,
      ordersService,
      twilioService,
      menuService,
      message,
      customer: customerData!,
    });
  }
};
