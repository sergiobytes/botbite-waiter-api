export interface TwilioConfig {
  accountSid: string;
  authToken: string;
}

export const twilioConfig: TwilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
};
