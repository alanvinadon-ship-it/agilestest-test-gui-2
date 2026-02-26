/**
 * Pagination — composant réutilisable pour la navigation paginée.
 *
 * Supporte :
 *  - Navigation prev/next + numéros de page
 *  - Sélecteur de taille de page (pageSize)
 *  - Affichage "X–Y sur Z résultats"
 *  - Ellipses pour les grandes plages de pages
 *
 * Usage :
 *   <Pagination
 *     page={page}
 *     pageSize={pageSize}
 *     total={total}
 *     onPageChange={setPage}
 *     onPageSizeChange={setPageSize}
 *   />
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  /** Current page (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  total: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Available page sizes */
  pageSizeOptions?: number[];
  /** Show page size selector */
  showPageSize?: boolean;
  /** Compact mode (no page numbers, just prev/next) */
  compact?: boolean;
}

const PAGE_SIZE_OPTIONS_DEFAULT = [10, 25, 50, 100];

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS_DEFAULT,
  showPageSize = true,
  compact = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Generate page numbers with ellipses
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (page > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Info: "X–Y sur Z résultats" */}
      <div className="text-xs text-muted-foreground font-mono">
        {total === 0 ? (
          'Aucun résultat'
        ) : (
          <>
            <span className="text-foreground font-medium">{startItem}–{endItem}</span>
            {' '}sur{' '}
            <span className="text-foreground font-medium">{total.toLocaleString('fr-FR')}</span>
            {' '}résultat{total > 1 ? 's' : ''}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Page size selector */}
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Par page :</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1); // Reset to first page on size change
              }}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1">
          {/* First page */}
          {!compact && totalPages > 5 && (
            <button
              onClick={() => onPageChange(1)}
              disabled={!canPrev}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Première page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Previous */}
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!canPrev}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Page précédente"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          {!compact && getPageNumbers().map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={`h-8 min-w-8 px-1.5 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  item === page
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'border border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                {item}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!canNext}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Page suivante"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last page */}
          {!compact && totalPages > 5 && (
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={!canNext}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Dernière page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
