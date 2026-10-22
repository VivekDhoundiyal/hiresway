import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface UseVirtualizerOptions {
  count: number;
  estimateSize: number | ((index: number) => number);
  overscan?: number;
  columns?: number; // For grid virtualization: number of items per row
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
}

export interface Virtualizer {
  virtualItems: VirtualItem[];
  totalSize: number;
  startIndex: number;
  endIndex: number;
  isScrolling: boolean;
  scrollToIndex: (index: number) => void;
}

export function useVirtualizer({
  count,
  estimateSize,
  overscan = 4,
  columns = 1,
  scrollContainerRef,
  containerRef,
}: UseVirtualizerOptions): Virtualizer {
  // Row count is ceil(count / columns)
  const rowCount = Math.ceil(count / Math.max(1, columns));

  const getItemSize = useCallback(
    (index: number) => (typeof estimateSize === 'function' ? estimateSize(index) : estimateSize),
    [estimateSize]
  );

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [isScrolling, setIsScrolling] = useState(false);
  const [containerOffset, setContainerOffset] = useState(0);
  const scrollTimeoutRef = useRef<any>(null);

  // Cumulative row offsets for fast binary search or direct math
  const rowOffsets = useMemo(() => {
    const offsets = new Float64Array(rowCount + 1);
    let curr = 0;
    for (let i = 0; i < rowCount; i++) {
      offsets[i] = curr;
      curr += getItemSize(i);
    }
    offsets[rowCount] = curr;
    return offsets;
  }, [rowCount, getItemSize]);

  const totalSize = rowOffsets.length > 0 ? rowOffsets[rowCount] : 0;

  // Ultra-smooth scroll listener with requestAnimationFrame and zero layout thrashing
  useEffect(() => {
    const resolveScrollParent = (): HTMLElement | Window | null => {
      if (scrollContainerRef?.current) return scrollContainerRef.current;
      const mainEl = typeof document !== 'undefined' ? document.getElementById('main-content') : null;
      if (mainEl) return mainEl;
      return typeof window !== 'undefined' ? window : null;
    };

    const element = resolveScrollParent();
    if (!element) return;

    let rafId: number | null = null;

    const measureOffset = () => {
      if (!containerRef?.current) return;
      if (element === window) {
        const top = window.scrollY || document.documentElement.scrollTop;
        const rect = containerRef.current.getBoundingClientRect();
        setContainerOffset(rect.top + top);
        setViewportHeight(window.innerHeight || 800);
      } else {
        const el = element as HTMLElement;
        const containerRect = containerRef.current.getBoundingClientRect();
        const parentRect = el.getBoundingClientRect();
        setContainerOffset(containerRect.top - parentRect.top + el.scrollTop);
        setViewportHeight(el.clientHeight || 800);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        let top = 0;
        if (element === window) {
          top = window.scrollY || document.documentElement.scrollTop;
        } else {
          top = (element as HTMLElement).scrollTop;
        }

        setScrollTop(top);
        setIsScrolling(true);

        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 120);
      });
    };

    const handleResize = () => {
      measureOffset();
      handleScroll();
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Initial offset measurement
    measureOffset();
    handleScroll();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      element.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [scrollContainerRef, containerRef]);

  // Binary search to find start row
  const findRowIndex = useCallback(
    (targetY: number): number => {
      let low = 0;
      let high = rowCount - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (rowOffsets[mid] <= targetY) {
          if (mid === rowCount - 1 || rowOffsets[mid + 1] > targetY) {
            return mid;
          }
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return 0;
    },
    [rowCount, rowOffsets]
  );

  const effectiveScrollTop = Math.max(0, scrollTop - containerOffset);
  const startRow = Math.max(0, findRowIndex(effectiveScrollTop) - overscan);
  const endRow = Math.min(rowCount - 1, findRowIndex(effectiveScrollTop + viewportHeight) + overscan);

  const virtualItems = useMemo(() => {
    if (rowCount === 0) return [];
    const items: VirtualItem[] = [];
    for (let r = startRow; r <= endRow; r++) {
      items.push({
        index: r,
        start: rowOffsets[r],
        size: rowOffsets[r + 1] - rowOffsets[r],
      });
    }
    return items;
  }, [startRow, endRow, rowCount, rowOffsets]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const rowIndex = Math.floor(index / Math.max(1, columns));
      if (rowIndex >= 0 && rowIndex < rowCount) {
        const targetTop = rowOffsets[rowIndex];
        if (scrollContainerRef?.current) {
          scrollContainerRef.current.scrollTo({ top: targetTop, behavior: 'smooth' });
        } else if (typeof window !== 'undefined') {
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }
    },
    [columns, rowCount, rowOffsets, scrollContainerRef]
  );

  return {
    virtualItems,
    totalSize,
    startIndex: startRow * columns,
    endIndex: Math.min(count - 1, (endRow + 1) * columns - 1),
    isScrolling,
    scrollToIndex,
  };
}
