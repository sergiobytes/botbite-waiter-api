import { Branch } from '../../branches/entities/branch.entity';
import { MenuItem } from '../../menus/entities/menu-item.entity';
import { convertToInlineUrl } from '../../openai/utils/convert-to-inline-url.util';

type Lang = string;
type OrderItem = { price: number; quantity: number; menuItemId: string; notes?: string };
type OrderItems = Record<string, OrderItem>;

// ─── Onboarding ──────────────────────────────────────────────────────────────

const LANGUAGE_SELECTION_PROMPT =
    'Please select your preferred language:\n\n' +
    '🇲🇽 Español\n' +
    '🇺🇸 English\n' +
    '🇫🇷 Français\n' +
    '🇰🇷 한국어';

const LOCATION_REQUEST: Record<string, string> = {
    es: 'Perfecto. 😊 ¿Podrías decirme tu número de mesa o en qué parte te encuentras?\n\nEjemplos: 1, 2, 3 ó A1, A2, barra, terraza',
    en: 'Perfect. 😊 Could you tell me your table number or where you are sitting?\n\nExamples: 1, 2, 3 or A1, A2, bar, terrace',
    fr: 'Parfait. 😊 Pourriez-vous me dire votre numéro de table ou où vous êtes assis ?\n\nExemples: 1, 2, 3 ou A1, A2, bar, terrasse',
    ko: '완벽합니다. 😊 테이블 번호나 어디에 앉아 계신지 알려주시겠어요?\n\n예시: 1, 2, 3 또는 A1, A2, 바, 테라스',
};

const LOCATION_RETRY: Record<string, string> = {
    es: 'Lo siento, primero necesito saber tu ubicación. 📍\n¿Podrías decirme tu número de mesa o en qué parte te encuentras?\n\nEjemplos: 1, 2, 3, 4, 5 ó A1, A2, A3, A4, A5',
    en: 'Sorry, I first need to know your location. 📍\nCould you tell me your table number or where you are sitting?\n\nExamples: 1, 2, 3, 4, 5 or A1, A2, A3, A4, A5',
    fr: "Désolé, j'ai d'abord besoin de connaître votre emplacement. 📍\nPourriez-vous me dire votre numéro de table ou où vous êtes assis ?\n\nExemples: 1, 2, 3, 4, 5 ou A1, A2, A3, A4, A5",
    ko: '죄송합니다, 먼저 위치를 알아야 합니다. 📍\n테이블 번호나 어디에 앉아 계신지 알려주시겠어요?\n\n예시: 1, 2, 3, 4, 5 또는 A1, A2, A3, A4, A5',
};

export const getLanguageSelectionPrompt = (): string => LANGUAGE_SELECTION_PROMPT;

export const getLocationRequestMessage = (lang: string): string =>
    LOCATION_REQUEST[lang] ?? LOCATION_REQUEST['es'];

export const getLocationRetryMessage = (lang: string): string =>
    LOCATION_RETRY[lang] ?? LOCATION_RETRY['es'];

// ─── Menu welcome (after location) ───────────────────────────────────────────

export const getMenuWelcomeMessage = (lang: Lang, branch: Branch): string => {
    const menuLinks = buildMenuLinks(branch);
    const buildSection = (prefix: string, tap: string): string =>
        menuLinks ? `\n\n${prefix}\n${menuLinks}\n\n${tap}` : '';

    const msgs: Record<string, string> = {
        es: `¡Gracias! 😊${buildSection('Puedes ver nuestro menú completo aquí 👇', 'Toca el enlace para verlo 🔵')}\n\nCuando gustes te tomo la orden o puedo darte alguna recomendación`,
        en: `Thank you! 😊${buildSection('You can see our complete menu here 👇', 'Tap the link to view it 🔵')}\n\nWhenever you're ready, I can take your order or give you a recommendation`,
        fr: `Merci ! 😊${buildSection('Vous pouvez voir notre menu complet ici 👇', 'Appuyez sur le lien pour le voir 🔵')}\n\nQuand vous êtes prêt, je peux prendre votre commande ou vous donner une recommandation`,
        ko: `감사합니다! 😊${buildSection('전체 메뉴를 여기서 볼 수 있습니다 👇', '링크를 탭하여 보세요 🔵')}\n\n준비되시면 주문을 받거나 추천을 드릴 수 있습니다`,
    };
    return msgs[lang] ?? msgs['es'];
};

