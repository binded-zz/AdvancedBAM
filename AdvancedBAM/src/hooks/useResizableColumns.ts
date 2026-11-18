import { logCatch } from '../utils/devWarn';
import bamStorage from '../utils/bamStorage';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getPixelsPerRem } from '../components/dragHelper';

export type ColumnKey =
  | 'name'
  | 'lotSize'
  | 'company'
  | 'vehicles'
  | 'profit'
  | 'service'
  | 'serviceUsage'
  | 'maintenance'
  | 'cat'
  | 'resource'
  | 'storage'
  | 'themePack'
  | 'district'
  | 'density'
  | 'level'
  | 'occupied'
  | 'happiness'
  | 'efficiency'
  | 'status'
  | 'actions';

export const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  name: 240,
  lotSize: 95,
  company: 135,
  vehicles: 110,
  profit: 115,
  service: 140,
  serviceUsage: 140,
  maintenance: 115,
  cat: 110,
  resource: 125,
  storage: 135,
  themePack: 95,
  district: 125,
  density: 85,
  level: 60,
  occupied: 110,
  happiness: 95,
  efficiency: 95,
  status: 80,
  actions: 180,
};

export const MIN_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  name: 120,
  lotSize: 65,
  company: 70,
  vehicles: 75,
  profit: 60,
  service: 70,
  serviceUsage: 70,
  maintenance: 75,
  cat: 65,
  resource: 65,
  storage: 85,
  themePack: 70,
  district: 70,
  density: 60,
  level: 45,
  occupied: 75,
  happiness: 75,
  efficiency: 75,
  status: 50,
  actions: 75,
};

export const COLUMN_CLASS_MAP: Record<ColumnKey, string> = {
  name: '.col-name',
  lotSize: '.col-lotsize',
  company: '.col-company',
  vehicles: '.col-vehicles',
  profit: '.col-profit',
  service: '.col-service',
  serviceUsage: '.col-service-usage',
  maintenance: '.col-maint',
  cat: '.col-cat',
  resource: '.col-resource',
  storage: '.col-storage',
  themePack: '.col-theme-pack',
  district: '.col-dist',
  density: '.col-density',
  level: '.col-lvl',
  occupied: '.col-occ',
  happiness: '.col-happy',
  efficiency: '.col-eff',
  status: '.col-status',
  actions: '.col-act',
};

const STORAGE_KEY = 'bam_table_column_widths_v3';
export const ORDER_STORAGE_KEY = 'bam_column_order';

export const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  'name',
  'lotSize',
  'company',
  'resource',
  'storage',
  'service',
  'serviceUsage',
  'vehicles',
  'profit',
  'maintenance',
  'cat',
  'themePack',
  'district',
  'density',
  'level',
  'occupied',
  'happiness',
  'efficiency',
  'status',
  'actions',
];

