import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from '../../common/base.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';

@Entity({ name: 'cashier_notifications' })
export class CashierNotification extends BaseEntity {
    @Column({ type: 'varchar' })
    message: string;

    @Column({ nullable: true })
    phoneNumber?: string;

    @Column({ nullable: true })
    branchId?: string;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branchId' })
    branch?: Branch;

    @ManyToOne(() => Customer, { nullable: true })
    @JoinColumn({ name: 'phoneNumber', referencedColumnName: 'phone' })
    customer?: Customer;
}