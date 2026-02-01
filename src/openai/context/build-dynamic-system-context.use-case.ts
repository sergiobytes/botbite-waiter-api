import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { convertToInlineUrl } from '../utils/convert-to-inline-url.util';
import { CustomerIntention } from '../utils/detect-customer-intention.util';
import {
  BASE_RULES,
  LANGUAGE_DETECTION_PROMPT,
  LOCATION_PROMPT,
  MENU_DISPLAY_PROMPT,
  ORDER_TAKING_PROMPT,
  ORDER_CONFIRMATION_PROMPT,
  CATEGORY_DISPLAY_PROMPT,
  RECOMMENDATIONS_PROMPT,
  BUDGET_PROMPT,
  TOTAL_QUERY_PROMPT,
  BILL_REQUEST_PROMPT,
  PAYMENT_METHOD_PROMPT,
  AMENITIES_PROMPT,
  PRODUCT_MATCHING_PROMPT,
  SEPARATE_ACCOUNTS_PROMPT,
} from './prompt-templates';

/**
 * Construye el contexto del sistema de forma dinámica según la intención del cliente
 * Esto optimiza el uso de tokens y mejora la precisión del modelo al enfocarse en una tarea específica
 */
export const buildDynamicSystemContext = (
  intention: CustomerIntention,
  customerContext?: Customer,
  branchContext?: Branch,
  offTopicRedirectionCount = 0,
  lastOrderSentToCashier?: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > | null,
  preferredLanguage?: string | null,
): string => {
  // Determinar si hay menú PDF disponible
  // IMPORTANTE: pdfLink puede ser null, undefined, vacío o la cadena "None" cuando no está disponible
  const hasPdfMenu = branchContext?.menus?.some(
    (menu) =>
      menu.pdfLink && menu.pdfLink !== 'None' && menu.pdfLink.trim() !== '',
  );
  const pdfMenus =
    branchContext?.menus?.filter(
      (menu) =>
        menu.pdfLink && menu.pdfLink !== 'None' && menu.pdfLink.trim() !== '',
    ) || [];

  // Construir información del restaurante
  let restaurantInfo = branchContext
    ? `
🏪 RESTAURANTE:
- ${branchContext.name}
- ${branchContext.address}
- Tel: ${branchContext.phoneNumberReception}
${
  branchContext.menus?.length
    ? branchContext.menus
        .map((menu) => {
          // Eliminar duplicados de productos usando Map para mantener solo el primero de cada nombre
          const uniqueItems = new Map();
          menu.menuItems?.forEach((item) => {
            if (item.isActive) {
              const key = `${item.product.name}-${item.category.name}`;
              if (!uniqueItems.has(key)) {
                uniqueItems.set(key, item);
              }
            }
          });

          return `
${menu.pdfLink && menu.pdfLink !== 'None' && menu.pdfLink.trim() !== '' ? convertToInlineUrl(menu.pdfLink, menu.id, menu.name) : '—'}
${menu.name}:
${Array.from(uniqueItems.values())
  .map((item) => {
    const recommended = item.shouldRecommend ? '⭐ RECOMENDADO' : '';
    const imageUrl = item.product.imageUrl
      ? `\n  ImageUrl: ${item.product.imageUrl}`
      : '';
    const description = item.product.description
      ? `\n  Descripción: ${item.product.description}`
      : '';
    return `• [ID:${item.id}] ${item.product.name} (${item.category.name}): $${item.price}${recommended ? ` ${recommended}` : ''}${description}${imageUrl}`;
  })
  .join('\n')}`;
        })
        .join('\n')
    : ''
}`
    : '';

  const customerInfo = customerContext
    ? `
👤 CLIENTE:
${customerContext.name}, Tel: ${customerContext.phone}`
    : '';

  // Agregar información del idioma preferido si está configurado
  let languageInstruction = '';
  if (preferredLanguage) {
    const languageNames = {
      es: 'Español',
      en: 'English',
      fr: 'Français',
      ko: '한국어',
      de: 'Deutsch',
      it: 'Italiano',
      pt: 'Português',
    };
    const languageName = languageNames[preferredLanguage] || preferredLanguage;
    languageInstruction = `

🌍 IDIOMA PREFERIDO DEL CLIENTE: ${languageName} (${preferredLanguage})
⚠️ **OBLIGATORIO**: TODA tu conversación DEBE ser en ${languageName}
- NO cambies a ningún otro idioma
- Ignora si el cliente escribe ocasionalmente en otro idioma
- SIEMPRE responde en ${languageName}
`;
  }

  // Calcular total del pedido desde lastOrderSentToCashier
  let orderTotalInfo = '';
  if (
    lastOrderSentToCashier &&
    Object.keys(lastOrderSentToCashier).length > 0
  ) {
    const total = Object.values(lastOrderSentToCashier).reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    orderTotalInfo = `

💰 TOTAL DEL PEDIDO ACTUAL:
- Total calculado del backend: $${total.toFixed(2)}
- **IMPORTANTE**: USA ESTE TOTAL cuando muestres el pedido completo al cliente
- Este es el total OFICIAL que se enviará a caja
- NO calcules el total manualmente, USA este valor`;
  }

  // Seleccionar prompts según la intención
  let specificPrompts = '';

  switch (intention) {
    case CustomerIntention.LANGUAGE_SELECTION:
      specificPrompts = LANGUAGE_DETECTION_PROMPT;
      break;

    case CustomerIntention.LOCATION_NEEDED:
      // CRITICAL: DO NOT include menu context when location is missing
      // This prevents the model from processing orders without location
      specificPrompts = LOCATION_PROMPT;

      // Clear restaurant info to prevent order processing
      restaurantInfo = branchContext
        ? `
🏪 RESTAURANTE:
- ${branchContext.name}
- ${branchContext.address}
- Tel: ${branchContext.phoneNumberReception}
(Menú no disponible hasta que proporciones tu ubicación)`
        : '';
      break;

    case CustomerIntention.VIEW_MENU:
      // Mostrar menú: si hay PDF mostrar enlace, si no mostrar solo el mensaje simple
      if (hasPdfMenu) {
        specificPrompts = `${MENU_DISPLAY_PROMPT}

**ACCIÓN**: Proporciona INMEDIATAMENTE el enlace del menú PDF EN SU IDIOMA:
- **Español**: "¡Perfecto! Puedes ver nuestro menú completo aquí 👇\\n📄 ${pdfMenus.map((m) => convertToInlineUrl(m.pdfLink!, m.id, m.name)).join('\\n📄 ')}\\n\\nToca el enlace para verlo 📱\\n\\n¿Ya sabes qué te gustaría ordenar o necesitas ayuda?"
- **Inglés**: "Perfect! You can see our complete menu here 👇\\n📄 ${pdfMenus.map((m) => convertToInlineUrl(m.pdfLink!, m.id, m.name)).join('\\n📄 ')}\\n\\nTap the link to view it 📱\\n\\nDo you know what you'd like to order or need help?"`;
      } else {
        specificPrompts = `${MENU_DISPLAY_PROMPT}

**ACCIÓN**: Responde SOLO con el mensaje EN SU IDIOMA (NO incluyas categorías):
- **Español**: "¿Ya sabes qué quieres ordenar 📝?\\nSi necesitas información sobre algún platillo específico, no dudes en preguntar"
- **Inglés**: "Do you already know what you want to order 📝?\\nIf you need information about any specific dish, feel free to ask"`;
      }
      break;

    case CustomerIntention.VIEW_CATEGORY:
      specificPrompts = `${CATEGORY_DISPLAY_PROMPT}\n\n${PRODUCT_MATCHING_PROMPT}`;
      break;

    case CustomerIntention.PLACE_ORDER:
      specificPrompts = `${ORDER_TAKING_PROMPT}\n\n${PRODUCT_MATCHING_PROMPT}\n\n${SEPARATE_ACCOUNTS_PROMPT}`;
      break;

    case CustomerIntention.CONFIRM_ORDER:
      specificPrompts = ORDER_CONFIRMATION_PROMPT;
      break;

    case CustomerIntention.REQUEST_RECOMMENDATIONS:
      specificPrompts = `${RECOMMENDATIONS_PROMPT}\n\n${PRODUCT_MATCHING_PROMPT}`;
      break;

    case CustomerIntention.BUDGET_INQUIRY:
      specificPrompts = `${BUDGET_PROMPT}\n\n${PRODUCT_MATCHING_PROMPT}`;
      break;

    case CustomerIntention.TOTAL_QUERY:
      specificPrompts = `${TOTAL_QUERY_PROMPT}\n\n${SEPARATE_ACCOUNTS_PROMPT}`;
      break;

    case CustomerIntention.REQUEST_BILL:
      specificPrompts = `${BILL_REQUEST_PROMPT}\n\n${SEPARATE_ACCOUNTS_PROMPT}`;
      if (branchContext?.surveyUrl) {
        specificPrompts += `\n\n**ENCUESTA DE SATISFACCI\u00d3N DISPONIBLE**: Despu\u00e9s de confirmar el m\u00e9todo de pago, agrega:\n\n"\ud83d\udcdd Nos encantar\u00eda conocer tu opini\u00f3n sobre tu experiencia. Por favor, completa esta breve encuesta de satisfacci\u00f3n:\n\ud83d\udd17 ${branchContext.surveyUrl}\n\n\u00a1Que tengas un excelente d\u00eda!"\n\n(Ajusta el mensaje al idioma del cliente: ingl\u00e9s, franc\u00e9s, etc.)`;
      }
      break;

    case CustomerIntention.PAYMENT_METHOD:
      specificPrompts = PAYMENT_METHOD_PROMPT;
      if (branchContext?.surveyUrl) {
        specificPrompts += `\n\n**ENCUESTA DE SATISFACCI\u00d3N DISPONIBLE**: Despu\u00e9s de confirmar el m\u00e9todo de pago, agrega:\n\n"\ud83d\udcdd Nos encantar\u00eda conocer tu opini\u00f3n sobre tu experiencia. Por favor, completa esta breve encuesta de satisfacci\u00f3n:\n\ud83d\udd17 ${branchContext.surveyUrl}\n\n\u00a1Que tengas un excelente d\u00eda!"\n\n(Ajusta el mensaje al idioma del cliente: ingl\u00e9s, franc\u00e9s, etc.)`;
      }
      break;

    case CustomerIntention.REQUEST_AMENITIES:
      specificPrompts = AMENITIES_PROMPT;
      break;

    case CustomerIntention.GENERAL:
    default:
      // Para conversación general, incluir contexto básico
      specificPrompts = `${PRODUCT_MATCHING_PROMPT}\n\n${SEPARATE_ACCOUNTS_PROMPT}`;
      break;
  }

  // Agregar instrucciones dinámicas basadas en redirecciones fuera de contexto
  let offTopicInstructions = '';
  if (offTopicRedirectionCount >= 1) {
    offTopicInstructions = `

🚨 **INSTRUCCIÓN CRÍTICA - YA HAS REDIRIGIDO ${offTopicRedirectionCount} VEZ/VECES**:
- El cliente ha intentado conversación fuera de contexto y ya lo redirigiste ${offTopicRedirectionCount} vez/veces
- **SI el mensaje actual es NUEVAMENTE fuera de contexto (no relacionado con pedidos/menú/cuenta)**:
  * **NO REPITAS** el mensaje de redirección ("Gracias por tu interés...")
  * **ENVÍA el mensaje de TERMINACIÓN** EN SU IDIOMA:
    - **Español**: "Entiendo. Si más adelante necesitas hacer un pedido o consultar el menú, estaré disponible para ayudarte. ¡Que tengas un excelente día!"
    - **Inglés**: "I understand. If you need to place an order or check the menu later, I'll be available to help you. Have a great day!"
    - **Francés**: "Je comprends. Si vous avez besoin de passer une commande ou de consulter le menu plus tard, je serai disponible pour vous aider. Passez une excellente journée!"
- **SI el mensaje actual SÍ es relacionado con pedidos/menú/cuenta**: Procesa normalmente
`;
  }

  // Construir el prompt final
  return `${BASE_RULES}${offTopicInstructions}

${specificPrompts}

${restaurantInfo}

${customerInfo}${languageInstruction}
${orderTotalInfo}
`;
};
