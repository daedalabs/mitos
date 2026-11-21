import { App, PluginSettingTab, Setting } from 'obsidian';
import type MitosPlugin from './main';
import { MitosSettings } from './core/types';

export type { MitosSettings };

export const DEFAULT_SETTINGS: MitosSettings = {
  aiProvider: 'gemini',
  geminiApiKey: '',
  openaiApiKey: '',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3',
  mcpEndpoint: 'http://localhost:3000/mcp',
  mcpToolName: 'generate',
  contentFolder: 'content',
  antiSlopStrictness: 'standard',
};

export class MitosSettingTab extends PluginSettingTab {
  plugin: MitosPlugin;

  constructor(app: App, plugin: MitosPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Mitos Content Engine Settings' });

    new Setting(containerEl)
      .setName('AI / MCP Provider')
      .setDesc('Select the generation backend (API tokens or Model Context Protocol server)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('gemini', 'Google Gemini (API Key)')
          .addOption('openai', 'OpenAI / OpenRouter (API Key)')
          .addOption('ollama', 'Local Ollama (No Token)')
          .addOption('mcp', 'Model Context Protocol (MCP Server - No Token)')
          .setValue(this.plugin.settings.aiProvider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider = value as MitosSettings['aiProvider'];
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.aiProvider === 'gemini') {
      new Setting(containerEl)
        .setName('Gemini API Key')
        .setDesc('Enter your Google Gemini API key')
        .addText((text) =>
          text
            .setPlaceholder('AIzaSy...')
            .setValue(this.plugin.settings.geminiApiKey)
            .onChange(async (value) => {
              this.plugin.settings.geminiApiKey = value;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.aiProvider === 'openai') {
      new Setting(containerEl)
        .setName('OpenAI API Key')
        .setDesc('Enter your OpenAI / OpenRouter key')
        .addText((text) =>
          text
            .setPlaceholder('sk-...')
            .setValue(this.plugin.settings.openaiApiKey)
            .onChange(async (value) => {
              this.plugin.settings.openaiApiKey = value;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.aiProvider === 'ollama') {
      new Setting(containerEl)
        .setName('Ollama Endpoint')
        .setDesc('Local Ollama URL (default: http://localhost:11434)')
        .addText((text) =>
          text
            .setValue(this.plugin.settings.ollamaEndpoint)
            .onChange(async (value) => {
              this.plugin.settings.ollamaEndpoint = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName('Ollama Model')
        .setDesc('Local model name (e.g. llama3, mistral, qwen2.5:7b)')
        .addText((text) =>
          text
            .setValue(this.plugin.settings.ollamaModel)
            .onChange(async (value) => {
              this.plugin.settings.ollamaModel = value;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.aiProvider === 'mcp') {
      new Setting(containerEl)
        .setName('MCP Server Endpoint')
        .setDesc('URL of your Model Context Protocol server (HTTP / SSE / JSON-RPC 2.0)')
        .addText((text) =>
          text
            .setPlaceholder('http://localhost:3000/mcp')
            .setValue(this.plugin.settings.mcpEndpoint)
            .onChange(async (value) => {
              this.plugin.settings.mcpEndpoint = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName('MCP Tool Name')
        .setDesc('Tool name exposed by your MCP server for brainstorming/generation')
        .addText((text) =>
          text
            .setPlaceholder('generate')
            .setValue(this.plugin.settings.mcpToolName)
            .onChange(async (value) => {
              this.plugin.settings.mcpToolName = value;
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName('Content Vault Folder')
      .setDesc('Folder where scripts and episode blueprints are stored (scanned for duplicates)')
      .addText((text) =>
        text
          .setPlaceholder('content')
          .setValue(this.plugin.settings.contentFolder)
          .onChange(async (value) => {
            this.plugin.settings.contentFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Anti-Slop Strictness')
      .setDesc('How aggressively the linter rejects corporate LinkedIn jargon and slow hooks')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('lenient', 'Lenient (<= 18 words hook)')
          .addOption('standard', 'Standard (<= 15 words hook)')
          .addOption('ruthless', 'Ruthless (<= 12 words hook, no filler)')
          .setValue(this.plugin.settings.antiSlopStrictness)
          .onChange(async (value) => {
            this.plugin.settings.antiSlopStrictness = value as MitosSettings['antiSlopStrictness'];
            await this.plugin.saveSettings();
          })
      );
  }
}
