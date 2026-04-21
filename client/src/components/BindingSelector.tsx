/**
 * BindingSelector — Combobox searchable alimenté par les datasets du projet.
 * Affiche les bindings disponibles groupés par dataset type (form_data, auth_data, etc.)
 * avec recherche fuzzy et hiérarchie visuelle.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { Database, ChevronDown, Search, X, AlertCircle } from 'lucide-react';

export interface BindingGroup {
  datasetType: string;
  datasetId: string;
  datasetName: string;
  env: string;
  bindings: string[];
}

interface BindingSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  bindingGroups: BindingGroup[];
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Actions qui requièrent un binding (FILL, SELECT, UPLOAD) */
  required?: boolean;
  /** Taille compacte pour le formulaire */
  compact?: boolean;
}

/** Couleurs par type de dataset */
const TYPE_COLORS: Record<string, string> = {
  form_data: 'text-amber-400',
  auth_data: 'text-blue-400',
  search_data: 'text-green-400',
  web_urls: 'text-purple-400',
  users: 'text-cyan-400',
  api_endpoints: 'text-rose-400',
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || 'text-muted-foreground';
}

/** Extraire le type et la clé d'un binding "type.key" */
function parseBinding(binding: string): { type: string; key: string } {
  const dotIdx = binding.indexOf('.');
  if (dotIdx === -1) return { type: '', key: binding };
  return { type: binding.substring(0, dotIdx), key: binding.substring(dotIdx + 1) };
}

export default function BindingSelector({
  value,
  onChange,
  bindingGroups,
  isLoading = false,
  disabled = false,
  placeholder = 'Sélectionner un binding...',
  required = false,
  compact = false,
}: BindingSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // All bindings flat list for search
  const allBindings = useMemo(() => {
    return bindingGroups.flatMap(g => g.bindings);
  }, [bindingGroups]);

  // Filtered bindings based on search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return bindingGroups;
    const q = search.toLowerCase();
    return bindingGroups
      .map(g => ({
        ...g,
        bindings: g.bindings.filter(b => b.toLowerCase().includes(q)),
      }))
      .filter(g => g.bindings.length > 0);
  }, [bindingGroups, search]);

  const totalBindings = allBindings.length;

  function handleSelect(binding: string) {
    onChange(binding);
    setIsOpen(false);
    setSearch('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  }

  function handleToggle() {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const hasError = required && !value;
  const parsed = value ? parseBinding(value) : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full flex items-center gap-1.5 text-left rounded border
          ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}
          ${hasError ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-background'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40 cursor-pointer'}
          transition-colors
        `}
      >
        {value ? (
          <>
            <Database className={`w-3 h-3 shrink-0 ${parsed ? getTypeColor(parsed.type) : 'text-muted-foreground'}`} />
            <span className="truncate font-mono text-foreground">
              <span className={getTypeColor(parsed?.type || '')}>{parsed?.type}</span>
              <span className="text-muted-foreground">.</span>
              <span>{parsed?.key}</span>
            </span>
            {!disabled && (
              <X
                className="w-3 h-3 shrink-0 text-muted-foreground hover:text-foreground ml-auto"
                onClick={handleClear}
              />
            )}
          </>
        ) : (
          <>
            {hasError && <AlertCircle className="w-3 h-3 shrink-0 text-amber-500" />}
            <span className="truncate text-muted-foreground">{placeholder}</span>
            <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground ml-auto" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 max-h-80 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un binding..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Stats bar */}
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border bg-muted/30">
            {totalBindings} binding{totalBindings > 1 ? 's' : ''} disponible{totalBindings > 1 ? 's' : ''}
            {search && ` · ${filteredGroups.reduce((acc, g) => acc + g.bindings.length, 0)} résultat(s)`}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-56">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Chargement des datasets...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {search ? 'Aucun binding trouvé' : 'Aucun dataset dans ce projet'}
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.datasetType}>
                  {/* Group header */}
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider bg-muted/20 border-b border-border/50 flex items-center gap-1.5">
                    <Database className={`w-3 h-3 ${getTypeColor(group.datasetType)}`} />
                    <span className={getTypeColor(group.datasetType)}>{group.datasetType}</span>
                    <span className="text-muted-foreground font-normal ml-auto">{group.env}</span>
                  </div>
                  {/* Binding items */}
                  {group.bindings.map((binding) => {
                    const { key } = parseBinding(binding);
                    const isSelected = value === binding;
                    return (
                      <button
                        key={binding}
                        type="button"
                        onClick={() => handleSelect(binding)}
                        className={`
                          w-full text-left px-3 py-1.5 text-sm font-mono flex items-center gap-2
                          ${isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted/40'
                          }
                          transition-colors
                        `}
                      >
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="truncate">{key}</span>
                        {isSelected && <span className="ml-auto text-xs text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Manual input option */}
          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => {
                const custom = prompt('Saisir un binding personnalisé (ex: form_data.custom_field)');
                if (custom?.trim()) {
                  handleSelect(custom.trim());
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Saisie manuelle...
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
