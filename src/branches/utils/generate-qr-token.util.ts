import { randomBytes } from 'crypto';

export const generateQrToken = (): string => {
  const timestamp = Date.now();
  const random = randomBytes(3).toString('hex');
  return `QR-${timestamp}-${random}`;
};
