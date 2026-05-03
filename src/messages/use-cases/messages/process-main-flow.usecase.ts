import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../../branches/entities/branch.entity';
import { Customer } from '../../../customers/entities/customer.entity';
import { MenuItem } from '../../../menus/entities/menu-item.entity';
import { CashierNotification } from '../../entities/cashier-notifications.entity';
import { Conversation } from '../../entities/conversation.entity';
import { OrdersGateway } from '../../gateways/orders.gateway';
import { detectAmenityIntentUtil } from '../../utils/detect-amenity-intent.util';
import { detectCancelKeywordUtil, detectModifyKeywordUtil } from '../../utils/detect-cancel-modify-intent.util';
import { detectConsumoIntentUtil } from '../../utils/detect-consumo-intent.util';
import { detectCuentaIntentUtil } from '../../utils/detect-cuenta-intent.util';
import { detectMenuIntentUtil } from '../../utils/detect-menu-intent.util';
import { detectOrderResponseUtil } from '../../utils/detect-order-response.util';
import { detectPaymentMethodInputUtil } from '../../utils/detect-payment-method-input.util';
import { detectProductInfoIntentUtil } from '../../utils/detect-product-info-intent.util';
import { detectRecommendationIntentUtil } from '../../utils/detect-recommendation-intent.util';
import { detectSocialMessageUtil } from '../../utils/detect-social-message.util';
import { detectSplitBillIntentUtil } from '../../utils/detect-split-bill-intent.util';
import { extractAddItemIntentUtil } from '../../utils/extract-add-item-intent.util';
import { findAllMenuItemsInMessage, FoundOrderItem } from '../../utils/find-all-menu-items-in-message.util';
import { classifyMenuMatch, findMenuItemFuzzyUtil, scoreMenuItem } from '../../utils/find-menu-item-fuzzy.util';
import {
    detectPhotoRequestUtil,
    getAmenityResponseMessage,
    getBillClosedMessage,
    getCannotCancelConfirmedMessage,
    getCannotCancelOrderMessage,
    getCannotModifyOrderMessage,
    getCannotSplitBillMessage,
    getCartMessage,
    getConfirmationRePromptMessage,
    getConsumoMessage,
    getDefaultFlowMessage,
    getMenuWelcomeMessage,
    getMixedMatchMessage,
    getMultipleProductInfoMessage,
    getNoOrderForBillMessage,
    getNoPhotoAvailableMessage,
    getNoRecommendationsMessage,
    getOrderCancelledMessage,
    getOrderConfirmedMessage,
    getPartialMatchMessage,
    getPaymentMethodRetryMessage,
    getProductInfoMessage,
    getProductNotFoundMessage,
    getProductUnavailableMessage,
    getRecommendationsMessage,
    getSocialResponseMessage,
} from '../../utils/get-onboarding-messages.util';
import { calculateOrderChangesUtil } from '../../utils/calculate-order-changes.util';
import { OpenAIService } from '../../../openai/openai.service';
import { CreateOrderAfterBillRequestUseCase } from './create-order-after-bill-request.usecase';
import { SendMessageUseCase } from './send-message.usecase';

type OrderItems = Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
>;

@Injectable()
export class ProcessMainFlowUseCase {
    private readonly logger = new Logger(ProcessMainFlowUseCase.name);

    constructor(
        @InjectRepository(Conversation)
        private readonly conversationRepository: Repository<Conversation>,
        @InjectRepository(CashierNotification)
        private readonly cashierNotificationRepository: Repository<CashierNotification>,
        private readonly sendMessageUseCase: SendMessageUseCase,
        private readonly ordersGateway: OrdersGateway,
        private readonly createOrderAfterBillRequestUseCase: CreateOrderAfterBillRequestUseCase,
        private readonly openAIService: OpenAIService,
    ) { }

