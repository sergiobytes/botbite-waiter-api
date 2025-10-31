export interface OpenAIConfig {
  apiKey: string;
}

export const openAIConfig: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY!,
};
