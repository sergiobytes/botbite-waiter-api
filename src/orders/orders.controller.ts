import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { CreateOrderDto } from './dto/create-order.dto';
import { Lang } from '../common/decorators/lang.decorator';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  create(@Body() dto: CreateOrderDto, @Lang() lang: string) {
    return this.ordersService.createOrder(dto, lang);
  }

  @Get()
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  findAll(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Lang() lang: string,
  ) {
    return this.ordersService.findAllOrders(branchId, lang);
  }

  @Get('by-date')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.USER, UserRoles.CLIENT])
  findByDate(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Lang() lang: string,
    @Query('date') date?: string,
    @Query('timezone') timezone?: string,
  ) {
    // Si no se proporciona fecha, usar la fecha actual
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.ordersService.findOrdersByDate(
      branchId,
      targetDate,
      lang,
      timezone,
    );
  }

  @Get(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  findOne(@Param('id', ParseUUIDPipe) id: string, @Lang() lang: string) {
    return this.ordersService.findOneOrder(id, lang);
  }

  @Patch(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
    @Lang() lang: string,
  ) {
    return this.ordersService.updateOrder(id, dto, lang);
  }

  @Delete(':id')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  closeOrder(@Param('id', ParseUUIDPipe) id: string, @Lang() lang: string) {
    return this.ordersService.closeOrder(id, lang);
  }

  // OrderItems
  @Post(':orderId/items')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  addOrderItem(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrderItemDto,
    @Lang() lang: string,
  ) {
    return this.ordersService.addOrderItem(orderId, dto, lang);
  }

  @Delete(':orderId/items/:itemId')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN])
  removeOrderItem(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Lang() lang: string,
  ) {
    return this.ordersService.removeOrderItem(orderId, itemId, lang);
  }
}