// ─── Recommendations ─────────────────────────────────────────────────────────

export const getRecommendationsMessage = (lang: Lang, items: MenuItem[]): string => {
    const lines = items.map(i => {
        const cat = i.category?.name ? ` (${i.category.name})` : '';
        const desc = i.product?.description
            ? `\n   ${toTitleCase(i.product.description)}`
            : '';
        return `• ${i.product?.name}${cat} — $${Number(i.price).toFixed(2)}${desc}`;
    });

    const itemsStr = lines.join('\n');

    const msgs: Record<string, string> = {
        es: `Claro, estas son nuestras recomendaciones:\n\n${itemsStr}\n\n¿Deseas ordenar alguno de estos a tu pedido?`,
        en: `Sure, here are our recommendations:\n\n${itemsStr}\n\nWould you like to add any of these to your order?`,
        fr: `Bien sûr, voici nos recommandations:\n\n${itemsStr}\n\nSouhaitez-vous en ajouter un à votre commande?`,
        ko: `물론입니다, 저희 추천 메뉴입니다:\n\n${itemsStr}\n\n이 중 하나를 주문에 추가하시겠습니까?`,
    };
    return msgs[lang] ?? msgs['es'];
};

export const getNoRecommendationsMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'En este momento no tenemos recomendaciones especiales. ¿Te gustaría ordenar algo del menú?',
        en: "We don't have special recommendations right now. Would you like to order something from the menu?",
        fr: "Nous n'avons pas de recommandations spéciales en ce moment. Souhaitez-vous commander quelque chose du menu?",
        ko: '현재 특별 추천 메뉴가 없습니다. 메뉴에서 무언가를 주문하시겠습니까?',
    };
    return msgs[lang] ?? msgs['es'];
};

// ─── Product info ─────────────────────────────────────────────────────────────

export const getProductInfoMessage = (lang: Lang, item: MenuItem): string => {
    const name = item.product?.name ?? '';
    const cat = item.category?.name ? ` (${item.category.name})` : '';
    const price = `$${Number(item.price).toFixed(2)}`;
    const desc = item.product?.description
        ? `\n📝 ${toTitleCase(item.product.description)}`
        : '';
    const imageMarker = item.product?.imageUrl
        ? `[SEND_IMAGE:${item.product.imageUrl}]`
        : '';

    const msgs: Record<string, string> = {
        es: `${imageMarker}${name}${cat}\n💰 Precio: ${price}${desc}\n\n¿Deseas ordenar algo a tu pedido?`,
        en: `${imageMarker}${name}${cat}\n💰 Price: ${price}${desc}\n\nWould you like to add something to your order?`,
        fr: `${imageMarker}${name}${cat}\n💰 Prix: ${price}${desc}\n\nSouhaitez-vous ajouter quelque chose à votre commande?`,
        ko: `${imageMarker}${name}${cat}\n💰 가격: ${price}${desc}\n\n주문에 무언가를 추가하시겠습니까?`,
    };
    return msgs[lang] ?? msgs['es'];
};

export const getProductNotFoundMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Lo siento, no encontré ese producto en nuestro menú. ¿Podrías indicarme el nombre exacto o pedir recomendaciones?',
        en: "Sorry, I couldn't find that product in our menu. Could you give me the exact name or ask for recommendations?",
        fr: "Désolé, je n'ai pas trouvé ce produit dans notre menu. Pourriez-vous me donner le nom exact ou demander des recommandations?",
        ko: '죄송합니다, 메뉴에서 그 제품을 찾을 수 없습니다. 정확한 이름을 알려주시거나 추천을 요청해 주세요.',
    };
    return msgs[lang] ?? msgs['es'];
};

