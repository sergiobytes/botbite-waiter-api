import { IsOptional } from 'class-validator';

export class BulkUploadDto {
  @IsOptional()
  file?: Express.Multer.File;
}
