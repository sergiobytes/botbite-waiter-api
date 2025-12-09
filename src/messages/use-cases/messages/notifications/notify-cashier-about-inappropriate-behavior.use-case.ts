import { NotifyCashier } from '../../../interfaces/messages.interfaces';
import { sendMessageUseCase } from '../send-message.use-case';

export const notifyCashierAboutInappropriateBehaviorUseCase = async (
  params: NotifyCashier,
): Promise<void> => {
  const { from, message, customer, branch, twilioService, logger } = params;

  try {
    const notificationMessage = `🚨: Comportamiento inapropiado detectado de ${from}: "${message}"
    Cliente: ${customer.name}
    Se ha terminado la conversación con el cliente. Por favor, tome las medidas necesarias.
    `;

    await sendMessageUseCase({
      customerPhone: branch.phoneNumberReception!,
      message: notificationMessage,
      assistantPhone: branch.phoneNumberAssistant,
      logger,
      twilioService,
    });

    logger.warn(`Inappropriate behavior detected from ${from}: "${message}"`);
  } catch (error) {
    logger.error(
      'Error notifying cashier about inappropriate behavior:',
      error,
    );
  }
};