export const getProductUnavailableMessage = (lang: Lang, productName: string): string => {
    const msgs: Record<string, string> = {
        es: `Lo sentimos, "${productName}" no está disponible en este momento. ¿Te gustaría ordenar otra cosa?`,
        en: `Sorry, "${productName}" is not available right now. Would you like to order something else?`,
        fr: `Désolé, "${productName}" n'est pas disponible en ce moment. Souhaitez-vous commander autre chose?`,
        ko: `죄송합니다, "${productName}"은(는) 현재 이용할 수 없습니다. 다른 것을 주문하시겠습니까?`,
    };
    return msgs[lang] ?? msgs['es'];
};

// ─── Order / Cart ─────────────────────────────────────────────────────────────

export const getCartMessage = (
    lang: Lang,
    pendingOrder: OrderItems,
    lastOrderSentToCashier: OrderItems | null,
    allMenuItems: MenuItem[],
): string => {
    const { lines, total } = buildOrderDisplay(pendingOrder, lastOrderSentToCashier, allMenuItems);
    const itemsStr = lines.join('\n');

    const confirmOptions: Record<string, string> = {
        es: '✅ *Sí*, para confirmar\n❌ *No*, para continuar agregando\n🔄 *Cancelar*, para reiniciar la orden',
        en: '✅ *Yes*, to confirm\n❌ *No*, to continue adding\n🔄 *Cancel*, to restart the order',
        fr: '✅ *Oui*, pour confirmer\n❌ *Non*, pour continuer à ajouter\n🔄 *Annuler*, pour recommencer',
        ko: '✅ *네*, 확인하려면\n❌ *아니요*, 계속 추가하려면\n🔄 *취소*, 주문을 다시 시작하려면',
    };

    const headers: Record<string, string> = {
        es: 'He agregado a tu pedido:',
        en: "I've added to your order:",
        fr: "J'ai ajouté à votre commande:",
        ko: '주문에 추가했습니다:',
    };

    const totals: Record<string, string> = {
        es: `Total: $${total.toFixed(2)}`,
        en: `Total: $${total.toFixed(2)}`,
        fr: `Total: $${total.toFixed(2)}`,
        ko: `합계: $${total.toFixed(2)}`,
    };

    const questions: Record<string, string> = {
        es: '¿Deseas confirmar tu pedido?',
        en: 'Would you like to confirm your order?',
        fr: 'Souhaitez-vous confirmer votre commande?',
        ko: '주문을 확인하시겠습니까?',
    };

    const header = headers[lang] ?? headers['es'];
    const totalStr = totals[lang] ?? totals['es'];
    const question = questions[lang] ?? questions['es'];
    const options = confirmOptions[lang] ?? confirmOptions['es'];

    return `${header}\n\n${itemsStr}\n\n${totalStr}\n\n${question}\n${options}`;
};

export const getConfirmationRePromptMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: "Ya casi terminamos. Solo dime *Sí* para enviar tu pedido, *No* para seguir agregando o *Cancelar* para reiniciar.",
        en: "Almost there! Just say *Yes* to send your order, *No* to keep adding, or *Cancel* to restart.",
        fr: "On y est presque! Dites *Oui* pour envoyer votre commande, *Non* pour continuer ou *Annuler* pour recommencer.",
        ko: "거의 다 됐어요! *네*를 말씀하시면 주문을 보내고, *아니요*는 계속 추가, *취소*는 다시 시작합니다.",
    };
    return msgs[lang] ?? msgs['es'];
};

