import { createQr } from '../../common/utils/create-qr';
import { uploadQRToCloudinary } from '../../common/utils/upload-to-cloudinary';
import {
  QrGeneration,
  QrGenerationResponse,
} from '../interfaces/branches.interfaces';
import { generateQrToken } from '../utils/generate-qr-token.util';
import { findOneBranchUseCase } from './find-one-branch.use-case';

export const generateQrForBranchUseCase = async (
  params: QrGeneration,
): Promise<QrGenerationResponse> => {
  const {
    branchId,
    restaurantId,
    lang,
    logger,
    repository,
    translationService,
  } = params;

  const { branch } = await findOneBranchUseCase({
    lang,
    term: branchId,
    restaurantId,
    repository,
    translationService,
    logger,
  });

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
  await repository.save(branch);

  return {
    qrUrl: uploadedImageUrl,
  };
};
