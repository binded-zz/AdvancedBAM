import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Scrollable } from 'cs2/ui';
import { getPixelsPerRem } from '../dragHelper';
import { UilIcon } from './UilIcon';
import './CustomSelect.css';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  extra?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  icon?: (value: string) => React.ReactNode;
  placeholder?: string;
  className?: string;
  title?: string;
  zIndex?: number;
}

interface DropdownCoordsRem {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxWidth: number;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options = [],
  onChange,
  icon,
  placeholder = 'Select...',
  className = '',
  title,
  zIndex = 100060,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<DropdownCoordsRem | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find((opt) => opt.value === value);
  const currentDisplay = selectedOption ? selectedOption.label : placeholder;
  const currentIcon = icon ? icon(value) : selectedOption?.icon;

  const computeCoords = useCallback((): DropdownCoordsRem | null => {
    if (!triggerRef.current || typeof window === 'undefined') return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const scale = getPixelsPerRem() || 1;
    const vpWRem = (window.innerWidth || 1920) / scale;
    const vpHRem = (window.innerHeight || 1080) / scale;

    const triggerTopRem = rect.top / scale;
    const triggerBottomRem = rect.bottom / scale;
    const triggerLeftRem = rect.left / scale;
    const triggerWidthRem = Math.max(110, rect.width / scale);
    const maxLabelChars = safeOptions.reduce((m, opt) => Math.max(m, (opt.label || '').length), 0);
    const estimatedMenuWRem = Math.min(380, Math.max(triggerWidthRem, maxLabelChars * 6 + 44));

    const estimatedMenuHRem = Math.min(240, Math.max(40, safeOptions.length * 28 + 8));
    const spaceBelowRem = vpHRem - triggerBottomRem - 8;
    const spaceAboveRem = triggerTopRem - 8;

    const clampedLeftRem = Math.max(8, Math.min(vpWRem - estimatedMenuWRem - 8, triggerLeftRem));
    const maxAllowedWRem = Math.max(110, Math.min(380, vpWRem - clampedLeftRem - 8));

    if (spaceBelowRem < estimatedMenuHRem && spaceAboveRem > spaceBelowRem) {
      return {
        bottom: Math.max(8, vpHRem - triggerTopRem + 4),
        left: clampedLeftRem,
        minWidth: Math.min(triggerWidthRem, maxAllowedWRem),
        maxWidth: maxAllowedWRem,
      };
    }

    return {
      top: Math.max(8, Math.min(vpHRem - 48, triggerBottomRem + 4)),
      left: clampedLeftRem,
      minWidth: Math.min(triggerWidthRem, maxAllowedWRem),
      maxWidth: maxAllowedWRem,
    };
  }, [safeOptions]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
    } else {
      setCoords(computeCoords());
      setIsOpen(true);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCoords(computeCoords());
      const handleClose = () => setIsOpen(false);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setIsOpen(false);
        }
      };
      window.addEventListener('resize', handleClose);
      window.addEventListener('keydown', handleKeyDown, true);
      return () => {
        window.removeEventListener('resize', handleClose);
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [isOpen, computeCoords]);

  const dropdownPortal =
    isOpen && coords && typeof document !== 'undefined' && document.body
      ? ReactDOM.createPortal(
          <>
            <div
              className="bam-custom-select-backdrop"
              style={{ zIndex: zIndex - 1 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <div
              className="bam-custom-select-dropdown"
              style={{
                position: 'fixed',
                top: coords.top !== undefined ? `${coords.top}rem` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}rem` : undefined,
                left: `${coords.left}rem`,
                minWidth: `${coords.minWidth}rem`,
                maxWidth: `${coords.maxWidth}rem`,
                maxHeight: '240rem',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: '#eceff1',
                zIndex: zIndex,
                marginTop: 0,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Scrollable vertical={true} trackVisibility="scrollable" style={{ maxHeight: '240rem' }}>
                {safeOptions.map((opt) => {
                  const isActive = opt.value === value;
                  const optIcon = icon ? icon(opt.value) : opt.icon;
                  return (
                    <div
                      key={opt.value}
                      className={`bam-custom-select-option${isActive ? ' active' : ''}${opt.className ? ` ${opt.className}` : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                    >
                      {optIcon && (
                        <span style={{ marginRight: '6rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {optIcon}
                        </span>
                      )}
                      <span>{opt.label}</span>
                      {opt.extra && (
                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                          {opt.extra}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Scrollable>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className={`bam-custom-select-container ${isOpen ? 'bam-select-open' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="bam-custom-select-trigger"
        onClick={handleToggle}
        title={title}
      >
        <span style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentIcon && (
            <span style={{ marginRight: '6rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {currentIcon}
            </span>
          )}
          <span className="bam-select-label-text">
            {currentDisplay}
          </span>
        </span>
        <span className="bam-select-caret">
          <UilIcon name={isOpen ? 'ChevronUp' : 'ChevronDown'} sizeRem={9} />
        </span>
      </button>

      {dropdownPortal}
    </div>
  );
};

export default CustomSelect;
