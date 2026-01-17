import {
  FindMenuItems,
  MenuItemsListResponse,
} from '../../interfaces/menu-items.interfaces';
import { findOneMenuUseCase } from '../menus/find-one-menu.use-case';

export const findMenuItemsUseCase = async (
  params: FindMenuItems,
): Promise<MenuItemsListResponse> => {
  const {
    menuId,
    lang,
    logger,
    menuRepository,
    itemRepository,
    translationService,
    paginationDto,
    findMenuItemDto,
  } = params;

  const { menu } = await findOneMenuUseCase({
    menuId,
    lang,
    repository: menuRepository,
    translationService,
    logger,
  });

  const { limit = 10, offset = 0 } = paginationDto;
  const { search, isActive } = findMenuItemDto;

  const queryBuilder = itemRepository
    .createQueryBuilder('menuItem')
    .leftJoinAndSelect('menuItem.product', 'product')
    .leftJoinAndSelect('menuItem.category', 'category')
    .where('menuItem.menuId = :menuId', { menuId: menu.id });

  if (isActive !== undefined) {
    queryBuilder.andWhere('menuItem.isActive = :isActive', { isActive });
  }

  if (search) {
    queryBuilder.andWhere(
      '(product.name ILIKE :search OR product.normalizedName ILIKE :search)',
      {
        search: `%${search}%`,
      },
    );
  }

  const [items, total] = await queryBuilder
    .orderBy('product.name', 'ASC')
    .addOrderBy('menuItem.createdAt', 'ASC')
    .skip(offset)
    .take(limit)
    .getManyAndCount();

  return {
    items,
    total,
    pagination: {
      limit,
      offset,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.ceil(offset / limit) + 1,
    },
  };
};
