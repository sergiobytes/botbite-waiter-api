import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

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
  
  @Column()
  restaurantId: string;

  @ManyToOne(() => Restaurant, restaurant => restaurant.branches)
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;
}
