export interface ITemplateVariables {
  [key: string]: string | number | boolean | Array<any> | Record<string, any>;
}

export interface IRenderTemplateParams {
  key: string;
  language: string;
  variables?: ITemplateVariables;
  useOpenAI?: boolean;
}

export interface ITemplateContext {
  restaurantId: string;
  branchId: string;
  customerId?: string;
  orderId: string;
  conversationId: string;
}
