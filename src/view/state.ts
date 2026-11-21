import { Angle, MitosError, SeriesPlan } from '../core/types';

export type ViewMode = 'brainstorm' | 'series';

export interface ViewState {
  mode: ViewMode;
  status: 'idle' | 'loading' | 'success' | 'error';
  topic: string;
  contextSnippet?: string;
  angles: Angle[];
  seriesPlan?: SeriesPlan;
  error?: MitosError | Error;
  cancelRequested: boolean;
}

export function createInitialState(): ViewState {
  return {
    mode: 'brainstorm',
    status: 'idle',
    topic: '',
    angles: [],
    cancelRequested: false,
  };
}

export function getActionableErrorMessage(err: any): string {
  if (err instanceof MitosError) {
    switch (err.kind) {
      case 'auth':
        return `Authentication Error: ${err.message}. Please check your API key in Settings -> Mitos.`;
      case 'rate_limit':
        return `Rate Limit Exceeded: The AI provider is throttling requests. Please wait a moment and retry.`;
      case 'network':
        return `Network Error: ${err.message}. Please check your connection or local Ollama endpoint.`;
      case 'parse':
        return `Parsing Error: Could not interpret AI response. Try narrowing your topic.`;
      case 'invalid_model':
        return `Configuration Error: ${err.message}`;
      case 'vault':
        return `Vault File Error: ${err.message}`;
      case 'canceled':
        return 'Operation canceled by user.';
    }
  }
  return err?.message || 'An unexpected error occurred.';
}
