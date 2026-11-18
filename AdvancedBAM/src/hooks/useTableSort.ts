import React, { useState, useCallback } from 'react';
import UilIcon from '../components/common/UilIcon';

export type SortDir = 'asc' | 'desc';

export interface UseTableSortResult<T> {
  sortField: T;
  sortDir: SortDir;
  handleSort: (field: T, isNumeric?: boolean) => void;
  sortIndicator: (field: T) => React.ReactNode;
}

export function useTableSort<T>(
  initialField: T,
  initialDir: SortDir = 'asc'
): UseTableSortResult<T> {
  const [sortField, setSortField] = useState<T>(initialField);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const handleSort = useCallback(
    (field: T, isNumeric: boolean = false) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir(isNumeric ? 'desc' : 'asc');
      }
    },
    [sortField]
  );

  const sortIndicator = useCallback(
    (field: T): React.ReactNode => {
      if (sortField !== field) return null;
      return React.createElement(UilIcon, {
        name: sortDir === 'asc' ? 'ArrowUp' : 'ArrowDown',
        sizeRem: 9,
        style: { marginLeft: '4rem', flexShrink: 0 },
      });
    },
    [sortField, sortDir]
  );

  return {
    sortField,
    sortDir,
    handleSort,
    sortIndicator,
  };
}