export const getOrderConfirmedMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Perfecto, gracias por confirmar, tu pedido está ahora en proceso. 🎉\n\nSi necesitas ordenar algo más, no dudes en decírmelo.\nEscribe *"Consumo"* para ver el resumen de tu pedido\nO la palabra *"Cuenta"* para cerrar tus pedidos',
        en: 'Perfect, thank you for confirming, your order is now being processed. 🎉\n\nIf you need to order anything else, feel free to let me know.\nType *"Consumo"* to see your order summary\nOr *"Cuenta"* to close your tab',
        fr: 'Parfait, merci de confirmer, votre commande est maintenant en cours de traitement. 🎉\n\nSi vous avez besoin de commander autre chose, n\'hésitez pas à me le dire.\nÉcrivez *"Consumo"* pour voir le résumé de votre commande\nOu le mot *"Cuenta"* pour fermer vos commandes',
        ko: '완벽합니다. 확인해 주셔서 감사합니다. 주문이 이제 처리 중입니다. 🎉\n\n더 주문하실 것이 있으면 말씀해 주세요.\n*"Consumo"*를 입력하면 주문 요약을 볼 수 있습니다\n*"Cuenta"*를 입력하면 탭을 닫을 수 있습니다',
    };
    return msgs[lang] ?? msgs['es'];
};

export const getOrderCancelledMessage = (lang: Lang, branch: Branch): string =>
    getMenuWelcomeMessage(lang, branch);

export const getCannotCancelConfirmedMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Tu pedido anterior ya fue confirmado y no puede cancelarse. Para cualquier cambio, habla con uno de nuestros meseros. 😊',
        en: 'Your previous order has already been confirmed and cannot be cancelled. For any changes, please speak with one of our staff members. 😊',
        fr: 'Votre commande précédente a déjà été confirmée et ne peut pas être annulée. Pour tout changement, veuillez parler à un membre de notre personnel. 😊',
        ko: '이전 주문은 이미 확인되었으며 취소할 수 없습니다. 변경 사항은 직원에게 말씀해 주세요. 😊',
    };
    return msgs[lang] ?? msgs['es'];
};

// ─── Amenities ────────────────────────────────────────────────────────────────

export const getAmenityResponseMessage = (lang: Lang, amenities: Record<string, number>): string => {
    const list = Object.entries(amenities)
        .map(([k, q]) => `${k}${q > 1 ? ` x${q}` : ''}`)
        .join(', ');

    const msgs: Record<string, string> = {
        es: `¡Claro! 🍴 En un momento te llevamos: ${list}.`,
        en: `Of course! 🍴 We'll bring you shortly: ${list}.`,
        fr: `Bien sûr! 🍴 Nous vous apporterons dans un instant: ${list}.`,
        ko: `물론입니다! 🍴 곧 가져다 드리겠습니다: ${list}.`,
    };
    return msgs[lang] ?? msgs['es'];
};

// ─── Consumo ──────────────────────────────────────────────────────────────────

