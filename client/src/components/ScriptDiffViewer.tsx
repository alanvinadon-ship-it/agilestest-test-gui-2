/**
 * ScriptDiffViewer — Compare two versions of a generated script side-by-side.
 * Uses the `diff` library for line-level diffing with colored additions/deletions.
 */
import { useState, useMemo } from 'react';
import { X, GitCompare, FileCode, ChevronDown } from 'lucide-react';
import { diffLines, type Change } from 'diff';

interface ScriptVersion {
  id: number;
  name: string;
  version: number;
  framework: string;
  code: string;
  createdAt: string | Date;
  status: string;
}

interface Props {
  versions: ScriptVersion[];
  onClose: () => void;
}

/** Parse the JSON code payload to extract files */
function parseFiles(code: string): Array<{ path: string; content: string }> {
  try {
    const parsed = JSON.parse(code);
    if (parsed.files && Array.isArray(parsed.files)) return parsed.files;
    return [{ path: 'script.ts', content: code }];
  } catch {
    return [{ path: 'script.ts', content: code }];
  }
}

/** Render a diff line with appropriate styling */
function DiffLine({ change, lineNum }: { change: Change; lineNum: { old: number; new: number } }) {
  const lines = change.value.split('\n');
  // Remove trailing empty line from split
  if (lines[lines.length - 1] === '') lines.pop();

  return (
    <>
      {lines.map((line, i) => {
        let bg = '';
        let prefix = ' ';
        let textColor = 'text-foreground/80';
        let gutterOld = '';
        let gutterNew = '';

        if (change.added) {
          bg = 'bg-green-500/10';
          prefix = '+';
          textColor = 'text-green-300';
          gutterNew = String(lineNum.new + i);
        } else if (change.removed) {
          bg = 'bg-red-500/10';
          prefix = '-';
          textColor = 'text-red-300';
          gutterOld = String(lineNum.old + i);
        } else {
          gutterOld = String(lineNum.old + i);
          gutterNew = String(lineNum.new + i);
        }

        return (
          <div key={`${change.added ? 'a' : change.removed ? 'r' : 'c'}-${i}`} className={`flex ${bg} hover:brightness-110`}>
            <span className="w-10 text-right pr-2 text-[10px] text-muted-foreground/50 select-none shrink-0 font-mono">
              {gutterOld}
            </span>
            <span className="w-10 text-right pr-2 text-[10px] text-muted-foreground/50 select-none shrink-0 font-mono">
              {gutterNew}
            </span>
            <span className={`w-4 text-center text-[10px] font-bold select-none shrink-0 ${textColor}`}>
              {prefix}
            </span>
            <span className={`flex-1 text-xs font-mono whitespace-pre ${textColor}`}>
              {line}
            </span>
          </div>
        );
      })}
    </>
  );
}

export default function ScriptDiffViewer({ versions, onClose }: Props) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [versions],
  );

  const [leftId, setLeftId] = useState<number>(sorted.length > 1 ? sorted[1].id : sorted[0].id);
  const [rightId, setRightId] = useState<number>(sorted[0].id);
  const [selectedFile, setSelectedFile] = useState(0);

  const leftScript = sorted.find(s => s.id === leftId);
  const rightScript = sorted.find(s => s.id === rightId);

  const leftFiles = useMemo(() => leftScript ? parseFiles(leftScript.code) : [], [leftScript]);
  const rightFiles = useMemo(() => rightScript ? parseFiles(rightScript.code) : [], [rightScript]);

  // Build a union of all file paths
  const allPaths = useMemo(() => {
    const set = new Set<string>();
    leftFiles.forEach(f => set.add(f.path));
    rightFiles.forEach(f => set.add(f.path));
    return Array.from(set);
  }, [leftFiles, rightFiles]);

  const currentPath = allPaths[selectedFile] || allPaths[0] || '';
  const leftContent = leftFiles.find(f => f.path === currentPath)?.content || '';
  const rightContent = rightFiles.find(f => f.path === currentPath)?.content || '';

  // Compute diff
  const changes = useMemo(() => diffLines(leftContent, rightContent), [leftContent, rightContent]);

  // Stats
  const stats = useMemo(() => {
    let added = 0, removed = 0;
    changes.forEach(c => {
      const lineCount = c.value.split('\n').filter(l => l !== '').length;
      if (c.added) added += lineCount;
      if (c.removed) removed += lineCount;
    });
    return { added, removed };
  }, [changes]);

  // Line numbers tracking
  const lineNumbers = useMemo(() => {
    let oldLine = 1, newLine = 1;
    return changes.map(c => {
      const result = { old: oldLine, new: newLine };
      const lineCount = c.value.split('\n').filter(l => l !== '').length;
      if (!c.added) oldLine += lineCount;
      if (!c.removed) newLine += lineCount;
      return result;
    });
  }, [changes]);

  const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Comparaison de versions</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {sorted[0]?.framework}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version selectors */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Ancien</span>
            <select
              value={leftId}
              onChange={e => setLeftId(Number(e.target.value))}
              className="text-xs px-3 py-1.5 bg-red-500/5 border border-red-500/20 rounded-md text-foreground"
            >
              {sorted.map(s => (
                <option key={s.id} value={s.id}>
                  v{s.version} — {formatDate(s.createdAt)} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-green-400 uppercase font-bold tracking-wider">Nouveau</span>
            <select
              value={rightId}
              onChange={e => setRightId(Number(e.target.value))}
              className="text-xs px-3 py-1.5 bg-green-500/5 border border-green-500/20 rounded-md text-foreground"
            >
              {sorted.map(s => (
                <option key={s.id} value={s.id}>
                  v{s.version} — {formatDate(s.createdAt)} ({s.status})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Stats */}
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-green-400">+{stats.added} lignes</span>
            <span className="text-red-400">-{stats.removed} lignes</span>
          </div>
        </div>

        {/* File tabs */}
        <div className="flex border-b border-border overflow-x-auto px-6">
          {allPaths.map((path, idx) => {
            const inLeft = leftFiles.some(f => f.path === path);
            const inRight = rightFiles.some(f => f.path === path);
            let badge = '';
            let badgeColor = '';
            if (!inLeft) { badge = 'NEW'; badgeColor = 'text-green-400 bg-green-500/10'; }
            else if (!inRight) { badge = 'DEL'; badgeColor = 'text-red-400 bg-red-500/10'; }

            return (
              <button
                key={path}
                onClick={() => { setSelectedFile(idx); }}
                className={`px-3 py-2 text-xs font-mono whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                  selectedFile === idx
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileCode className="w-3 h-3" />
                {path}
                {badge && (
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${badgeColor}`}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto">
          {leftId === rightId ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Sélectionnez deux versions différentes pour voir les différences.
            </div>
          ) : changes.length === 1 && !changes[0].added && !changes[0].removed ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Aucune différence pour ce fichier.
            </div>
          ) : (
            <div className="font-mono text-xs">
              {changes.map((change, i) => (
                <DiffLine key={i} change={change} lineNum={lineNumbers[i]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
