import React, { useEffect, useRef, useState } from 'react';
import './BamCustomSlider.css';

interface BamCustomSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

export const BamCustomSlider: React.FC<BamCustomSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max >= safeMin ? max : safeMin;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const safeVal = Number.isFinite(value) ? value : safeMin;

  const clampAndSnap = (rawVal: number): number => {
    if (!Number.isFinite(rawVal)) return safeMin;
    const snapped = safeMin + Math.round((rawVal - safeMin) / safeStep) * safeStep;
    return Math.max(safeMin, Math.min(safeMax, Number(snapped.toFixed(6))));
  };

  const clamped = Math.max(safeMin, Math.min(safeMax, safeVal));
  const range = safeMax - safeMin;
  const pct = range > 0 ? Math.max(0, Math.min(100, ((clamped - safeMin) / range) * 100)) : 0;

  const calculateValue = (clientX: number) => {
    if (!trackRef.current) return clamped;
    const rect = trackRef.current.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 1;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / width));
    const raw = safeMin + ratio * (safeMax - safeMin);
    return clampAndSnap(raw);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCleanupRef.current?.();
    onChange(calculateValue(e.clientX));

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      onChange(calculateValue(ev.clientX));
    };
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', cleanup);
      if (dragCleanupRef.current === cleanup) {
        dragCleanupRef.current = null;
      }
    };
    dragCleanupRef.current = cleanup;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', cleanup);
  };

  return (
    <div
      className="bam-custom-slider-row"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="bam-slider-step-btn"
        onClick={() => onChange(clampAndSnap(clamped - safeStep))}
        title="Decrease value"
      >
        -
      </button>
      <div className="bam-custom-slider-track-wrap">
        <div ref={trackRef} className="bam-custom-slider-track" onMouseDown={handleMouseDown}>
          <div className="bam-custom-slider-fill" style={{ width: `${pct}%` }} />
          <div className="bam-custom-slider-thumb" style={{ left: `${pct}%` }} />
        </div>
      </div>
      <button
        type="button"
        className="bam-slider-step-btn"
        onClick={() => onChange(clampAndSnap(clamped + safeStep))}
        title="Increase value"
      >
        +
      </button>
      <input
        type="text"
        className="bam-slider-number-input"
        value={editingText !== null ? editingText : String(Math.round(clamped))}
        onFocus={() => setEditingText(String(Math.round(clamped)))}
        onChange={(e) => setEditingText(e.target.value)}
        onBlur={() => {
          const parsed = parseFloat(editingText ?? '');
          const finalVal = Number.isFinite(parsed) ? clampAndSnap(parsed) : clamped;
          onChange(finalVal);
          setEditingText(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditingText(null);
        }}
      />
    </div>
  );
};

export default BamCustomSlider;
