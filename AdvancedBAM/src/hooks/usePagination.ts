import { useMemo } from 'react';

export interface UsePaginationResult<T> {
  pageItems: T[];
  safePage: number;
  totalPages: number;
  totalItems: number;
  canNext: boolean;
  canPrev: boolean;
}

export function usePagination<T>(items: T[], pageSize: number, currentPage: number): UsePaginationResult<T> {
  return useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const totalItems = list.length;
    const safePageSize = pageSize > 0 ? pageSize : 50;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const safePage = Math.max(0, Math.min(currentPage, totalPages - 1));
    const pageItems = list.slice(safePage * safePageSize, safePage * safePageSize + safePageSize);

    return {
      pageItems,
      safePage,
      totalPages,
      totalItems,
      canNext: safePage < totalPages - 1,
      canPrev: safePage > 0,
    };
  }, [items, pageSize, currentPage]);
}