export const getConsumoMessage = (
    lang: Lang,
    lastOrderSentToCashier: OrderItems | null,
    pendingOrder: OrderItems | null,
    allMenuItems: MenuItem[],
): string => {
    const combined: OrderItems = { ...(lastOrderSentToCashier ?? {}) };
    for (const [key, item] of Object.entries(pendingOrder ?? {})) {
        if (combined[key]) {
            combined[key] = { ...combined[key], quantity: combined[key].quantity + item.quantity };
        } else {
            combined[key] = item;
        }
    }

    if (Object.keys(combined).length === 0) {
        const empty: Record<string, string> = {
            es: 'Aún no tienes ningún producto en tu pedido. ¿Te gustaría ordenar algo?',
            en: "You don't have any items in your order yet. Would you like to order something?",
            fr: "Vous n'avez pas encore d'articles dans votre commande. Souhaitez-vous commander quelque chose?",
            ko: '아직 주문한 항목이 없습니다. 무언가를 주문하시겠습니까?',
        };
        return empty[lang] ?? empty['es'];
    }

    const { lines, total } = buildOrderDisplay(combined, null, allMenuItems);

    const headers: Record<string, string> = {
        es: 'Este es tu consumo hasta ahora:',
        en: 'This is your consumption so far:',
        fr: 'Voici votre consommation jusqu\'à présent:',
        ko: '현재까지의 소비 내역입니다:',
    };

    const totals: Record<string, string> = {
        es: `Total calculado: $${total.toFixed(2)}`,
        en: `Calculated total: $${total.toFixed(2)}`,
        fr: `Total calculé: $${total.toFixed(2)}`,
        ko: `계산된 합계: $${total.toFixed(2)}`,
    };

    const footers: Record<string, string> = {
        es: 'Si necesitas ordenar algo más, no dudes en decídmelo.\nEscribe *"Consumo"* para ver el resumen de tu pedido\nO la palabra *"Cuenta"* para cerrar tus pedidos',
        en: "If you need to order anything else, feel free to let me know.\nType *\"Consumo\"* to see your order summary\nOr *\"Cuenta\"* to close your tab",
        fr: "Si vous avez besoin de commander autre chose, n'hésitez pas à me le dire.\nÉcrivez *\"Consumo\"* pour voir le résumé de votre commande\nOu le mot *\"Cuenta\"* pour fermer vos commandes",
        ko: '더 주문하실 것이 있으면 말씀해 주세요.\n*"Consumo"*를 입력하면 주문 요약을 볼 수 있습니다\n*"Cuenta"*를 입력하면 탭을 닫을 수 있습니다',
    };

    const header = headers[lang] ?? headers['es'];
    const totalStr = totals[lang] ?? totals['es'];
    const footer = footers[lang] ?? footers['es'];

    return `${header}\n\n${lines.join('\n')}\n\n${totalStr}\n\n${footer}`;
};

// ─── Cuenta / Bill ────────────────────────────────────────────────────────────

export const getPaymentMethodRequestMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Para cerrar tu cuenta, por favor indícame tu método de pago:\n\n💵 *Efectivo*\n💳 *Tarjeta*',
        en: 'To close your tab, please tell me your payment method:\n\n💵 *Cash*\n💳 *Card*',
        fr: 'Pour fermer votre compte, veuillez indiquer votre mode de paiement:\n\n💵 *Espèces*\n💳 *Carte*',
        ko: '계산을 위해 결제 방법을 알려주세요:\n\n💵 *현금*\n💳 *카드*',
    };
    return msgs[lang] ?? msgs['es'];
};

export const getPaymentMethodRetryMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'No entendí tu método de pago. Por favor responde:\n\n💵 *Efectivo*\n💳 *Tarjeta*',
        en: "I didn't understand your payment method. Please reply:\n\n💵 *Cash*\n💳 *Card*",
        fr: "Je n'ai pas compris votre mode de paiement. Veuillez répondre:\n\n💵 *Espèces*\n💳 *Carte*",
        ko: '결제 방법을 이해하지 못했습니다. 다음으로 대답해 주세요:\n\n💵 *현금*\n💳 *카드*',
    };
    return msgs[lang] ?? msgs['es'];
};

export const getNoOrderForBillMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Aún no tienes ningún pedido confirmado. ¿Te gustaría ordenar algo primero?',
        en: "You don't have any confirmed orders yet. Would you like to order something first?",
        fr: "Vous n'avez pas encore de commande confirmée. Souhaitez-vous commander quelque chose d'abord?",
        ko: '아직 확인된 주문이 없습니다. 먼저 무언가를 주문하시겠습니까?',
    };
    return msgs[lang] ?? msgs['es'];
};

