/**
 * ScriptEditor — Monaco-based code editor for generated test scripts.
 * Supports TypeScript/JavaScript with dark theme, line numbers, minimap.
 * Provides onChange callback for auto-save integration.
 */
import { useRef, useCallback } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Loader2 } from 'lucide-react';

interface ScriptEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  height?: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function ScriptEditor({
  value,
  language = 'typescript',
  readOnly = false,
  height = '100%',
  onChange,
  onSave,
}: ScriptEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Register Ctrl+S / Cmd+S for save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Focus the editor
    editor.focus();
  }, [onSave]);

  const handleChange: OnChange = useCallback((val) => {
    if (val !== undefined) {
      onChange?.(val);
    }
  }, [onChange]);

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      loading={
        <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement de l'éditeur...</span>
        </div>
      }
      options={{
        readOnly,
        minimap: { enabled: true },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        suggest: { showKeywords: true, showSnippets: true },
        padding: { top: 12 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        formatOnPaste: true,
        formatOnType: true,
      }}
    />
  );
}
