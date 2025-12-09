import OpenAI from 'openai';
import { openAIConfig } from '../../config/openai.config';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

interface TranscribeAudioParams {
  audioBuffer: Buffer;
  mimeType: string;
}

export const transcribeAudioUseCase = async (
  params: TranscribeAudioParams,
): Promise<string> => {
  const { audioBuffer, mimeType } = params;
  const { apiKey } = openAIConfig;

  const openai = new OpenAI({ apiKey });

  // ✅ Solo validar tamaño máximo de Whisper (25MB)
  const MAX_SIZE_BYTES = 25 * 1024 * 1024;
  if (audioBuffer.length > MAX_SIZE_BYTES) {
    throw new Error('AUDIO_TOO_LARGE');
  }

  const extension = getFileExtension(mimeType);
  const fileName = `audio-${Date.now()}.${extension}`;
  const tempFilePath = path.join(os.tmpdir(), fileName);

  try {
    await fs.promises.writeFile(tempFilePath, audioBuffer);
    const file = await OpenAI.toFile(
      fs.createReadStream(tempFilePath),
      fileName,
    );

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'es',
    });
    return transcription.text;
  } finally {
    try {
      await fs.promises.unlink(tempFilePath);
    } catch (error) {
      // Ignorar error al eliminar temporal
    }
  }
};

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  };

  return mimeToExt[mimeType] || 'ogg';
}
