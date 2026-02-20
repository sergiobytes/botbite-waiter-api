import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { Branch } from '../../branches/entities/branch.entity';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface ProcessOrder {
  action:
    | 'add'
    | 'remove'
    | 'modify'
    | 'confirm'
    | 'request_bill'
    | 'separate_bills'
    | 'show_cart';
  items?: OrderItem[];
  modifications?: {
    removed?: OrderItem[];
    updated?: Array<{
      item: OrderItem;
      oldQuantity: number;
      newQuantity: number;
      newTotal: number;
    }>;
  };
  separateBills?: Array<{
    customerName: string;
    items: OrderItem[];
    subtotal: number;
  }>;
  currentTotal: number;
  message?: string;
}

@Injectable()
export class ProcessOrderWithAIUseCase {
  private readonly logger = new Logger(ProcessOrderWithAIUseCase.name);

  async execute(
    openai: OpenAI,
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    currentOrder: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    >,
    branchContext?: Branch,
  ): Promise<ProcessOrder> {
    try {
      const systemPrompt = `Eres un asistente que procesa pedidos de restaurante. Tu tarea es ÚNICAMENTE extraer información estructurada del mensaje del usuario.
      IMPORTANTE: Responde SOLO con un objeto JSON válido, sin texto adicional.

      Available menu items: ${this.buildMenuContext(branchContext)}

      Current order: ${JSON.stringify(currentOrder, null, 2)}

      Analiza el mensaje y determina la accion a realizar:
        - "add": Usuario quiere agregar items
        - "remove": Usuario quiere eliminar items
        - "modify": Usuario quiere cambiar cantidades
        - "confirm": Usuario confirma el pedido
        - "request_bill": Usuario pide la cuenta
        - "separate_bills": Usuario quiere cuentas separadas
        - "show_cart": Usuario quiere ver su pedido actual

        Responde ÚNICAMENTE con este formato JSON:
        {
            "action": "add|remove|modify|confirm|request_bill|separate_bills|show_cart",
            "items": [
                {
                    "menuItemId": "uuid-del-producto",
                    "name": "nombre-producto",
                    "quantity": número,
                    "unitPrice": precio,
                    "notes": "notas-opcionales"
                }
            ],
            "message": "mensaje-opcional-de-contexto"
        }

        Para cuentas separadas incluye:
        {
            "action": "separate_bills",
            "separateBills": [
                {
                    "customerName": "nombre",
                    "items": [...]
                }
            ]
        }
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-5),
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const aiResponse = JSON.parse(
        response.choices[0].message.content || '{}',
      );

      this.logger.debug(
        `AI extracted order data: ${JSON.stringify(aiResponse)}`,
      );

      return this.processAIResponse(aiResponse, currentOrder, branchContext);
    } catch (error) {
      this.logger.error(`Error processing order with AI: ${error.message}`);
      throw error;
    }
  }

  private buildMenuContext(branch?: Branch): string {
    if (!branch?.menus) return 'No menu available';

    const menuItems: string[] = [];

    for (const menu of branch.menus) {
      if (!menu.menuItems) continue;

      for (const item of menu.menuItems) {
        if (!item.isActive) continue;

        menuItems.push(
          `- [${item.id}] ${item.product.name}: ${item.price} (${item.category.name || 'Sin categoría'})`,
        );
      }
    }

    return menuItems.join('\n');
  }

  private processAIResponse(
    aiResponse: any,
    currentOrder: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    >,
    branchContext?: Branch,
  ): ProcessOrder {
    const action = aiResponse.action || 'add';
    let currentTotal = 0;
    const items: OrderItem[] = [];

    for (const [key, orderItem] of Object.entries(currentOrder)) {
      currentTotal += orderItem.price * orderItem.quantity;
    }

    if (action === 'add' && aiResponse.items) {
      for (const item of aiResponse.items) {
        const subtotal = item.quatity * item.unitPrice;
        currentTotal += subtotal;

        items.push({
          id: this.generateItemId(),
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
          notes: item.notes,
        });
      }
    }

    if (action === 'separate_bills' && aiResponse.separateBills) {
      const bills = aiResponse.separateBills.map((bill: any) => {
        const billItems: OrderItem[] = [];
        let billSubtotal = 0;

        for (const item of bill.items) {
          const subtotal = item.quantity * item.unitPrice;
          billSubtotal += subtotal;

          billItems.push({
            id: this.generateItemId(),
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal,
            notes: item.notes,
          });
        }

        return {
          customerName: bill.customerName,
          items: billItems,
          subtotal: billSubtotal,
        };
      });

      return {
        action: 'separate_bills',
        separateBills: bills,
        currentTotal,
        message: aiResponse.message,
      };
    }

    return {
      action,
      items: items.length > 0 ? items : undefined,
      currentTotal,
      message: aiResponse.message,
    };
  }

  private generateItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
