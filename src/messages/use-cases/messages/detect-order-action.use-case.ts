import { Injectable, Logger } from '@nestjs/common';

export enum OrderAction {
    ADD_ITEMS = 'add_items',
    MODIFY_ITEM = 'modify_item',
    REMOVE_ITEM = 'remove_item',
    CONFIRM_ORDER = 'confirm_order',
    VIEW_ORDER = 'view_order',
    REQUEST_BILL = 'request_bill',
    SEPARATE_BILLS = 'separate_bills',
    NONE = 'none',
}

export interface OrderActionDetectionResult {
    action: OrderAction;
    confidence: number;
}

@Injectable()
export class DetectOrderActionUseCase {
    private readonly logger = new Logger(DetectOrderActionUseCase.name);

    execute(message: string): OrderActionDetectionResult {
        const messageLower = message.toLowerCase().trim();

        // 1. Solicitar cuenta/factura
        if (
            messageLower.includes('cuenta') ||
            messageLower.includes('bill') ||
            messageLower.includes('factura') ||
            messageLower.includes('pagar') ||
            messageLower.includes('pay') ||
            messageLower.includes('cobrar') ||
            messageLower.includes('charge')
        ) {
            // Verificar si es solicitud de cuentas separadas
            if (
                messageLower.includes('separad') ||
                messageLower.includes('divid') ||
                messageLower.includes('mitad') ||
                messageLower.includes('split') ||
                messageLower.includes('separate') ||
                messageLower.includes('divided') ||
                messageLower.includes('half')
            ) {
                this.logger.log('Detected: SEPARATE_BILLS');
                return { action: OrderAction.SEPARATE_BILLS, confidence: 0.95 };
            }

            this.logger.log('Detected: REQUEST_BILL');
            return { action: OrderAction.REQUEST_BILL, confidence: 0.95 };
        }

        // 2. Modificar/eliminar items
        if (
            messageLower.includes('quitar') ||
            messageLower.includes('eliminar') ||
            messageLower.includes('borrar') ||
            messageLower.includes('cancelar') ||
            messageLower.includes('remove') ||
            messageLower.includes('delete') ||
            messageLower.includes('cancel') ||
            messageLower.includes('cambiar') ||
            messageLower.includes('modificar') ||
            messageLower.includes('change') ||
            messageLower.includes('modify')
        ) {
            this.logger.log('Detected: MODIFY_ITEM');
            return { action: OrderAction.MODIFY_ITEM, confidence: 0.9 };
        }

        // 3. Confirmar pedido
        if (
            messageLower.includes('confirmar') ||
            messageLower.includes('confirm') ||
            messageLower.includes('enviar') ||
            messageLower.includes('send') ||
            messageLower.includes('listo') ||
            messageLower.includes('ready') ||
            messageLower.includes('está bien') ||
            messageLower.includes('ok') ||
            (messageLower.includes('sí') && messageLower.includes('pedido')) ||
            (messageLower.includes('yes') && messageLower.includes('order'))
        ) {
            this.logger.log('Detected: CONFIRM_ORDER');
            return { action: OrderAction.CONFIRM_ORDER, confidence: 0.9 };
        }

        // 4. Ver pedido actual
        if (
            (messageLower.includes('mi pedido') ||
                messageLower.includes('my order') ||
                messageLower.includes('qué pedí') ||
                messageLower.includes('what did i order') ||
                messageLower.includes('qué llevo') ||
                messageLower.includes('what do i have') ||
                messageLower.includes('ver pedido') ||
                messageLower.includes('view order')) &&
            !messageLower.includes('agregar') &&
            !messageLower.includes('add')
        ) {
            this.logger.log('Detected: VIEW_ORDER');
            return { action: OrderAction.VIEW_ORDER, confidence: 0.85 };
        }

        // 5. Agregar items (por defecto si hay palabras clave de comida/bebida)
        const addKeywords = [
            'quiero',
            'quisiéramos',
            'me gustaría',
            'nos gustaría',
            'traer',
            'traiga',
            'agregar',
            'añadir',
            'pedir',
            'ordenar',
            'i want',
            'i would like',
            'we would like',
            'bring',
            'add',
            'order',
        ];

        const hasAddKeyword = addKeywords.some((keyword) =>
            messageLower.includes(keyword),
        );

        if (hasAddKeyword) {
            this.logger.log('Detected: ADD_ITEMS');
            return { action: OrderAction.ADD_ITEMS, confidence: 0.8 };
        }

        // 6. No se detectó acción específica
        this.logger.log('No order action detected');
        return { action: OrderAction.NONE, confidence: 0 };
    }
}
