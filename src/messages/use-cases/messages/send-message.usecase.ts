import { Injectable, Logger } from '@nestjs/common';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { TwilioService } from '../../services/twilio.service';
import { splitLongMessageUtil } from '../../utils/split-long-message.util';

@Injectable()
export class SendMessageUseCase {
  private readonly logger = new Logger(SendMessageUseCase.name);

  constructor(
    private readonly twilioService: TwilioService,
  ) { }

  async execute(customerPhone: string, message: string, assistantPhone?: string): Promise<MessageInstance> {

    try {
      // Extraer URL de imagen si está presente en el mensaje
      const imageUrlMatch = message.match(/\[SEND_IMAGE:(.+?)\]/);
      const mediaUrl = imageUrlMatch ? imageUrlMatch[1] : undefined;

      // Limpiar el mensaje removiendo el marcador de imagen
      const cleanedMessage = message.replace(/\[SEND_IMAGE:.+?\]/g, '').trim();

      // Split message if it's too long for WhatsApp
      const messageChunks = splitLongMessageUtil(cleanedMessage);

      let lastResponse: MessageInstance | null = null;

      // Send each chunk sequentially
      for (let i = 0; i < messageChunks.length; i++) {
        const chunk = messageChunks[i];

        this.logger.log(
          `Sending message chunk ${i + 1}/${messageChunks.length} to ${customerPhone} (${chunk.length} chars)`,
        );

        // Solo enviar la imagen con el primer mensaje
        const shouldSendMedia = i === 0 && mediaUrl;

        lastResponse = await this.twilioService.sendWhatsAppMessage(
          customerPhone,
          chunk,
          assistantPhone!,
          shouldSendMedia ? mediaUrl : undefined,
        );

        // Small delay between messages to ensure proper order
        if (i < messageChunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (mediaUrl) {
        this.logger.log(
          `Message with image sent successfully to ${customerPhone} from branch ${assistantPhone}`,
        );
      } else {
        this.logger.log(
          `Message sent successfully to ${customerPhone} from branch ${assistantPhone} (${messageChunks.length} chunk${messageChunks.length > 1 ? 's' : ''})`,
        );
      }

      return lastResponse!;
    } catch (error) {
      this.logger.error(`Failed to send message to ${customerPhone}:`, error);
      throw error;
    }
  };
}