import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';

export interface ExportOption {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface ExportDropdownProps {
  label?: string;
  options: ExportOption[];
  className?: string;
  iconOnly?: boolean;
  align?: 'left' | 'right' | 'top' | 'bottom';
}

export default function ExportDropdown({
  label = 'Export',
  options,
  className = '',
  iconOnly = false,
  align = 'bottom',
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          title={label}
        >
          <Download size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        >
          <Download size={13} className="text-slate-500" />
          <span>{label}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
      )}

      {isOpen && (
        <div
          className={`absolute z-50 min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 ${
            align === 'top' ? 'bottom-full mb-1 right-0' : 'top-full mt-1 right-0'
          }`}
        >
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                opt.onClick();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {opt.icon && <span className="text-slate-400">{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
