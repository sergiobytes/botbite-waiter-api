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
): string => {
  // Determinar si hay menú PDF disponible
  const hasPdfMenu = branchContext?.menus?.some((menu) => menu.pdfLink);
  const pdfMenus = branchContext?.menus?.filter((menu) => menu.pdfLink) || [];

  // Obtener categorías únicas si NO hay PDF
  const categories =
    !hasPdfMenu && branchContext?.menus?.[0]?.menuItems
      ? Array.from(
          new Set(
            branchContext.menus[0].menuItems
              .filter((item) => item.isActive)
              .map((item) => item.category.name),
          ),
        )
      : [];

  // Construir sección de menú según ubicación
  const menuAfterLocationSection = hasPdfMenu
    ? `
     * **TIENES menú digital PDF disponible**. Proporciona el enlace EN SU IDIOMA:
       - **Español**: "Perfecto, [ubicación]. Aquí puedes ver nuestro menú completo:\\n📄 ${pdfMenus.map((m) => convertToInlineUrl(m.pdfLink!, m.id, m.name)).join('\\n📄 ')}\\n\\nToca el enlace para verlo 📱\\n\\n¿Ya sabes qué te gustaría ordenar o necesitas ayuda con alguna recomendación?"
       - **Inglés**: "Perfect, [location]. Here you can see our complete menu:\\n📄 ${pdfMenus.map((m) => convertToInlineUrl(m.pdfLink!, m.id, m.name)).join('\\n📄 ')}\\n\\nTap the link to view it 📱\\n\\nDo you already know what you'd like to order or do you need help with a recommendation?"`
    : `
     * **NO tienes menú digital PDF**. Muestra las categorías disponibles EN SU IDIOMA (SIN NÚMEROS):
       - **Español**: "Perfecto, [ubicación]. Tenemos las siguientes categorías:\\n${categories.map((cat) => `• ${cat}`).join('\\n')}\\n\\n¿Ya sabes qué te gustaría ordenar o te gustaría que te ayude con alguna categoría?"
       - **Inglés**: "Perfect, [location]. We have the following categories:\\n${categories.map((cat) => `• ${cat}`).join('\\n')}\\n\\nDo you already know what you'd like to order or would you like help with a specific category?"`;

  // Construir información del restaurante
  const restaurantInfo = branchContext
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
${menu.pdfLink ? convertToInlineUrl(menu.pdfLink, menu.id, menu.name) : '—'}
${menu.name}:
${Array.from(uniqueItems.values())
  .map((item) => {
    const recommended = item.shouldRecommend ? '⭐ RECOMENDADO' : '';
    const imageInfo = item.product.imageUrl ? ` 📸` : '';
    return `• [ID:${item.id}] ${item.product.name} (${item.category.name}): $${item.price}${recommended ? ` ${recommended}` : ''}${imageInfo}`;
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

  // Seleccionar prompts según la intención
  let specificPrompts = '';

  switch (intention) {
    case CustomerIntention.LANGUAGE_SELECTION:
      specificPrompts = LANGUAGE_DETECTION_PROMPT;
      break;

    case CustomerIntention.LOCATION_NEEDED:
      specificPrompts = `${LOCATION_PROMPT}\n\n- **Una vez recibida la ubicación**, INMEDIATAMENTE muestra el menú:${menuAfterLocationSection}`;
      break;

    case CustomerIntention.VIEW_MENU:
      // Mostrar menú: si hay PDF mostrar enlace, si no mostrar categorías específicas
      if (hasPdfMenu) {
        specificPrompts = `${MENU_DISPLAY_PROMPT}

**ACCIÓN**: Proporciona INMEDIATAMENTE el enlace del menú PDF EN SU IDIOMA:
- **Español**: "¡Perfecto! Puedes ver nuestro menú completo aquí 👇\\n📄 ${pdfMenus.map((m) => convertToInlineUrl(m.pdfLink!, m.id, m.name)).join('\\n📄 ')}\\n\\nToca el enlace para verlo 📱\\n\\n¿Ya sabes qué te gustaría ordenar o necesitas ayuda?"
- **Inglés**: "Perfect! You can see our complete menu here 👇\\n📄 ${pdfMenus.map((m) => convertToInlineUrl(m.pdfLink!, m.id, m.name)).join('\\n📄 ')}\\n\\nTap the link to view it 📱\\n\\nDo you know what you'd like to order or need help?"`;
      } else {
        specificPrompts = `${MENU_DISPLAY_PROMPT}

**ACCIÓN**: Muestra INMEDIATAMENTE las siguientes categorías EN SU IDIOMA:
- **Español**: "¡Perfecto! Tenemos las siguientes categorías disponibles:\\n${categories.map((cat) => `• ${cat}`).join('\\n')}\\n\\n¿Qué categoría te gustaría conocer?"
- **Inglés**: "Perfect! We have the following categories available:\\n${categories.map((cat) => `• ${cat}`).join('\\n')}\\n\\nWhich category would you like to know about?"`;
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
        specificPrompts += `\n\n**ENCUESTA DISPONIBLE**: ${branchContext.surveyUrl}`;
      }
      break;

    case CustomerIntention.PAYMENT_METHOD:
      specificPrompts = PAYMENT_METHOD_PROMPT;
      if (branchContext?.surveyUrl) {
        specificPrompts += `\n\n**DESPUÉS del mensaje de confirmación**, agrega la encuesta:\n🔗 ${branchContext.surveyUrl}`;
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

  // Construir el prompt final
  return `${BASE_RULES}

${specificPrompts}

${restaurantInfo}

${customerInfo}
`;
};
