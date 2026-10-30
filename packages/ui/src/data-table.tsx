import { type ReactNode } from "react";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  width?: string | number;
  cell: (row: T, index: number) => ReactNode;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectRow?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  emptyState?: ReactNode;
  mobileCardRenderer?: (row: T, isSelected: boolean) => ReactNode;
  testId?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  selectable = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  emptyState,
  mobileCardRenderer,
  testId = "data-table",
  className = "",
}: DataTableProps<T>) {
  if (data.length === 0) {
    return emptyState ? (
      <>{emptyState}</>
    ) : (
      <div className="empty-state" data-testid={`${testId}-empty`}>
        <p>No records found.</p>
      </div>
    );
  }

  const allSelected = selectable && data.length > 0 && data.every((row) => selectedIds.includes(keyExtractor(row)));
  const someSelected = selectable && !allSelected && data.some((row) => selectedIds.includes(keyExtractor(row)));

  return (
    <div className={`data-table-container ${className}`.trim()} data-testid={testId}>
      {/* Mobile Card View (renders below 768px/900px breakpoint) */}
      <div className="data-table-mobile only-mobile">
        {data.map((row, index) => {
          const id = keyExtractor(row);
          const isSelected = selectedIds.includes(id);

          if (mobileCardRenderer) {
            return (
              <div key={id} className={`data-table-card ${isSelected ? "selected" : ""}`} data-testid={`${testId}-mobile-row`}>
                {selectable && (
                  <div className="data-table-card-checkbox">
                    <input
                      type="checkbox"
                      name="ids"
                      value={id}
                      checked={isSelected}
                      onChange={(e) => onSelectRow?.(id, e.target.checked)}
                      aria-label="Select row"
                    />
                  </div>
                )}
                {mobileCardRenderer(row, isSelected)}
              </div>
            );
          }

          // Default fallback mobile card
          return (
            <div key={id} className={`data-table-card ${isSelected ? "selected" : ""}`} data-testid={`${testId}-mobile-row`}>
              <div className="data-table-card-body">
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((col) => (
                    <div key={col.key} className="data-table-card-field">
                      <span className="data-table-card-label">{col.header}:</span>
                      <span className="data-table-card-value">{col.cell(row, index)}</span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="table-scroll only-desktop">
        <table className="table data-table" data-testid={`${testId}-desktop`}>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((col) => {
                const alignClass = col.align === "right" ? "r" : col.align === "center" ? "c" : "";
                return (
                  <th key={col.key} className={alignClass} style={col.width ? { width: col.width } : undefined}>
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const id = keyExtractor(row);
              const isSelected = selectedIds.includes(id);

              return (
                <tr key={id} className={isSelected ? "selected-row" : ""} data-testid={`${testId}-row`}>
                  {selectable && (
                    <td style={{ width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        name="ids"
                        value={id}
                        checked={isSelected}
                        onChange={(e) => onSelectRow?.(id, e.target.checked)}
                        aria-label="Select row"
                      />
                    </td>
                  )}
                  {columns.map((col) => {
                    const alignClass = col.align === "right" ? "r" : col.align === "center" ? "c" : "";
                    return (
                      <td key={col.key} className={alignClass}>
                        {col.cell(row, index)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
