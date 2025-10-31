import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { Menu } from '../../menus/entities/menu.entity';

@Entity('branches')
export class Branch extends BaseEntity {
  @Column()
  name: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  phoneNumberAssistant: string;

  @Column({ nullable: true })
  phoneNumberReception: string;

  @Column({ nullable: true })
  assistantId: string;

  @Column({ nullable: true })
  qrUrl: string;

  @Column({ type: 'int', default: 0 })
  availableMessages: number;

  @Column()
  restaurantId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.branches)
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @OneToMany(() => Menu, (menu) => menu.branch)
  menus: Menu[];
}
