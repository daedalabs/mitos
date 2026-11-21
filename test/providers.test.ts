import { describe, it, expect, vi } from 'vitest';
import { callAiProvider } from '../src/core/providers';
import { HttpClient, HttpRequestOptions, HttpResponse, MitosSettings } from '../src/core/types';

describe('providers client', () => {
  const baseSettings: MitosSettings = {
    aiProvider: 'gemini',
    geminiApiKey: 'test-gemini-key',
    openaiApiKey: 'test-openai-key',
    ollamaEndpoint: 'http://localhost:11434',
    ollamaModel: 'llama3',
    contentFolder: 'content',
    antiSlopStrictness: 'standard',
  };

  it('calls Gemini with x-goog-api-key header and NOT in query string (B8)', async () => {
    let capturedOptions: HttpRequestOptions | null = null;
    const fakeClient: HttpClient = async (options) => {
      capturedOptions = options;
      return {
        status: 200,
        json: {
          candidates: [
            {
              content: {
                parts: [{ text: '{"angles": []}' }],
              },
            },
          ],
        },
      };
    };

    const res = await callAiProvider(baseSettings, 'test prompt', fakeClient);
    expect(res).toBe('{"angles": []}');
    expect(capturedOptions).not.toBeNull();
    // B8 check: key must NOT be in URL
    expect(capturedOptions!.url).not.toContain('key=');
    // Header must have x-goog-api-key
    expect(capturedOptions!.headers?.['x-goog-api-key']).toBe('test-gemini-key');
  });

  it('calls OpenAI with Authorization Bearer header', async () => {
    let capturedOptions: HttpRequestOptions | null = null;
    const fakeClient: HttpClient = async (options) => {
      capturedOptions = options;
      return {
        status: 200,
        json: {
          choices: [
            {
              message: { content: '{"angles": []}' },
            },
          ],
        },
      };
    };

    const settings: MitosSettings = { ...baseSettings, aiProvider: 'openai' };
    const res = await callAiProvider(settings, 'test prompt', fakeClient);
    expect(res).toBe('{"angles": []}');
    expect(capturedOptions!.headers?.Authorization).toBe('Bearer test-openai-key');
  });

  it('maps 401/403 HTTP status to MitosError with kind auth', async () => {
    const fakeClient: HttpClient = async () => ({
      status: 401,
      text: JSON.stringify({ error: { message: 'API key expired' } }),
    });

    await expect(callAiProvider(baseSettings, 'test', fakeClient)).rejects.toMatchObject({
      kind: 'auth',
      status: 401,
    });
  });

  it('maps 429 HTTP status to MitosError with kind rate_limit and retries', async () => {
    let attempts = 0;
    const fakeClient: HttpClient = async () => {
      attempts++;
      return {
        status: 429,
        text: JSON.stringify({ error: 'Too Many Requests' }),
      };
    };

    await expect(callAiProvider(baseSettings, 'test', fakeClient)).rejects.toMatchObject({
      kind: 'rate_limit',
      status: 429,
    });
    // Verifies 1 retry took place
    expect(attempts).toBe(2);
  });

  it('maps a malformed 200 response body to a parse error', async () => {
    const fakeClient: HttpClient = async () => ({
      status: 200,
      text: '<html>not json</html>',
    });

    await expect(callAiProvider(baseSettings, 'test', fakeClient)).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('maps MCP JSON-RPC errors to actionable MitosError kinds', async () => {
    const fakeClient: HttpClient = async () => ({
      status: 200,
      json: {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Tool not found: missing' },
      },
    });

    const mcpSettings: MitosSettings = {
      ...baseSettings,
      aiProvider: 'mcp',
      mcpEndpoint: 'http://localhost:3000/mcp',
      mcpToolName: 'missing',
    };

    await expect(callAiProvider(mcpSettings, 'test prompt', fakeClient)).rejects.toMatchObject({
      kind: 'invalid_model',
    });
  });

  it('calls MCP server via JSON-RPC 2.0 tools/call with zero API tokens required', async () => {
    let capturedOptions: HttpRequestOptions | null = null;
    const fakeClient: HttpClient = async (options) => {
      capturedOptions = options;
      return {
        status: 200,
        json: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [
              {
                type: 'text',
                text: '{"angles": [{"title": "MCP Generated Angle"}]}',
              },
            ],
          },
        },
      };
    };

    const mcpSettings: MitosSettings = {
      ...baseSettings,
      aiProvider: 'mcp',
      mcpEndpoint: 'http://localhost:3000/mcp',
      mcpToolName: 'generate_angles',
    };

    const res = await callAiProvider(mcpSettings, 'test prompt', fakeClient);
    expect(res).toBe('{"angles": [{"title": "MCP Generated Angle"}]}');
    expect(capturedOptions!.url).toBe('http://localhost:3000/mcp');

    const sentBody = JSON.parse(capturedOptions!.body!);
    expect(sentBody.method).toBe('tools/call');
    expect(sentBody.params.name).toBe('generate_angles');
    expect(sentBody.params.arguments.prompt).toBe('test prompt');
  });
});
