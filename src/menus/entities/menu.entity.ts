import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { MenuItem } from './menu-item.entity';

@Entity({ name: 'menus' })
export class Menu extends BaseEntity {
  @Column()
  name: string;

  @Column()
  branchId: string;

  @Column({ nullable: true })
  pdfLink?: string;

  @ManyToOne(() => Branch, (branch) => branch.menus)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @OneToMany(() => MenuItem, (menuItem) => menuItem.menu)
  menuItems: MenuItem[];
}
