import { Column, Entity, BeforeInsert, BeforeUpdate, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { UserRoles } from '../enums/user-roles';
import { Exclude } from 'class-transformer';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  @Exclude()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRoles,
    array: true,
    default: [UserRoles.USER],
  })
  roles: UserRoles[];

  @OneToMany(() => Restaurant, (restaurant) => restaurant.user, {
    cascade: true,
    eager: false,
  })
  restaurants: Restaurant[];

  @BeforeInsert()
  @BeforeUpdate()
  emailToLowerCase() {
    this.email = this.email?.toLowerCase();
  }
}
