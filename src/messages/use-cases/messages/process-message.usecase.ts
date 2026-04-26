import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../../branches/entities/branch.entity';
import { Customer } from '../../../customers/entities/customer.entity';
import { Conversation } from '../../entities/conversation.entity';
import { detectLanguageUtil } from '../../utils/detect-language.util';
import { extractLocationFromMessageUtil } from '../../utils/extract-location-from-message.util';
import { validateQrScanUtil } from '../../utils/validate-qr-scan.util';
import { GetOrCreateConversationUseCase } from '../conversations/get-create-conversation.usecase';
import { ProcessMainFlowUseCase } from './process-main-flow.usecase';

@Injectable()
export class ProcessMessageUseCase {

  private readonly logger = new Logger(ProcessMessageUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly getOrCreateConversationUseCase: GetOrCreateConversationUseCase,
    private readonly processMainFlowUseCase: ProcessMainFlowUseCase,
  ) { }


  async execute(phoneNumber: string, userMessage: string, branchId?: string, customerContext?: Customer, branchContext?: Branch): Promise<string> {

    try {
      const startTime = Date.now();
      this.logger.log(`[PERF] Starting message processing for ${phoneNumber}`);

      const conversation = await this.getOrCreateConversationUseCase.execute(phoneNumber, branchId);

      if (!conversation || !conversation.conversationId) {
        throw new Error(
          `Invalid conversation returned for phone ${phoneNumber}: ${JSON.stringify({ id: conversation?.id, conversationId: conversation?.conversationId })}`,
        );
      }

      this.logger.log(`[PERF] Conversation loaded in ${Date.now() - startTime}ms`);

      // ✅ Validar QR solo si no está validado
      if (!conversation.isQrValidated) {
        const { isValidQrScan, token } = validateQrScanUtil(userMessage);

        if (!isValidQrScan) {
          this.logger.warn(
            `Conversation attempt without QR scan from ${phoneNumber}. Branch: ${branchId}`,
          );

          // ❌ NO llamar a OpenAI, retornar flag especial
          return 'QR_VALIDATION_FAILED';
        }

        if (token !== branchContext?.qrToken) {
          this.logger.warn(
            `Invalid QR token from ${phoneNumber}. Expected: ${branchContext?.qrToken}, Got: ${token}`,
          );

          // ❌ NO llamar a OpenAI, retornar flag especial
          return 'QR_TOKEN_INVALID';
        }

        // ✅ SOLO aquí validar y guardar
        conversation.isQrValidated = true;
        await this.conversationRepository.save(conversation);

        this.logger.log(
          `QR validated for conversation ${conversation.id} with token ${token}`,
        );

        // ✅ Retornar flag de éxito sin procesar el mensaje del token
        return 'QR_VALIDATION_SUCCESS';
      }

      // Bug #4: Si ya está validado pero el usuario vuelve a escanear el QR (re-scan),
      // limpiar el estado de la conversación y tratarlo como nueva sesión
      if (conversation.isQrValidated) {
        const { isValidQrScan, token } = validateQrScanUtil(userMessage);
        if (isValidQrScan && token === branchContext?.qrToken) {
          this.logger.log(`QR re-scan detected for ${phoneNumber}. Resetting conversation state.`);
          // Limpiar estado de la sesión anterior (nuevo comensal en la misma mesa)
          await this.conversationRepository.update(
            { id: conversation.id },
            {
              location: null,
              lastOrderSentToCashier: null,
              preferredLanguage: null,
              lastOrderSentAt: null,
            } as any,
          );
          return 'QR_VALIDATION_SUCCESS';
        }
      }

      // ✅ STATE: Awaiting language selection (QR validated but no language chosen yet)
      if (!conversation.preferredLanguage) {
        const detectedLanguage = detectLanguageUtil(userMessage);
        if (!detectedLanguage) {
          this.logger.warn(`Language not selected yet for ${phoneNumber}. Re-asking.`);
          return 'AWAITING_LANGUAGE';
        }
        this.logger.log(`Language selected: ${detectedLanguage} for ${phoneNumber}`);
        conversation.preferredLanguage = detectedLanguage;
        await this.conversationRepository.save(conversation);
        return `LANG_SELECTED:${detectedLanguage}`;
      }

      // ✅ STATE: Awaiting location (language set but no location provided yet)
      if (!conversation.location) {
        const location = extractLocationFromMessageUtil(userMessage);
        if (!location) {
          this.logger.warn(`Location not provided yet for ${phoneNumber}. Re-asking.`);
          return `AWAITING_LOCATION:${conversation.preferredLanguage}`;
        }
        this.logger.log(`Location received: "${location}" for ${phoneNumber}`);
        await this.conversationRepository.update({ id: conversation.id }, { location });
        return `LOCATION_RECEIVED:${conversation.preferredLanguage}`;
      }

      // ✅ Continuar con el flujo principal determinista
      return await this.processMainFlowUseCase.execute(phoneNumber, userMessage, branchContext!, customerContext!);

    } catch (error) {
      this.logger.log('Error processing message: ', error);
      throw error;
    }
  }
}

