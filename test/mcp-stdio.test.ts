import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

describe('mcp-server stdio process', () => {
  it('responds to initialize and tools/list via JSON-RPC stdio', async () => {
    const serverPath = path.resolve(__dirname, '../scripts/mcp-server.mjs');
    const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    const listRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 101,
      method: 'tools/list',
    }) + '\n';

    proc.stdin.write(listRequest);

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 500));
    proc.kill();

    const parsed = JSON.parse(output.trim());
    expect(parsed.id).toBe(101);
    const names = parsed.result.tools.map((t: any) => t.name);
    expect(names).toContain('mitos_brainstorm_angles');
    expect(names).toContain('mitos_lint_script');
  });

  it('responds to tools/call for mitos_lint_script', async () => {
    const serverPath = path.resolve(__dirname, '../scripts/mcp-server.mjs');
    const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    const callRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 202,
      method: 'tools/call',
      params: {
        name: 'mitos_lint_script',
        arguments: {
          script: 'Vector latency benchmark 20ms.',
          strictness: 'standard',
        },
      },
    }) + '\n';

    proc.stdin.write(callRequest);

    await new Promise((resolve) => setTimeout(resolve, 500));
    proc.kill();

    const parsed = JSON.parse(output.trim());
    expect(parsed.id).toBe(202);
    const toolResult = JSON.parse(parsed.result.content[0].text);
    expect(toolResult.passed).toBe(true);
    expect(toolResult.score).toBeGreaterThanOrEqual(70);
  });

  it('responds to tools/call for mitos_save_angle_note and writes note to disk', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mitos-stdio-vault-'));

    try {
      const serverPath = path.resolve(__dirname, '../scripts/mcp-server.mjs');
      const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      const callRequest =
        JSON.stringify({
          jsonrpc: '2.0',
          id: 303,
          method: 'tools/call',
          params: {
            name: 'mitos_save_angle_note',
            arguments: {
              vaultPath: tempDir,
              title: 'Stdio Save Test',
              hook: 'Testing saving note over stdio JSON-RPC.',
              angleType: 'pain_point',
              coreTension: 'Subprocess communication latency.',
              visualProofAnchor: 'terminal: 5ms latency',
              scriptDraft: 'Testing saving note over stdio JSON-RPC. Latency is 5ms.',
              publishDate: '2026-11-25',
            },
          },
        }) + '\n';

      proc.stdin.write(callRequest);

      await new Promise((resolve) => setTimeout(resolve, 600));
      proc.kill();

      const parsed = JSON.parse(output.trim());
      expect(parsed.id).toBe(303);
      expect(parsed.error).toBeUndefined();

      const result = JSON.parse(parsed.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.path).toBe('content/2026-11-25-stdio-save-test.md');
      expect(result.kanbanLane).toBe('Ideas');

      expect(fs.existsSync(path.join(tempDir, result.path))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'content', '_pipeline.md'))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
