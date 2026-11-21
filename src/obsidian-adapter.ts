import { App, normalizePath, requestUrl, TFile } from 'obsidian';
import { HttpClient, HttpRequestOptions, HttpResponse, VaultLike } from './core/types';

export function createObsidianHttpClient(): HttpClient {
  return async (options: HttpRequestOptions): Promise<HttpResponse> => {
    try {
      const response = await requestUrl({
        url: options.url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        throw: false,
      });

      return {
        status: response.status,
        headers: response.headers,
        text: response.text,
        json: response.json,
      };
    } catch (err: any) {
      if (err.status) {
        return {
          status: err.status,
          headers: err.headers,
          text: err.text,
          json: err.json,
        };
      }
      throw err;
    }
  };
}

export function createObsidianVault(app: App): VaultLike {
  return {
    async exists(path: string): Promise<boolean> {
      const normalized = normalizePath(path);
      return await app.vault.adapter.exists(normalized);
    },

    async read(path: string): Promise<string> {
      const normalized = normalizePath(path);
      const file = app.vault.getAbstractFileByPath(normalized);
      if (file instanceof TFile) {
        return await app.vault.read(file);
      }
      return await app.vault.adapter.read(normalized);
    },

    async write(path: string, content: string): Promise<void> {
      const normalized = normalizePath(path);
      const file = app.vault.getAbstractFileByPath(normalized);
      if (file instanceof TFile) {
        await app.vault.modify(file, content);
      } else {
        await app.vault.create(normalized, content);
      }
    },

    async createFolder(folder: string): Promise<void> {
      const normalized = normalizePath(folder);
      if (!(await app.vault.adapter.exists(normalized))) {
        await app.vault.createFolder(normalized);
      }
    },

    async delete(path: string): Promise<void> {
      const normalized = normalizePath(path);
      const file = app.vault.getAbstractFileByPath(normalized);
      if (file instanceof TFile) {
        await app.vault.delete(file);
      } else if (await app.vault.adapter.exists(normalized)) {
        await app.vault.adapter.remove(normalized);
      }
    },

    async getMarkdownFiles(): Promise<Array<{ path: string; basename: string }>> {
      return app.vault.getMarkdownFiles().map((f) => ({
        path: f.path,
        basename: f.basename,
      }));
    },

    async process(path: string, fn: (data: string) => string): Promise<string> {
      const normalized = normalizePath(path);
      const file = app.vault.getAbstractFileByPath(normalized);
      if (file instanceof TFile) {
        return await app.vault.process(file, fn);
      } else {
        let current = '';
        if (await app.vault.adapter.exists(normalized)) {
          current = await app.vault.adapter.read(normalized);
        }
        const updated = fn(current);
        await app.vault.adapter.write(normalized, updated);
        return updated;
      }
    },
  };
}
