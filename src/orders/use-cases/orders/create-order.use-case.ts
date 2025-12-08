import { CreateOrder, OrderResponse } from '../../interfaces/orders.interfaces';

export const createOrderUseCase = async (
  params: CreateOrder,
): Promise<OrderResponse> => {
  const { dto, lang, repository, logger, translationService } = params;

  const order = repository.create({
    ...dto,
    orderItems: dto.orderItems,
  });

  await repository.save(order);

  logger.log(`Order created: ${order.id}`);

  return {
    order,
    message: translationService.translate('orders.order_created', lang),
  };
};
