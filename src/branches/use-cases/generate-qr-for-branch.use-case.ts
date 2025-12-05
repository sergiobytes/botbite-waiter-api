import { createQr } from '../../common/utils/create-qr';
import { uploadQRToCloudinary } from '../../common/utils/upload-to-cloudinary';
import {
    QrGeneration,
    QrGenerationResponse,
} from '../interfaces/branches.interfaces';
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

  const targetUrl = `https://wa.me/${branch.phoneNumberAssistant}?text=Hola!`;

  const finalImage = await createQr(targetUrl);
  const uploadedImageUrl = await uploadQRToCloudinary(
    finalImage,
    'botbite/branches',
    `qr-${branch.id}`,
  );

  branch.qrUrl = uploadedImageUrl;
  await repository.save(branch);

  return {
    qrUrl: uploadedImageUrl,
  };
};
