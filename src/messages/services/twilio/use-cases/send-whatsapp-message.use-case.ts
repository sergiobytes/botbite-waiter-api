import { Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

export const sendWhatsappMessageUseCase = async (
  to: string,
  message: string,
  from: string,
  logger: Logger,
  client: Twilio,
) => {
  try {
    const whatsappNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

    const messageResponse = await client.messages.create({
      body: message,
      from: fromNumber,
      to: whatsappNumber,
    });

    logger.log(`WhatsApp message sent to ${to}: ${messageResponse.sid}`);
    return messageResponse;
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${to}:`, error);
    throw error;
  }
};