export const getBillClosedMessage = (
    lang: Lang,
    lastOrderSentToCashier: OrderItems,
    allMenuItems: MenuItem[],
    branch: Branch,
): string => {
    const { lines, total } = buildOrderDisplay(lastOrderSentToCashier, null, allMenuItems);

    const surveyLine = branch.surveyUrl
        ? `\n\nPor favor, completa esta breve encuesta de satisfacción:\n🔗 ${branch.surveyUrl}`
        : '';

    const headers: Record<string, string> = {
        es: 'En este momento hemos cerrado tu cuenta, aquí tienes el resumen de tu pedido:',
        en: "We've just closed your tab. Here is your order summary:",
        fr: 'Nous venons de fermer votre compte. Voici le résumé de votre commande:',
        ko: '지금 계산서를 마감했습니다. 주문 요약이 여기 있습니다:',
    };

    const totals: Record<string, string> = {
        es: `Total calculado: $${total.toFixed(2)}`,
        en: `Calculated total: $${total.toFixed(2)}`,
        fr: `Total calculé: $${total.toFixed(2)}`,
        ko: `계산된 합계: $${total.toFixed(2)}`,
    };

    const footers: Record<string, string> = {
        es: `En unos momentos se acercará alguien de nuestro personal para apoyarte con el pago. Gracias por tu preferencia.${surveyLine}`,
        en: `Someone from our staff will come to assist you with payment in a few moments. Thank you for your preference.${surveyLine}`,
        fr: `Quelqu'un de notre personnel viendra vous aider avec le paiement dans quelques instants. Merci de votre confiance.${surveyLine}`,
        ko: `곧 직원이 결제를 도와드리러 올 것입니다. 이용해 주셔서 감사합니다.${surveyLine}`,
    };

    const header = headers[lang] ?? headers['es'];
    const totalStr = totals[lang] ?? totals['es'];
    const footer = footers[lang] ?? footers['es'];

    return `${header}\n\n${lines.join('\n')}\n\n${totalStr}\n\n${footer}`;
};

// ─── Default / Fallback ───────────────────────────────────────────────────────

export const getDefaultFlowMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Lo siento, en este momento solo puedo ayudarte a tomar la orden o recomendarte opciones del menú. 😊\n\n¿Te gustaría ordenar algo o ver nuestras recomendaciones?',
        en: "I'm sorry, right now I can only help you place an order or recommend menu options. 😊\n\nWould you like to order something or see our recommendations?",
        fr: "Désolé, je peux seulement vous aider à passer une commande ou vous recommander des options du menu. 😊\n\nSouhaitez-vous commander quelque chose ou voir nos recommandations?",
        ko: '죄송합니다, 현재는 주문을 받거나 메뉴 옵션을 추천하는 것만 도와드릴 수 있습니다. 😊\n\n무언가를 주문하거나 추천을 보시겠습니까?',
    };
    return msgs[lang] ?? msgs['es'];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMenuLinks(branch: Branch): string {
    const pdfMenus = branch.menus?.filter(
        m => m.pdfLink && m.pdfLink !== 'None' && m.pdfLink.trim() !== '',
    ) ?? [];
    return pdfMenus.map(m => `📋 ${convertToInlineUrl(m.pdfLink!, m.id, m.name)}`).join('\n');
}

export function buildOrderDisplay(
    mainOrder: OrderItems,
    previousOrder: OrderItems | null,
    allMenuItems: MenuItem[],
): { lines: string[]; total: number } {
    // Merge previousOrder into mainOrder (summing quantities)
    const combined: OrderItems = { ...(previousOrder ?? {}) };
    for (const [key, item] of Object.entries(mainOrder)) {
        if (combined[key]) {
            combined[key] = { ...combined[key], quantity: combined[key].quantity + item.quantity };
        } else {
            combined[key] = item;
        }
    }

    const lines: string[] = [];
    let total = 0;

    for (const [key, item] of Object.entries(combined)) {
        const productName = key.split('||')[0];
        const menuItem = allMenuItems.find(mi => mi.id === item.menuItemId);
        const cat = menuItem?.category?.name ? ` (${menuItem.category.name})` : '';
        const subtotal = item.price * item.quantity;
        total += subtotal;
        const notesStr = item.notes ? ` [${item.notes}]` : '';
        lines.push(`• ${productName}${cat}: $${item.price.toFixed(2)} x ${item.quantity} = $${subtotal.toFixed(2)}${notesStr}`);
    }

    return { lines, total };
}

