import { Column, Entity, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { UserRoles } from '../enums/user-roles';
import { Exclude } from 'class-transformer';

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

  @BeforeInsert()
  @BeforeUpdate()
  emailToLowerCase() {
    this.email = this.email?.toLowerCase();
  }
}