export function useResizableColumns(category: string = 'all') {
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
    try {
      const saved = bamStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      }
    } catch (err) { logCatch('useResizableColumns', err); }
    return { ...DEFAULT_COLUMN_WIDTHS };
  });

  const getOrderForCategory = useCallback((cat: string): ColumnKey[] => {
    try {
      const storageKey =
        cat === 'catalog'
          ? 'bam_catalog_col_order'
          : cat === 'all' || !cat
          ? ORDER_STORAGE_KEY
          : `bam_column_order_${cat}`;
      const saved = bamStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...parsed, ...DEFAULT_COLUMN_ORDER])) as ColumnKey[];
        }
      }
    } catch (err) { logCatch('useResizableColumns', err); }
    return [...DEFAULT_COLUMN_ORDER];
  }, []);

  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => getOrderForCategory(category));

  useEffect(() => {
    setColumnOrder(getOrderForCategory(category));
  }, [category, getOrderForCategory]);

  const [activeResizingCol, setActiveResizingCol] = useState<ColumnKey | null>(null);

  // Listen for column reset / order changes from Settings modal
  useEffect(() => {
    const onSettingsChanged = (e: any) => {
      if (e.detail?.key === 'columnOrder' && Array.isArray(e.detail.value)) {
        if (category === 'all' || !category) {
          setColumnOrder(e.detail.value);
        }
      }
      if (e.detail?.key === 'columnOrderPill' && e.detail.pill === category && Array.isArray(e.detail.value)) {
        setColumnOrder(Array.from(new Set([...e.detail.value, ...DEFAULT_COLUMN_ORDER])));
      }
      if (e.detail?.key === 'catalogColumnOrder' && category === 'catalog' && Array.isArray(e.detail.value)) {
        setColumnOrder(Array.from(new Set([...e.detail.value, ...DEFAULT_COLUMN_ORDER])));
      }
      if (e.detail?.key === 'resetColumns') {
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
        setColumnOrder(getOrderForCategory(category));
      }
    };
    window.addEventListener('bam-settings-changed', onSettingsChanged);
    return () => window.removeEventListener('bam-settings-changed', onSettingsChanged);
  }, [category, getOrderForCategory]);

  const saveWidths = useCallback((widths: Record<ColumnKey, number>) => {
    try {
      bamStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch (err) { logCatch('useResizableColumns', err); }
  }, []);

  const colStyles = useMemo<Record<ColumnKey, React.CSSProperties>>(() => {
    const res = {} as Record<ColumnKey, React.CSSProperties>;
    (Object.keys(DEFAULT_COLUMN_WIDTHS) as ColumnKey[]).forEach((key) => {
      const rawW = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 80;
      const minW = MIN_COLUMN_WIDTHS[key] || 35;
      const w = Math.max(minW, rawW);

      res[key] = {
        width: `${w}rem`,
        minWidth: `${w}rem`,
        maxWidth: `${w}rem`,
        flex: `0 0 ${w}rem`,

        boxSizing: 'border-box',
      };
    });
    return res;
  }, [columnWidths, columnOrder]);

  const getColStyle = useCallback(
    (colKey: ColumnKey): React.CSSProperties => {
      return colStyles[colKey];
    },
    [colStyles]
  );

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const handleResizeStart = useCallback(
    (colKey: ColumnKey, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCleanupRef.current?.();

      const scale = getPixelsPerRem();
      const startX = e.clientX;
      const minW = MIN_COLUMN_WIDTHS[colKey] || 35;
      const startWidth = Math.max(minW, columnWidths[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 80);
      const cssClass = COLUMN_CLASS_MAP[colKey];

      setActiveResizingCol(colKey);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      let latestWidth = startWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();

        const deltaPx = moveEvent.clientX - startX;
        const deltaRem = deltaPx / (scale > 0 ? scale : 1.0);
        const newWidth = Math.max(minW, Math.round(startWidth + deltaRem));
        latestWidth = newWidth;

        // Instant DOM update with zero React re-render latency
        const matched = document.querySelectorAll(cssClass);
        for (let i = 0; i < matched.length; i++) {
          const el = matched[i] as HTMLElement;
          el.style.width = `${newWidth}rem`;
          el.style.minWidth = `${newWidth}rem`;
          el.style.maxWidth = `${newWidth}rem`;
          el.style.flex = `0 0 ${newWidth}rem`;
        }
      };

      const cleanupListeners = () => {
        window.removeEventListener('mousemove', handleMouseMove, true);
        window.removeEventListener('mouseup', handleMouseUp, true);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        dragCleanupRef.current = null;
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();

        cleanupListeners();
        setActiveResizingCol(null);

        setColumnWidths((prev) => {
          const next = { ...prev, [colKey]: latestWidth };
          saveWidths(next);
          return next;
        });
      };

      dragCleanupRef.current = cleanupListeners;
      window.addEventListener('mousemove', handleMouseMove, true);
      window.addEventListener('mouseup', handleMouseUp, true);
    },
    [columnWidths, saveWidths]
  );

  const resetColumnWidth = useCallback(
    (colKey: ColumnKey) => {
      setColumnWidths((prev) => {
        const next = { ...prev, [colKey]: DEFAULT_COLUMN_WIDTHS[colKey] };
        saveWidths(next);
        return next;
      });

      // Also reset DOM immediately
      const defaultW = DEFAULT_COLUMN_WIDTHS[colKey];
      const cssClass = COLUMN_CLASS_MAP[colKey];
      const matched = document.querySelectorAll(cssClass);
      for (let i = 0; i < matched.length; i++) {
        const el = matched[i] as HTMLElement;
        el.style.width = `${defaultW}rem`;
        el.style.minWidth = `${defaultW}rem`;
        el.style.maxWidth = `${defaultW}rem`;
        el.style.flex = `0 0 ${defaultW}rem`;
      }
    },
    [saveWidths]
  );

  const resetAllWidths = useCallback(() => {
    setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
    try {
      bamStorage.removeItem(STORAGE_KEY);
    } catch (err) { logCatch('useResizableColumns', err); }

    // Reset all DOM cells immediately
    (Object.keys(DEFAULT_COLUMN_WIDTHS) as ColumnKey[]).forEach((colKey) => {
      const defaultW = DEFAULT_COLUMN_WIDTHS[colKey];
      const cssClass = COLUMN_CLASS_MAP[colKey];
      const matched = document.querySelectorAll(cssClass);
      for (let i = 0; i < matched.length; i++) {
        const el = matched[i] as HTMLElement;
        el.style.width = `${defaultW}rem`;
        el.style.minWidth = `${defaultW}rem`;
        el.style.maxWidth = `${defaultW}rem`;
        el.style.flex = `0 0 ${defaultW}rem`;
      }
    });
  }, []);

  return {
    columnWidths,
    columnOrder,
    activeResizingCol,
    handleResizeStart,
    resetColumnWidth,
    resetAllWidths,
    getColStyle,
    setColumnOrder,
  };
}

export default useResizableColumns;
