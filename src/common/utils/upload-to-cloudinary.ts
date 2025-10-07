import cloudinary from '../../config/cloudinary';
import { Readable } from 'stream';

export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: fileName,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          return reject(new Error(error.message || 'Upload failed'));
        }
        resolve(result!.secure_url);
      },
    );

    Readable.from(buffer).pipe(stream);
  });
};
