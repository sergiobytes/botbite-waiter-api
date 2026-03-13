export const TEMPLATE_KEYS = {
  // Saludos
  GREETING_INITIAL: 'greeting.initial',
  GREETING_RETURNING: 'greeting.returning',

  // Productos
  PRODUCT_SINGLE: 'product.single',
  PRODUCT_MULTIPLE: 'product.multiple',
  PRODUCT_NOT_AVAILABLE: 'product.not_available',
  PRODUCT_OUT_OF_STOCK: 'product.out_of_stock',

  // Órdenes - Nuevas plantillas estructuradas
  ORDER_ITEMS_ADDED: 'order.items_added',
  ORDER_CONFIRMATION: 'order.confirmation',
  ORDER_REQUEST_BILL: 'order.request_bill',
  ORDER_SEPARATE_BILLS: 'order.separate_bills_detailed',
  ORDER_MODIFY_ITEM: 'order.modify_item',
  ORDER_EMPTY_CART: 'order.empty_cart',
  ORDER_SUMMARY: 'order.summary',

  // Menú
  MENU_CATEGORIES: 'menu.categories',
  MENU_RECOMMENDATIONS: 'menu.recommendations',

  // Ayuda
  HELP_GENERAL: 'help.general',
  HELP_ORDER_STATUS: 'help.order_status',

  // Pagos
  PAYMENT_METHODS: 'payment.methods',
  PAYMENT_CONFIRMATION: 'payment.confirmation',

  // Errores
  ERROR_GENERAL: 'error.general',
  ERROR_INVALID_INPUT: 'error.invalid_input',
};

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];