    async execute(
        phoneNumber: string,
        userMessage: string,
        branch: Branch,
        customer: Customer,
    ): Promise<string> {
        const conversation = await this.conversationRepository.findOne({
            where: { phoneNumber },
        });

        if (!conversation) {
            this.logger.error(`Conversation not found for ${phoneNumber}`);
            return getDefaultFlowMessage('es');
        }

        const lang = conversation.preferredLanguage ?? 'es';
        const allMenuItems: MenuItem[] = branch.menus?.flatMap(m => m.menuItems ?? []) ?? [];
        const activeMenuItems = allMenuItems.filter(i => i.isActive && i.product);

        // ── STATE 1: Awaiting payment method ──────────────────────────────────────
        if (conversation.awaitingPaymentMethod) {
            return this.handlePaymentMethod(userMessage, conversation, branch, customer, lang, allMenuItems);
        }

        // ── STATE 2: Pending order confirmation ───────────────────────────────────
        const hasPending = conversation.pendingOrder && Object.keys(conversation.pendingOrder).length > 0;
        if (hasPending) {
            return this.handlePendingConfirmation(userMessage, conversation, branch, customer, lang, activeMenuItems, allMenuItems);
        }

        // ── STATE 3: Main flow ────────────────────────────────────────────────────
        return this.handleMainFlow(userMessage, conversation, branch, customer, lang, activeMenuItems, allMenuItems);
    }

    // ── State 1 ─────────────────────────────────────────────────────────────────

    private async handlePaymentMethod(
        userMessage: string,
        conversation: Conversation,
        branch: Branch,
        customer: Customer,
        lang: string,
        allMenuItems: MenuItem[],
    ): Promise<string> {
        const paymentMethod = detectPaymentMethodInputUtil(userMessage);

        if (!paymentMethod) {
            return getPaymentMethodRetryMessage(lang);
        }

        // Build full order for the bill
        const fullOrder: OrderItems = { ...(conversation.lastOrderSentToCashier ?? {}) };
        const totalAmount = Object.values(fullOrder).reduce((acc, i) => acc + i.price * i.quantity, 0);

        const cashierMessage =
            `💳 El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* ha solicitado su cuenta.\n\n` +
            `${this.buildOrderLines(fullOrder, allMenuItems)}\n` +
            `Total: $${totalAmount.toFixed(2)}\n` +
            `Método de pago: *${paymentMethod}*`;

        await this.notifyCashier(cashierMessage, branch, customer);

        // Create DB order + delete conversation
        try {
            await this.createOrderAfterBillRequestUseCase.execute(
                customer.id,
                fullOrder,
                branch,
            );
        } catch (e) {
            this.logger.error('Error creating order on bill close:', e);
        }

        await this.conversationRepository.delete({ conversationId: conversation.conversationId });
        this.ordersGateway.emitOrderUpdate(branch.id);

        return getBillClosedMessage(lang, fullOrder, allMenuItems, branch);
    }

    // ── State 2 ─────────────────────────────────────────────────────────────────

    private async handlePendingConfirmation(
        userMessage: string,
        conversation: Conversation,
        branch: Branch,
        customer: Customer,
        lang: string,
        activeMenuItems: MenuItem[],
        allMenuItems: MenuItem[],
    ): Promise<string> {
        // Edge cases: modify on already-confirmed items (cancel is handled below with pending cleanup)
        if (detectModifyKeywordUtil(userMessage)) {
            return getCannotModifyOrderMessage(lang);
        }
        // Split bill while in pending → refusal, stay in state 2
        if (detectSplitBillIntentUtil(userMessage)) {
            return getCannotSplitBillMessage(lang);
        }

        const orderResponse = detectOrderResponseUtil(userMessage);

        // Confirm
        if (orderResponse === 'confirm') {
            return this.confirmOrder(conversation, branch, customer, lang, allMenuItems);
        }

        // Cancel → clear pending
        if (orderResponse === 'cancel') {
            const hasConfirmed = this.hasConfirmedOrder(conversation);
            await this.conversationRepository.update(
                { id: conversation.id },
                { pendingOrder: null } as any,
            );
            if (hasConfirmed) {
                return getCannotCancelConfirmedMessage(lang) + '\n\n' + getMenuWelcomeMessage(lang, branch);
            }
            return getOrderCancelledMessage(lang, branch);
        }

        // Continue (no) → keep pending order, show menu so user can keep adding
        if (orderResponse === 'continue') {
            return getMenuWelcomeMessage(lang, branch);
        }

        // User adds more products while in pending state (multi-item first)
        const foundItems = findAllMenuItemsInMessage(userMessage, activeMenuItems);
        if (foundItems.length > 0) {
            return this.addMultipleItemsAndShowCart(foundItems, conversation, lang, allMenuItems);
        }

        // Single fuzzy match fallback
        const foundItem = findMenuItemFuzzyUtil(userMessage, activeMenuItems);
        if (foundItem) {
            return this.addItemAndShowCart(userMessage, foundItem, conversation, lang, allMenuItems);
        }

        // Unrecognized → re-prompt
        return getConfirmationRePromptMessage(lang);
    }

