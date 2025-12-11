import cloudinary from '../../config/cloudinary';
import { Readable } from 'stream';

export const uploadQRToCloudinary = (
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

export const uploadPdfToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: fileName,
          resource_type: 'raw',
          type: 'upload',
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(new Error(error.message || 'Upload failed'));
          resolve(result!.secure_url);
        },
      )
      .end(buffer);
  });
};

export const uploadPictureToCloudinary = (
  buffer: Buffer,
  folder: string,
  fileName: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
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
      )
      .end(buffer);
  });
};
