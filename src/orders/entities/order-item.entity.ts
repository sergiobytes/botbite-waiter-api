import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Order } from './order.entity';
import { MenuItem } from '../../menus/entities/menu-item.entity';

@Entity({ name: 'order_items' })
export class OrderItem extends BaseEntity {
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  notes?: string;

  @Column()
  orderId: string;

  @Column()
  menuItemId: string;

  @ManyToOne(() => Order, (order) => order.orderItems)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;
}
