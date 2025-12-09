import { twilioConfig } from '../../config/twilio.config';
import axios from 'axios';

export const downloadTwilioMediaUtil = async (
  mediaUrl: string,
): Promise<Buffer> => {
  const { accountSid, authToken } = twilioConfig;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials are not set');
  }

  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    auth: {
      username: accountSid,
      password: authToken,
    },
  });

  return Buffer.from(response.data);
};
