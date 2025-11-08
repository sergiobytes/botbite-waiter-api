import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity()
export class Customer extends BaseEntity {
  @Column()
  name: string;

  @Column()
  phone: string;
}
