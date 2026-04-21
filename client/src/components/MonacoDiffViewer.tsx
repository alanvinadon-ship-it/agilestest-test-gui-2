/**
 * MonacoDiffViewer — Side-by-side diff viewer using Monaco DiffEditor.
 * Compares two versions of a script file with full syntax highlighting.
 * Supports inline and side-by-side modes.
 */
import { useCallback, useRef, useState } from 'react';
import { DiffEditor, type DiffOnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Loader2, Columns2, Rows2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonacoDiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  originalLabel?: string;
  modifiedLabel?: string;
  height?: string;
}

export default function MonacoDiffViewer({
  original,
  modified,
  language = 'typescript',
  originalLabel = 'Ancien',
  modifiedLabel = 'Nouveau',
  height = '100%',
}: MonacoDiffViewerProps) {
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  const handleMount: DiffOnMount = useCallback((editor) => {
    diffEditorRef.current = editor;
  }, []);

  // Compute diff stats
  const stats = computeDiffStats(original, modified);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center gap-4">
          {/* Labels */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
              {originalLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">vs</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
              {modifiedLabel}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="text-green-400">+{stats.added}</span>
            <span className="text-red-400">-{stats.removed}</span>
            <span className="text-muted-foreground">lignes</span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRenderSideBySide(true)}
            className={`h-6 w-6 p-0 ${renderSideBySide ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title="Côte à côte"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRenderSideBySide(false)}
            className={`h-6 w-6 p-0 ${!renderSideBySide ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title="En ligne"
          >
            <Rows2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Diff Editor */}
      <div className="flex-1">
        <DiffEditor
          height={height}
          language={language}
          original={original}
          modified={modified}
          theme="vs-dark"
          onMount={handleMount}
          loading={
            <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Chargement du diff...</span>
            </div>
          }
          options={{
            readOnly: true,
            renderSideBySide,
            originalEditable: false,
            automaticLayout: true,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'none',
            padding: { top: 8 },
            smoothScrolling: true,
            diffWordWrap: 'on',
            ignoreTrimWhitespace: false,
          }}
        />
      </div>
    </div>
  );
}

/** Simple line-based diff stats computation */
function computeDiffStats(original: string, modified: string): { added: number; removed: number } {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  // Simple heuristic: count lines that differ
  const maxLen = Math.max(origLines.length, modLines.length);
  let added = 0;
  let removed = 0;

  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];
    if (origLine === undefined && modLine !== undefined) added++;
    else if (modLine === undefined && origLine !== undefined) removed++;
    else if (origLine !== modLine) { added++; removed++; }
  }

  return { added, removed };
}