function toTitleCase(str: string): string {
    return str
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Variant / edge-case messages ────────────────────────────────────────────

/** "Tenemos varias opciones de ese producto, ¿cuál quieres?" */
export const getPartialMatchMessage = (lang: Lang, branch: Branch): string => {
    const menuLinks = buildMenuLinks(branch);
    const linkLine = menuLinks ? `\n\n${menuLinks}` : '';
    const msgs: Record<string, string> = {
        es: `Tenemos varias opciones de ese producto, ¿me podrías especificar cuál quieres? 😊${linkLine}`,
        en: `We have several options for that product, could you specify which one you'd like? 😊${linkLine}`,
        fr: `Nous avons plusieurs options pour ce produit, pourriez-vous préciser lequel vous souhaitez ? 😊${linkLine}`,
        ko: `그 제품에 대한 여러 옵션이 있습니다. 어떤 것을 원하시는지 알려주시겠어요? 😊${linkLine}`,
    };
    return msgs[lang] ?? msgs['es'];
};

/** "Lo que mencionas combina elementos de distintos productos, confírmame cuál quieres" */
export const getMixedMatchMessage = (lang: Lang, branch: Branch): string => {
    const menuLinks = buildMenuLinks(branch);
    const linkLine = menuLinks ? `\n\n${menuLinks}` : '';
    const msgs: Record<string, string> = {
        es: `Con gusto te apoyo. Solo necesito que me confirmes el producto exacto, ya que lo que mencionas combina elementos de distintos productos. 😊${linkLine}`,
        en: `Happy to help! I just need you to confirm the exact product, since what you mentioned combines elements from different products. 😊${linkLine}`,
        fr: `Avec plaisir ! J'ai juste besoin que vous confirmiez le produit exact, car ce que vous avez mentionné combine des éléments de différents produits. 😊${linkLine}`,
        ko: `기꺼이 도와드리겠습니다! 말씀하신 내용이 서로 다른 제품의 요소를 결합하고 있어서 정확한 제품을 확인해 주시겠어요? 😊${linkLine}`,
    };
    return msgs[lang] ?? msgs['es'];
};

/** "Lo siento no puedo cancelar/modificar productos confirmados" */
export const getCannotCancelOrderMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Lo siento, no puedo cancelar productos ya confirmados. Cuando gustes puedes ordenar algo más o pedir alguna recomendación. 😊',
        en: "I'm sorry, I can't cancel already confirmed products. Feel free to order something else or ask for a recommendation. 😊",
        fr: "Désolé, je ne peux pas annuler des produits déjà confirmés. N'hésitez pas à commander autre chose ou à demander une recommandation. 😊",
        ko: '죄송합니다, 이미 확인된 제품을 취소할 수 없습니다. 다른 것을 주문하거나 추천을 요청하셔도 됩니다. 😊',
    };
    return msgs[lang] ?? msgs['es'];
};

export const getCannotModifyOrderMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Lo siento, no puedo modificar productos ya confirmados. Cuando gustes puedes ordenar algo más o pedir alguna recomendación. 😊',
        en: "I'm sorry, I can't modify already confirmed products. Feel free to order something else or ask for a recommendation. 😊",
        fr: "Désolé, je ne peux pas modifier des produits déjà confirmés. N'hésitez pas à commander autre chose ou à demander une recommandation. 😊",
        ko: '죄송합니다, 이미 확인된 제품을 수정할 수 없습니다. 다른 것을 주문하거나 추천을 요청하셔도 됩니다. 😊',
    };
    return msgs[lang] ?? msgs['es'];
};

