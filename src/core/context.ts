export const MAX_CONTEXT_CHARS = 4000;

export interface ExtractedContext {
  topic: string;
  contextSnippet?: string;
  source: 'selection' | 'title' | 'none';
  wasTruncated: boolean;
}

export function extractContextFromEditor(
  selectedText?: string | null,
  activeFileBasename?: string | null
): ExtractedContext {
  const sel = (selectedText || '').trim();

  if (sel.length > 0) {
    let wasTruncated = false;
    let snippet = sel;

    if (snippet.length > MAX_CONTEXT_CHARS) {
      snippet = snippet.slice(0, MAX_CONTEXT_CHARS) + '\n... [truncated]';
      wasTruncated = true;
    }

    // If selection is short (<= 120 chars), use it directly as the topic
    if (sel.length <= 120 && !sel.includes('\n')) {
      return {
        topic: sel,
        contextSnippet: undefined,
        source: 'selection',
        wasTruncated: false,
      };
    }

    // If selection is longer, derive initial topic from first line or title
    const firstLine = sel.split('\n')[0].replace(/^#+\s*/, '').trim().slice(0, 100);
    return {
      topic: firstLine || activeFileBasename || '',
      contextSnippet: snippet,
      source: 'selection',
      wasTruncated,
    };
  }

  const title = (activeFileBasename || '').trim();
  if (title.length > 0) {
    return {
      topic: title,
      contextSnippet: undefined,
      source: 'title',
      wasTruncated: false,
    };
  }

  return {
    topic: '',
    contextSnippet: undefined,
    source: 'none',
    wasTruncated: false,
  };
}
