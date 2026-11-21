import * as readline from 'readline';
import { MITOS_MCP_TOOLS, handleMcpToolCall } from './core/mcp';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(id: any, result?: any, error?: any) {
  const payload: Record<string, any> = {
    jsonrpc: '2.0',
    id,
  };
  if (error) {
    payload.error = error;
  } else {
    payload.result = result;
  }
  process.stdout.write(JSON.stringify(payload) + '\n');
}

rl.on('line', async (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  // Handle optional Content-Length prefix if present
  let jsonStr = trimmed;
  if (jsonStr.startsWith('{')) {
    // Normal JSON-RPC line
  } else {
    const idx = jsonStr.indexOf('{');
    if (idx !== -1) {
      jsonStr = jsonStr.slice(idx);
    } else {
      return;
    }
  }

  let message: any;
  try {
    message = JSON.parse(jsonStr);
  } catch {
    sendResponse(null, undefined, { code: -32700, message: 'Parse error' });
    return;
  }

  // Handle Notifications (no ID)
  if (message.id === undefined || message.id === null) {
    return;
  }

  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'mitos',
          version: '0.1.0',
        },
      });
      break;

    case 'tools/list':
      sendResponse(id, {
        tools: MITOS_MCP_TOOLS,
      });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const result = await handleMcpToolCall(toolName, toolArgs);
      sendResponse(id, result);
      break;
    }

    case 'ping':
      sendResponse(id, {});
      break;

    default:
      sendResponse(id, undefined, {
        code: -32601,
        message: `Method not found: ${method}`,
      });
  }
});
