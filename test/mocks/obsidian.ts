export class Notice {
  message: string;
  timeout?: number;
  constructor(message: string, timeout?: number) {
    this.message = message;
    this.timeout = timeout;
  }
}

export class TFile {
  path: string;
  basename: string;
  extension: string;
  stat: { mtime: number; ctime: number; size: number };
  constructor(path: string) {
    this.path = path;
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const dotIdx = filename.lastIndexOf('.');
    this.basename = dotIdx !== -1 ? filename.slice(0, dotIdx) : filename;
    this.extension = dotIdx !== -1 ? filename.slice(dotIdx + 1) : '';
    this.stat = { mtime: Date.now(), ctime: Date.now(), size: 0 };
  }
}

export class TFolder {
  path: string;
  name: string;
  children: any[] = [];
  constructor(path: string) {
    this.path = path;
    const parts = path.split('/');
    this.name = parts[parts.length - 1];
  }
}

export class App {
  vault: any;
  workspace: any;
  metadataCache: any;
  constructor() {
    this.vault = {
      adapter: {
        exists: async () => false,
        read: async () => '',
        write: async () => {},
      },
      getMarkdownFiles: () => [],
      getAbstractFileByPath: () => null,
      create: async () => {},
      createFolder: async () => {},
      read: async () => '',
      modify: async () => {},
      process: async () => '',
    };
    this.workspace = {
      getLeavesOfType: () => [],
      getRightLeaf: () => null,
      revealLeaf: () => {},
      detachLeavesOfType: () => {},
      rightSplit: { collapsed: true, expand: () => {} },
    };
    this.metadataCache = {
      getFileCache: () => null,
    };
  }
}

export class Plugin {
  app: App;
  manifest: any;
  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  addRibbonIcon() { return {} as any; }
  addCommand() {}
  addSettingTab() {}
  registerView() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
}

export class ItemView {
  app: App;
  leaf: any;
  containerEl: HTMLElement;
  constructor(leaf: any) {
    this.leaf = leaf;
    this.app = leaf?.app || new App();
    this.containerEl = {} as any;
  }
  getViewType() { return ''; }
  getDisplayText() { return ''; }
  getIcon() { return ''; }
  async onOpen() {}
  async onClose() {}
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  constructor(app: App) {
    this.app = app;
    this.contentEl = {} as any;
  }
  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class Setting {
  settingEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.settingEl = {} as any;
  }
  setName() { return this; }
  setDesc() { return this; }
  addDropdown(cb: (d: any) => any) { cb({ addOption: () => {}, setValue: () => {}, onChange: () => {} }); return this; }
  addText(cb: (t: any) => any) { cb({ setPlaceholder: () => {}, setValue: () => {}, onChange: () => {} }); return this; }
  addToggle(cb: (t: any) => any) { cb({ setValue: () => {}, onChange: () => {} }); return this; }
  addButton(cb: (b: any) => any) { cb({ setButtonText: () => {}, setCta: () => {}, onClick: () => {} }); return this; }
}

export class PluginSettingTab {
  app: App;
  plugin: any;
  containerEl: HTMLElement;
  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {} as any;
  }
  display() {}
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
}

export async function requestUrl(request: any): Promise<any> {
  throw new Error('requestUrl mock not configured for test');
}
