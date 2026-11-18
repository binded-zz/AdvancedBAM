import { useState, useCallback } from 'react';
import { useTableSort, SortDir } from './useTableSort';
import { CategoryFilter } from '../models/assetModels';
import bamStorage from '../utils/bamStorage';

const VALID_CATEGORY_FILTERS = new Set<string>([
  'All',
  'Districts',
  'ZoneMatrices',
  'Housing',
  'CommercialMatrix',
  'OfficeMatrix',
  'IndustrialMatrix',
  'StorageMatrix',
  'ServiceMatrix',
  'SignatureMatrix',
  'Residential',
  'Commercial',
  'Industrial',
  'Office',
  'Storage',
  'Service',
  'Signature',
  'Catalog',
]);

function readInitialCategory(): CategoryFilter {
  try {
    const saved = bamStorage.getItem('bam_active_category_view');
    if (saved && VALID_CATEGORY_FILTERS.has(saved)) {
      return saved as CategoryFilter;
    }
  } catch {
    // fallback to All
  }
  return 'All';
}

export function useBrowserTableState<K extends string>(
  initialSortField: K,
  initialSortDir: SortDir = 'asc'
) {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(readInitialCategory);
  const [currentPage, setCurrentPage] = useState(0);

  const tableSort = useTableSort<K>(initialSortField, initialSortDir);

  const resetPage = useCallback(() => setCurrentPage(0), []);

  const handleCategoryChange = useCallback((cat: CategoryFilter) => {
    setCategoryFilter(cat);
    setCurrentPage(0);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    setCurrentPage(0);
  }, []);

  return {
    searchText,
    setSearchText: handleSearchChange,
    categoryFilter,
    setCategoryFilter: handleCategoryChange,
    currentPage,
    setCurrentPage,
    resetPage,
    ...tableSort,
  };
}
