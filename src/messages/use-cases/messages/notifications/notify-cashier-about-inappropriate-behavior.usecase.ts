import { Injectable, Logger } from '@nestjs/common';
import { Branch } from '../../../../branches/entities/branch.entity';
import { Customer } from '../../../../customers/entities/customer.entity';
import { SendMessageUseCase } from '../send-message.usecase';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashierNotification } from '../../../entities/cashier-notifications.entity';

@Injectable()
export class NotifyCashierAboutInappropriateBehaviorUseCase {
  private readonly logger = new Logger(NotifyCashierAboutInappropriateBehaviorUseCase.name);

  constructor(
    @InjectRepository(CashierNotification)
    private readonly cashierNotificationRepository: Repository<CashierNotification>,
    private readonly sendMessageUseCase: SendMessageUseCase,
  ) { }

  async execute(from: string, message: string, location: string, branch: Branch, customer: Customer): Promise<void> {


    try {
      const locationInfo = location ? `\nUbicación: ${location}` : '';
      const notificationMessage = `🚨: Comportamiento inapropiado detectado de ${from}: "${message}"
Cliente: ${customer.name}${locationInfo}
Se ha terminado la conversación con el cliente. Por favor, tome las medidas necesarias.
    `;

      await this.sendMessageUseCase.execute(branch.phoneNumberReception!, notificationMessage, branch.phoneNumberAssistant!);

      // TODO: Guardar notificacion
      await this.cashierNotificationRepository.save({
        branchId: branch.id,
        phoneNumber: customer.phone,
        message: notificationMessage,
      });

      this.logger.warn(`Inappropriate behavior detected from ${from}: "${message}"`);
    } catch (error) {
      this.logger.error(
        'Error notifying cashier about inappropriate behavior:',
        error,
      );
    }
  };
}