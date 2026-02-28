import { Injectable, Logger } from '@nestjs/common';
import { TemplatesService } from '../../../templates/templates.service';
import { OrderAction } from './detect-order-action.use-case';

export interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface OrderData {
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  total: number;
}

export interface BillSplit {
  customer: string;
  items: OrderItem[];
  total: number;
}

export interface ModificationData {
  action: string;
  itemName: string;
  oldQuantity: number;
  newQuantity: number;
  items: OrderItem[];
  total: number;
}

@Injectable()
export class RenderOrderResponseUseCase {
  private readonly logger = new Logger(RenderOrderResponseUseCase.name);

  constructor(private readonly templatesService: TemplatesService) {}

  async execute(
    action: OrderAction,
    orderData: OrderData | BillSplit[] | ModificationData,
    language: string = 'es',
    additionalVariables: Record<string, any> = {},
  ): Promise<string> {
    try {
      switch (action) {
        case OrderAction.ADD_ITEMS:
          return await this.renderItemsAdded(
            orderData as OrderData,
            language,
            additionalVariables,
          );

        case OrderAction.MODIFY_ITEM:
          return await this.renderModifiedItem(
            orderData as ModificationData,
            language,
            additionalVariables,
          );

        case OrderAction.CONFIRM_ORDER:
          return await this.renderOrderConfirmation(
            orderData as OrderData,
            language,
            additionalVariables,
          );

        case OrderAction.REQUEST_BILL:
          return await this.renderRequestBill(
            orderData as OrderData,
            language,
            additionalVariables,
          );

        case OrderAction.SEPARATE_BILLS:
          return await this.renderSeparateBills(
            orderData as BillSplit[],
            language,
            additionalVariables,
          );

        case OrderAction.VIEW_ORDER:
          return await this.renderViewOrder(
            orderData as OrderData,
            language,
            additionalVariables,
          );

        default:
          this.logger.warn(`Unknown order action: ${action}`);
          return await this.templatesService.render({
            key: 'error.general',
            language,
            variables: {
              errorMessage: 'No se pudo procesar la acción solicitada.',
            },
          });
      }
    } catch (error) {
      this.logger.error(
        `Error rendering order response: ${error.message}`,
        error.stack,
      );
      return await this.templatesService.render({
        key: 'error.general',
        language,
        variables: {
          errorMessage: 'Ocurrió un error al procesar tu pedido.',
        },
      });
    }
  }

  private async renderItemsAdded(
    orderData: OrderData,
    language: string,
    additionalVariables: Record<string, any>,
  ): Promise<string> {
    this.logger.log('Rendering items added response');

    return await this.templatesService.render({
      key: 'order.items_added',
      language,
      variables: {
        items: orderData.items || [],
        subtotal: orderData.subtotal || 0,
        total: orderData.total || 0,
        ...additionalVariables,
      },
    });
  }

  private async renderModifiedItem(
    orderData: ModificationData,
    language: string,
    additionalVariables: Record<string, any>,
  ): Promise<string> {
    this.logger.log('Rendering modified item response');

    return await this.templatesService.render({
      key: 'order.modify_item',
      language,
      variables: {
        action: orderData.action || 'modificado',
        itemName: orderData.itemName || 'el artículo',
        oldQuantity: orderData.oldQuantity || 0,
        newQuantity: orderData.newQuantity || 0,
        items: orderData.items || [],
        total: orderData.total || 0,
        ...additionalVariables,
      },
    });
  }

  private async renderOrderConfirmation(
    orderData: OrderData,
    language: string,
    additionalVariables: Record<string, any>,
  ): Promise<string> {
    this.logger.log('Rendering order confirmation response');

    return await this.templatesService.render({
      key: 'order.confirmation',
      language,
      variables: {
        orderNumber: additionalVariables.orderNumber || 'TU-ORDEN',
        items: orderData.items || [],
        subtotal: orderData.subtotal || 0,
        tax: orderData.tax || 0,
        total: orderData.total || 0,
        estimatedTime: additionalVariables.estimatedTime || '15-20 minutos',
        ...additionalVariables,
      },
    });
  }

  private async renderRequestBill(
    orderData: OrderData,
    language: string,
    additionalVariables: Record<string, any>,
  ): Promise<string> {
    this.logger.log('Rendering request bill response');

    return await this.templatesService.render({
      key: 'order.request_bill',
      language,
      variables: {
        items: orderData.items || [],
        subtotal: orderData.subtotal || 0,
        tax: orderData.tax || 0,
        total: orderData.total || 0,
        ...additionalVariables,
      },
    });
  }

  private async renderSeparateBills(
    billSplits: BillSplit[],
    language: string,
    additionalVariables: Record<string, any>,
  ): Promise<string> {
    this.logger.log('Rendering separate bills response');

    return await this.templatesService.render({
      key: 'order.separate_bills_detailed',
      language,
      variables: {
        splits: billSplits || [],
        ...additionalVariables,
      },
    });
  }

  private async renderViewOrder(
    orderData: OrderData,
    language: string,
    additionalVariables: Record<string, any>,
  ): Promise<string> {
    this.logger.log('Rendering view order response');

    if (!orderData.items || orderData.items.length === 0) {
      return await this.templatesService.render({
        key: 'order.empty_cart',
        language,
        variables: {},
      });
    }

    return await this.templatesService.render({
      key: 'order.add_item',
      language,
      variables: {
        items: orderData.items || [],
        total: orderData.total || 0,
        ...additionalVariables,
      },
    });
  }
}