/** "No puedo dividir cuentas" */
export const getCannotSplitBillMessage = (lang: Lang): string => {
    const msgs: Record<string, string> = {
        es: 'Lo siento, en este momento solo puedo tomar tu pedido. Cuando gustes puedes ordenar algo a tu pedido o pedir alguna recomendación. 😊',
        en: "I'm sorry, right now I can only take your order. Feel free to add items to your order or ask for a recommendation. 😊",
        fr: "Désolé, pour le moment je ne peux que prendre votre commande. N'hésitez pas à ajouter des articles ou à demander une recommandation. 😊",
        ko: '죄송합니다, 지금은 주문을 받는 것만 가능합니다. 주문에 항목을 추가하거나 추천을 요청하셔도 됩니다. 😊',
    };
    return msgs[lang] ?? msgs['es'];
};

/** Farewell / social message response */
export const getSocialResponseMessage = (lang: Lang, branch: Branch): string => {
    const menuLinks = buildMenuLinks(branch);
    const linkLine = menuLinks ? `\n\n${menuLinks}` : '';
    const msgs: Record<string, string> = {
        es: `¡Que tengas un buen día! 😊 Cuando gustes, aquí estoy para tomar tu orden.${linkLine}`,
        en: `Have a great day! 😊 Whenever you're ready, I'm here to take your order.${linkLine}`,
        fr: `Bonne journée ! 😊 Quand vous le souhaitez, je suis là pour prendre votre commande.${linkLine}`,
        ko: `좋은 하루 되세요! 😊 준비가 되시면 주문을 받겠습니다.${linkLine}`,
    };
    return msgs[lang] ?? msgs['es'];
};

/** Multiple product info (2+ products) */
export const getMultipleProductInfoMessage = (lang: Lang, items: MenuItem[]): string => {
    const blocks = items.map(item => {
        const name = item.product?.name ?? '';
        const cat = item.category?.name ? ` (${item.category.name})` : '';
        const price = `$${Number(item.price).toFixed(2)}`;
        const desc = item.product?.description ? `\n   📝 ${toTitleCase(item.product.description)}` : '';
        const imgMarker = item.product?.imageUrl ? `[SEND_IMAGE:${item.product.imageUrl}]` : '';
        return `${imgMarker}*${name}*${cat} — ${price}${desc}`;
    }).join('\n\n');

    const footers: Record<string, string> = {
        es: '¿Deseas ordenar algo a tu pedido?',
        en: 'Would you like to add something to your order?',
        fr: 'Souhaitez-vous ajouter quelque chose à votre commande?',
        ko: '주문에 무언가를 추가하시겠습니까?',
    };
    const footer = footers[lang] ?? footers['es'];
    return `${blocks}\n\n${footer}`;
};

/** No photo available for product */
export const getNoPhotoAvailableMessage = (lang: Lang, productName: string): string => {
    const msgs: Record<string, string> = {
        es: `Lo siento, en este momento no tengo foto cargada de *${productName}*. ¿Deseas ordenar algo a tu pedido?`,
        en: `I'm sorry, I don't have a photo loaded for *${productName}* right now. Would you like to add something to your order?`,
        fr: `Désolé, je n'ai pas de photo chargée pour *${productName}* en ce moment. Souhaitez-vous ajouter quelque chose à votre commande?`,
        ko: `죄송합니다, 현재 *${productName}*의 사진이 없습니다. 주문에 무언가를 추가하시겠습니까?`,
    };
    return msgs[lang] ?? msgs['es'];
};

/** Photo request keywords */
export const detectPhotoRequestUtil = (message: string): boolean => {
    return /\b(foto|fotograf[ií]a|image[n]?|imagen|photo|picture|pic|ver|show|muéstrame|enséñame|cómo\s+(?:es|se\s+ve)|como\s+(?:es|se\s+ve)|보여|사진)\b/i.test(message);
};


