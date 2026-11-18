import { logCatch } from '../utils/devWarn';
import bamStorage from '../utils/bamStorage';
import React, { useState, useRef, useEffect } from 'react';

export interface UseCardReorderOptions {
  initialOrder: string[];
  storageKey?: string;
}

export interface UseCardReorderResult {
  cardOrder: string[];
  setCardOrder: React.Dispatch<React.SetStateAction<string[]>>;
  draggedCardId: string | null;
  dragOverCardId: string | null;
  containerRef: React.RefObject<HTMLDivElement>;
  handleHeaderMouseDown: (e: React.MouseEvent, id: string) => void;
  moveCard: (id: string, delta: number) => void;
  resetLayout: () => void;
}

/**
 * Reusable pointer-based drag-and-drop hook for card grids in Cohtml (CS2).
 * Works 100% reliably in Hummingbird engine without HTML5 Drag & Drop API.
 */
export function useCardReorder({
  initialOrder,
  storageKey,
}: UseCardReorderOptions): UseCardReorderResult {
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    if (storageKey) {
      try {
        const saved = bamStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const valid = parsed.filter((id) => initialOrder.includes(id));
            const missing = initialOrder.filter((id) => !valid.includes(id));
            return [...valid, ...missing];
          }
        }
      } catch {
        // ignore
      }
    }
    return initialOrder;
  });

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoveredOverIdRef = useRef<string | null>(null);
  const dragInfoRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const saveOrder = (newOrder: string[]) => {
    setCardOrder(newOrder);
    if (storageKey) {
      try {
        bamStorage.setItem(storageKey, JSON.stringify(newOrder));
      } catch {
        // ignore
      }
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    dragInfoRef.current = {
      cardId: id,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
    hoveredOverIdRef.current = null;

    const prevUserSelect = typeof document !== 'undefined' ? document.body.style.userSelect : '';
    let appliedUserSelect = false;
    const restoreUserSelect = () => {
      if (appliedUserSelect && typeof document !== 'undefined') {
        document.body.style.userSelect = prevUserSelect;
        appliedUserSelect = false;
      }
    };

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!dragInfoRef.current) return;
      if (!dragInfoRef.current.isDragging) {
        if (Math.hypot(moveEvt.clientX - dragInfoRef.current.startX, moveEvt.clientY - dragInfoRef.current.startY) > 6) {
          dragInfoRef.current.isDragging = true;
          if (typeof document !== 'undefined') {
            document.body.style.userSelect = 'none';
            appliedUserSelect = true;
          }
          setDraggedCardId(dragInfoRef.current.cardId);
        }
      }

      if (dragInfoRef.current.isDragging && containerRef.current) {
        const cardElements = containerRef.current.querySelectorAll<HTMLElement>('.bam-dash-card');
        let foundOverId: string | null = null;
        cardElements.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (
            moveEvt.clientX >= rect.left &&
            moveEvt.clientX <= rect.right &&
            moveEvt.clientY >= rect.top &&
            moveEvt.clientY <= rect.bottom
          ) {
            foundOverId = el.getAttribute('data-card-id');
          }
        });
        hoveredOverIdRef.current = foundOverId;
        setDragOverCardId(foundOverId);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (dragInfoRef.current?.isDragging && dragInfoRef.current.cardId) {
        const srcId = dragInfoRef.current.cardId;
        const currentOverId = hoveredOverIdRef.current;
        if (currentOverId && currentOverId !== srcId) {
          setCardOrder((prev) => {
            const current = [...prev];
            const srcIdx = current.indexOf(srcId);
            const dstIdx = current.indexOf(currentOverId);
            if (srcIdx >= 0 && dstIdx >= 0) {
              current.splice(srcIdx, 1);
              current.splice(dstIdx, 0, srcId);
              if (storageKey) {
                try {
                  bamStorage.setItem(storageKey, JSON.stringify(current));
                } catch (err) { logCatch('useCardReorder', err); }
              }
              return current;
            }
            return prev;
          });
        }
      }

      hoveredOverIdRef.current = null;
      dragInfoRef.current = null;
      restoreUserSelect();
      setDraggedCardId(null);
      setDragOverCardId(null);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current?.();
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      restoreUserSelect();
      hoveredOverIdRef.current = null;
      dragInfoRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const moveCard = (id: string, delta: number) => {
    const current = [...cardOrder];
    const idx = current.indexOf(id);
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= current.length) return;

    current.splice(idx, 1);
    current.splice(targetIdx, 0, id);
    saveOrder(current);
  };

  const resetLayout = () => {
    saveOrder(initialOrder);
  };

  return {
    cardOrder,
    setCardOrder,
    draggedCardId,
    dragOverCardId,
    containerRef,
    handleHeaderMouseDown,
    moveCard,
    resetLayout,
  };
}

export default useCardReorder;
