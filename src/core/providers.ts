import { HttpClient, HttpResponse, MitosError, MitosSettings } from './types';

export const DEFAULT_TIMEOUT_MS = 45000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse a provider response body, mapping malformed payloads to MitosError. */
function parseResponseJson(res: HttpResponse): any {
  if (res.json !== undefined && res.json !== null) {
    return res.json;
  }

  if (!res.text) {
    throw new MitosError('Provider returned an empty response body', 'parse');
  }

  try {
    return JSON.parse(res.text);
  } catch (err: any) {
    throw new MitosError(`Provider returned malformed JSON: ${err.message}`, 'parse');
  }
}

async function requestWithTimeout(
  httpClient: HttpClient,
  options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }
): Promise<HttpResponse> {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new MitosError(`Request timed out after ${timeoutMs}ms`, 'network', true));
    }, timeoutMs);
    // In Node or browser environments: unref if available
    if (typeof (timer as any)?.unref === 'function') {
      (timer as any).unref();
    }
  });

  try {
    return await Promise.race([httpClient(options), timeoutPromise]);
  } finally {
    // The losing promise may still be pending; always release the timer.
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function callAiProvider(
  settings: MitosSettings,
  prompt: string,
  httpClient: HttpClient
): Promise<string> {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      if (settings.aiProvider === 'gemini') {
        if (!settings.geminiApiKey) {
          throw new MitosError('Gemini API key is not configured in Mitos settings.', 'auth');
        }

        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        const res = await requestWithTimeout(httpClient, {
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': settings.geminiApiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        });

        if (res.status >= 400) {
          handleHttpError(res.status, res.text || JSON.stringify(res.json));
        }

        const json = parseResponseJson(res);
        const candidates = json?.candidates;
        if (!candidates || candidates.length === 0) {
          throw new MitosError('No generation candidates returned from Gemini', 'parse');
        }

        const text = candidates[0].content?.parts?.[0]?.text;
        if (!text) {
          throw new MitosError('Empty response text in Gemini candidate', 'parse');
        }
        return text;
      } else if (settings.aiProvider === 'openai') {
        if (!settings.openaiApiKey) {
          throw new MitosError('OpenAI API key is not configured in Mitos settings.', 'auth');
        }

        const res = await requestWithTimeout(httpClient, {
          url: 'https://api.openai.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.7,
          }),
        });

        if (res.status >= 400) {
          handleHttpError(res.status, res.text || JSON.stringify(res.json));
        }

        const json = parseResponseJson(res);
        const text = json?.choices?.[0]?.message?.content;
        if (!text) {
          throw new MitosError('Empty response message from OpenAI', 'parse');
        }
        return text;
      } else if (settings.aiProvider === 'ollama') {
        const endpoint = settings.ollamaEndpoint.replace(/\/+$/, '');
        const res = await requestWithTimeout(httpClient, {
          url: `${endpoint}/api/generate`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.ollamaModel,
            prompt,
            format: 'json',
            stream: false,
          }),
        });

        if (res.status >= 400) {
          handleHttpError(res.status, res.text || JSON.stringify(res.json));
        }

        const json = parseResponseJson(res);
        const text = json?.response;
        if (!text) {
          throw new MitosError('Empty response from Ollama', 'parse');
        }
        return text;
      } else if (settings.aiProvider === 'mcp') {
        const endpoint = settings.mcpEndpoint;
        if (!endpoint) {
          throw new MitosError('MCP server endpoint is not configured in Mitos settings.', 'invalid_model');
        }

        const toolName = settings.mcpToolName || 'generate';
        const res = await requestWithTimeout(httpClient, {
          url: endpoint,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: {
                prompt,
              },
            },
          }),
        });

        if (res.status >= 400) {
          handleHttpError(res.status, res.text || JSON.stringify(res.json));
        }

        const json = parseResponseJson(res);
        let text = '';

        if (json?.error) {
          const errorCode = Number(json.error.code);
          const errorMessage = json.error.message || JSON.stringify(json.error);
          // JSON-RPC -32601 = method not found (usually a bad tool name).
          const kind = errorCode === -32601 ? 'invalid_model' : 'parse';
          throw new MitosError(`MCP server error: ${errorMessage}`, kind);
        }

        if (json?.result?.content && Array.isArray(json.result.content)) {
          const textItem = json.result.content.find(
            (c: any) => c.type === 'text' || typeof c.text === 'string'
          );
          text = textItem?.text || (typeof json.result.content[0] === 'string' ? json.result.content[0] : '');
        } else if (json?.result?.text) {
          text = json.result.text;
        } else if (json?.result?.response) {
          text = json.result.response;
        } else if (typeof json?.result === 'string') {
          text = json.result;
        } else if (json?.response) {
          text = json.response;
        } else if (json?.content && Array.isArray(json.content)) {
          text = json.content[0]?.text || '';
        }

        if (!text) {
          throw new MitosError('Empty response received from MCP server', 'parse');
        }

        return text;
      } else {
        throw new MitosError(`Unsupported AI provider: ${settings.aiProvider}`, 'invalid_model');
      }
    } catch (err: any) {
      if (err instanceof MitosError && err.retriable && attempts < maxAttempts) {
        await sleep(500);
        continue;
      }
      throw err;
    }
  }

  throw new MitosError('Maximum request retries exceeded', 'network', false);
}

function handleHttpError(status: number, bodyText?: string): never {
  let message = `API request failed with status ${status}`;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const errMsg = parsed.error?.message || parsed.message || parsed.error;
      if (errMsg) message = `API Error (${status}): ${errMsg}`;
    } catch {
      message = `API Error (${status}): ${bodyText.slice(0, 200)}`;
    }
  }

  if (status === 401 || status === 403) {
    throw new MitosError(message, 'auth', false, status);
  } else if (status === 429) {
    throw new MitosError(message, 'rate_limit', true, status);
  } else if (status >= 500) {
    throw new MitosError(message, 'network', true, status);
  } else {
    throw new MitosError(message, 'network', false, status);
  }
}
