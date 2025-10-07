import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Transform } from 'class-transformer';

export class FindBranchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name must have at least 1 character' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Search must have at least 2 characters' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isActive must be true or false' })
  isActive?: boolean;
}
