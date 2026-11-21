import { Angle, HttpClient, MitosSettings } from './core/types';
import { buildAnglePrompt } from './core/prompts';
import { callAiProvider } from './core/providers';
import { extractJson, validateAngles } from './core/parse';
import { createObsidianHttpClient } from './obsidian-adapter';

export type BrainstormAngle = Angle;

export async function generateAngles(
  topic: string,
  settings: MitosSettings,
  context?: string,
  httpClient?: HttpClient
): Promise<Angle[]> {
  const client = httpClient || createObsidianHttpClient();
  const prompt = buildAnglePrompt(topic, context);
  const rawResponse = await callAiProvider(settings, prompt, client);
  const json = extractJson(rawResponse);
  return validateAngles(json, settings.antiSlopStrictness);
}
