import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createQr } from '../../common/utils/create-qr';
import { uploadQRToCloudinary } from '../../common/utils/upload-to-cloudinary';
import { Branch } from '../entities/branch.entity';
import { QrGenerationResponse, } from '../interfaces/branches.interfaces';
import { generateQrToken } from '../utils/generate-qr-token.util';
import { FindOneBranchUseCase } from './find-one-branch.usecase';

@Injectable()
export class GenerateQrForBranchUseCase {
  private readonly logger = new Logger(GenerateQrForBranchUseCase.name);

  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly findOneBranchUseCase: FindOneBranchUseCase,
  ) { }

  async execute(branchId: string, restaurantId: string, lang: string,): Promise<QrGenerationResponse> {

    const { branch } = await this.findOneBranchUseCase.execute(branchId, lang, restaurantId);

    const qrToken = generateQrToken();

    const prefilledMessage = `🛡️ INICIO ${qrToken}`;

    const targetUrl = `https://wa.me/${branch.phoneNumberAssistant}?text=${encodeURIComponent(prefilledMessage)}`;

    const folder =
      process.env.NODE_ENV === 'development'
        ? 'dev/botbite/branches'
        : 'botbite/branches';

    const finalImage = await createQr(targetUrl);
    const uploadedImageUrl = await uploadQRToCloudinary(
      finalImage,
      folder,
      `qr-${branch.id}`,
    );

    branch.qrUrl = uploadedImageUrl;
    branch.qrToken = qrToken;
    await this.branchRepository.save(branch);

    this.logger.debug(`QR code generated for branch ${branch.id} with token ${qrToken}`);

    return {
      qrUrl: uploadedImageUrl,
    };
  }
}