    // ── State 3 ─────────────────────────────────────────────────────────────────

    private async handleMainFlow(
        userMessage: string,
        conversation: Conversation,
        branch: Branch,
        customer: Customer,
        lang: string,
        activeMenuItems: MenuItem[],
        allMenuItems: MenuItem[],
    ): Promise<string> {
        // 1. Social / farewell
        if (detectSocialMessageUtil(userMessage)) {
            return getSocialResponseMessage(lang, branch);
        }

        // 2. Split bill
        if (detectSplitBillIntentUtil(userMessage)) {
            return getCannotSplitBillMessage(lang);
        }

        // 3. Cancel keyword — only refuse if there's a confirmed order
        if (detectCancelKeywordUtil(userMessage) && this.hasConfirmedOrder(conversation)) {
            return getCannotCancelOrderMessage(lang);
        }

        // 4. Modify keyword — only refuse if there's a confirmed order
        if (detectModifyKeywordUtil(userMessage) && this.hasConfirmedOrder(conversation)) {
            return getCannotModifyOrderMessage(lang);
        }

        // 5. Menu
        if (detectMenuIntentUtil(userMessage)) {
            return getMenuWelcomeMessage(lang, branch);
        }

        // 6. Consumo
        if (detectConsumoIntentUtil(userMessage)) {
            return getConsumoMessage(
                lang,
                conversation.lastOrderSentToCashier ?? null,
                conversation.pendingOrder ?? null,
                allMenuItems,
            );
        }

        // 7. Cuenta — complex: may include products
        if (detectCuentaIntentUtil(userMessage)) {
            const hasConfirmed = this.hasConfirmedOrder(conversation);

            if (hasConfirmed) {
                // Skip payment method selection: notify cashier directly and close conversation
                const fullOrder: OrderItems = { ...(conversation.lastOrderSentToCashier ?? {}) };
                const totalAmount = Object.values(fullOrder).reduce((acc, i) => acc + i.price * i.quantity, 0);

                const cashierMessage =
                    `🧾 El cliente *${customer.name}* en *${conversation.location ?? 'ubicaci\u00f3n desconocida'}* solicita su cuenta.\n\n` +
                    `${this.buildOrderLines(fullOrder, allMenuItems)}\n` +
                    `Total: $${totalAmount.toFixed(2)}`;

                await this.notifyCashier(cashierMessage, branch, customer);

                try {
                    await this.createOrderAfterBillRequestUseCase.execute(customer.id, fullOrder, branch);
                } catch (e) {
                    this.logger.error('Error creating order on bill close:', e);
                }

                await this.conversationRepository.delete({ conversationId: conversation.conversationId });
                this.ordersGateway.emitOrderUpdate(branch.id);

                return getBillClosedMessage(lang, fullOrder, allMenuItems, branch);
            }

            // No confirmed order — check if user also mentioned products (Case 5)
            const foundItems = findAllMenuItemsInMessage(userMessage, activeMenuItems);
            if (foundItems.length > 0) {
                // Add products to pending, show cart (go to state 2)
                return this.addMultipleItemsAndShowCart(foundItems, conversation, lang, allMenuItems);
            }

            return getNoOrderForBillMessage(lang);
        }

        // 8. Recommendations
        if (detectRecommendationIntentUtil(userMessage)) {
            const recommended = activeMenuItems.filter(i => i.shouldRecommend);
            if (recommended.length === 0) return getNoRecommendationsMessage(lang);
            const translatedRecommended = await this.translateItemDescriptions(recommended, lang);
            return getRecommendationsMessage(lang, translatedRecommended);
        }

        // 9. Product info / photo request
        if (detectProductInfoIntentUtil(userMessage) || detectPhotoRequestUtil(userMessage)) {
            const foundItems = findAllMenuItemsInMessage(userMessage, activeMenuItems);

            if (foundItems.length > 1) {
                // Multiple products: show all descriptions
                const translatedItems = await this.translateItemDescriptions(foundItems.map(f => f.item), lang);
                return getMultipleProductInfoMessage(lang, translatedItems);
            }

            if (foundItems.length === 1) {
                const item = foundItems[0].item;
                if (detectPhotoRequestUtil(userMessage) && !item.product?.imageUrl) {
                    return getNoPhotoAvailableMessage(lang, item.product?.name ?? '');
                }
                const [translatedItem] = await this.translateItemDescriptions([item], lang);
                return getProductInfoMessage(lang, translatedItem);
            }

            // Fallback: fuzzy single match
            const foundItem = findMenuItemFuzzyUtil(userMessage, activeMenuItems);
            if (!foundItem) return getProductNotFoundMessage(lang);
            if (detectPhotoRequestUtil(userMessage) && !foundItem.product?.imageUrl) {
                return getNoPhotoAvailableMessage(lang, foundItem.product?.name ?? '');
            }
            const [translatedFoundItem] = await this.translateItemDescriptions([foundItem], lang);
            return getProductInfoMessage(lang, translatedFoundItem);
        }

        // 10. Amenity request
        const { isAmenity, amenities } = detectAmenityIntentUtil(userMessage);
        if (isAmenity) {
            const amenityMsg =
                `🍴 El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* solicita:\n` +
                Object.entries(amenities).map(([k, q]) => `• ${k}: ${q}`).join('\n');
            await this.notifyCashier(amenityMsg, branch, customer);
            return getAmenityResponseMessage(lang, amenities);
        }

        // 11. Inactive product detection — before multi-item so we don't suggest a wrong active match
        const inactiveMatch = findMenuItemFuzzyUtil(userMessage, allMenuItems, true);
        if (inactiveMatch && (!inactiveMatch.isActive || inactiveMatch.product?.isActive === false)) {
            const activeScore = findMenuItemFuzzyUtil(userMessage, activeMenuItems)
                ? scoreMenuItem(userMessage, findMenuItemFuzzyUtil(userMessage, activeMenuItems)!)
                : 0;
            const inactiveScore = scoreMenuItem(userMessage, inactiveMatch, true);
            if (inactiveScore > activeScore) {
                return getProductUnavailableMessage(lang, inactiveMatch.product?.name ?? '');
            }
        }

        // 12. Multi-item order detection
        const foundItems = findAllMenuItemsInMessage(userMessage, activeMenuItems);
        if (foundItems.length > 0) {
            return this.addMultipleItemsAndShowCart(foundItems, conversation, lang, allMenuItems);
        }

        // 12. Classify intent for helpful fallback messages
        const match = classifyMenuMatch(userMessage, activeMenuItems);
        if (match.type === 'partial') {
            return getPartialMatchMessage(lang, branch);
        }
        if (match.type === 'mixed') {
            return getMixedMatchMessage(lang, branch);
        }

        // 13. Unknown intent
        return getDefaultFlowMessage(lang);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private async confirmOrder(
        conversation: Conversation,
        branch: Branch,
        customer: Customer,
        lang: string,
        allMenuItems: MenuItem[],
    ): Promise<string> {
        const pending = conversation.pendingOrder ?? {};
        const last = conversation.lastOrderSentToCashier ?? {};

        // Build merged total order
        const merged: OrderItems = { ...last };
        for (const [key, item] of Object.entries(pending)) {
            if (merged[key]) {
                merged[key] = { ...merged[key], quantity: merged[key].quantity + item.quantity };
            } else {
                merged[key] = item;
            }
        }

        // Only send DELTA to cashier
        const changes = calculateOrderChangesUtil(last, merged, this.logger);

        const orderLines = this.buildOrderLines(changes, allMenuItems);
        const totalChanges = Object.values(changes).reduce((acc, i) => acc + i.price * i.quantity, 0);

        const cashierMessage =
            `🛎️ El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* ha pedido:\n\n` +
            `${orderLines}\n` +
            `Total nuevos items: $${totalChanges.toFixed(2)}`;

        await this.notifyCashier(cashierMessage, branch, customer);

        // Persist merged order, clear pending
        await this.conversationRepository.update(
            { id: conversation.id },
            { lastOrderSentToCashier: merged, pendingOrder: null } as any,
        );

        this.ordersGateway.emitOrderUpdate(branch.id);

        return getOrderConfirmedMessage(lang);
    }

    private async addItemAndShowCart(
        userMessage: string,
        item: MenuItem,
        conversation: Conversation,
        lang: string,
        allMenuItems: MenuItem[],
    ): Promise<string> {
        if (!item.isActive || !item.product?.isActive) {
            return getProductUnavailableMessage(lang, item.product?.name ?? '');
        }

        const { quantity, notes } = extractAddItemIntentUtil(userMessage);
        const productName = item.product.name;
        const key = notes ? `${productName}||${notes}` : productName;

        const currentPending: OrderItems = { ...(conversation.pendingOrder ?? {}) };
        if (currentPending[key]) {
            currentPending[key] = {
                ...currentPending[key],
                quantity: currentPending[key].quantity + quantity,
            };
        } else {
            currentPending[key] = {
                price: Number(item.price),
                quantity,
                menuItemId: item.id,
                notes: notes ?? undefined,
            };
        }

        await this.conversationRepository.update(
            { id: conversation.id },
            { pendingOrder: currentPending } as any,
        );

        // Reload conversation state to get updated values
        const updatedConversation = await this.conversationRepository.findOne({
            where: { id: conversation.id },
        });

        return getCartMessage(
            lang,
            updatedConversation?.pendingOrder ?? currentPending,
            updatedConversation?.lastOrderSentToCashier ?? conversation.lastOrderSentToCashier ?? null,
            allMenuItems,
        );
    }

    private async addMultipleItemsAndShowCart(
        items: FoundOrderItem[],
        conversation: Conversation,
        lang: string,
        allMenuItems: MenuItem[],
    ): Promise<string> {
        const currentPending: OrderItems = { ...(conversation.pendingOrder ?? {}) };

        for (const { item, quantity, notes } of items) {
            if (!item.isActive || !item.product?.isActive) continue;
            const productName = item.product.name;
            const key = notes ? `${productName}||${notes}` : productName;
            if (currentPending[key]) {
                currentPending[key] = {
                    ...currentPending[key],
                    quantity: currentPending[key].quantity + quantity,
                };
            } else {
                currentPending[key] = {
                    price: Number(item.price),
                    quantity,
                    menuItemId: item.id,
                    notes: notes ?? undefined,
                };
            }
        }

        await this.conversationRepository.update(
            { id: conversation.id },
            { pendingOrder: currentPending } as any,
        );

        return getCartMessage(
            lang,
            currentPending,
            conversation.lastOrderSentToCashier ?? null,
            allMenuItems,
        );
    }

    private buildOrderLines(order: OrderItems, allMenuItems: MenuItem[]): string {
        return Object.entries(order)
            .map(([key, item]) => {
                const productName = key.split('||')[0];
                const menuItem = allMenuItems.find(mi => mi.id === item.menuItemId);
                const cat = menuItem?.category?.name ? ` (${menuItem.category.name})` : '';
                const notesStr = item.notes ? ` [${item.notes}]` : '';
                return `• ${productName}${cat}: $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}${notesStr}`;
            })
            .join('\n');
    }

    /**
     * Returns a shallow copy of each MenuItem with the product description
     * translated to `lang` when lang !== 'es'. Descriptions are stored in
     * Spanish; no translation is needed for Spanish conversations.
     */
    private async translateItemDescriptions(items: MenuItem[], lang: string): Promise<MenuItem[]> {
        if (lang === 'es') return items;
        return Promise.all(
            items.map(async (item) => {
                if (!item.product?.description) return item;
                const translatedDescription = await this.openAIService.translateText(
                    item.product.description,
                    lang,
                );
                const productCopy = Object.assign(Object.create(Object.getPrototypeOf(item.product)), item.product);
                productCopy.description = translatedDescription;
                const itemCopy = Object.assign(Object.create(Object.getPrototypeOf(item)), item);
                itemCopy.product = productCopy;
                return itemCopy as MenuItem;
            }),
        );
    }

    private hasConfirmedOrder(conversation: Conversation): boolean {
        return !!(
            conversation.lastOrderSentToCashier &&
            Object.keys(conversation.lastOrderSentToCashier).length > 0
        );
    }

    private async notifyCashier(
        message: string,
        branch: Branch,
        customer: Customer,
    ): Promise<void> {
        try {
            if (branch.phoneNumberReception) {
                await this.sendMessageUseCase.execute(
                    branch.phoneNumberReception,
                    message,
                    branch.phoneNumberAssistant!,
                );
            }

            const notification = await this.cashierNotificationRepository.save({
                branchId: branch.id,
                phoneNumber: customer.phone,
                message,
            });

            this.ordersGateway.emitNotificationUpdate(branch.id, notification);
        } catch (e) {
            this.logger.error('Error notifying cashier:', e);
        }
    }
}
