import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  align?: 'left' | 'right';
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Search...',
  icon,
  searchable = true,
  className = '',
  isOpen: controlledIsOpen,
  onToggle,
  onClose,
  align = 'left',
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [onClose]);

  const handleTriggerClick = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Autofocus search on open
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const [draftValues, setDraftValues] = useState<string[]>(selectedValues);

  // Synchronize draft state when opening or when external selectedValues change
  useEffect(() => {
    if (isOpen) {
      setDraftValues(selectedValues);
    }
  }, [isOpen, selectedValues]);

  // Intelligently sort options: search matches, checked items first, then count desc, then alphabetical
  const filteredOptions = useMemo(() => {
    let list = options;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          opt.value.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aChecked = draftValues.includes(a.value);
      const bChecked = draftValues.includes(b.value);
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      if (a.count !== undefined && b.count !== undefined && b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });
  }, [options, searchQuery, draftValues]);

  const handleToggle = (value: string) => {
    if (draftValues.includes(value)) {
      setDraftValues(draftValues.filter((v) => v !== value));
    } else {
      setDraftValues([...draftValues, value]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...draftValues, ...allFilteredValues]));
    setDraftValues(combined);
  };

  const handleClear = () => {
    if (searchQuery.trim()) {
      const filteredSet = new Set(filteredOptions.map((o) => o.value));
      setDraftValues(draftValues.filter((v) => !filteredSet.has(v)));
    } else {
      setDraftValues([]);
    }
  };

  const handleDone = () => {
    onChange(draftValues);
    handleClose();
  };

  const handleCancel = () => {
    setDraftValues(selectedValues);
    handleClose();
  };

  const selectedCount = selectedValues.length;
  const draftCount = draftValues.length;
  const isAllSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((o) => draftValues.includes(o.value));

  const displayLabel = useMemo(() => {
    if (selectedCount === 0) return label;
    const firstOption = options.find((o) => o.value === selectedValues[0]);
    const firstText = firstOption ? firstOption.label : selectedValues[0];
    if (selectedCount === 1) {
      return `${label}: ${firstText}`;
    }
    return `${label}: ${firstText} +${selectedCount - 1}`;
  }, [label, selectedValues, selectedCount, options]);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleTriggerClick}
        className={`h-7 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-3xs shrink-0 select-none ${
          selectedCount > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700 font-semibold'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        }`}
        aria-expanded={isOpen}
      >
        {icon}
        <span className="max-w-[145px] truncate" title={selectedValues.join(', ') || label}>
          {displayLabel}
        </span>
        {selectedCount > 1 && (
          <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded-full font-bold">
            {selectedCount}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 text-gray-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Popover Menu directly anchored beneath button */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-64 max-w-[85vw] rounded-xl bg-white border border-gray-200 shadow-xl z-50 p-2 space-y-2 animate-fadeIn duration-fast`}
        >
          {/* Optional Search */}
          {searchable && (
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-7 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-gray-800 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Quick Actions (Select All / Clear) */}
          <div className="flex items-center justify-between text-[11px] px-1 text-gray-500 border-b border-gray-100 pb-1.5">
            <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">
              {draftCount} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={isAllSelected}
                className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Select all
              </button>
              <span className="text-gray-200">•</span>
              <button
                type="button"
                onClick={handleClear}
                disabled={draftCount === 0}
                className="text-gray-500 hover:text-red-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Scrollable Checkbox List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = draftValues.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    onClick={() => handleToggle(opt.value)}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-blue-50/70 text-blue-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                      <span className="truncate" title={opt.label}>
                        {opt.label}
                      </span>
                    </div>

                    {opt.count !== undefined && (
                      <span className="text-[10.5px] text-gray-400 font-mono shrink-0 ml-1">
                        {opt.count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Staged Draft Action Buttons: Cancel and Done */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancel}
              className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors cursor-pointer shadow-3xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export interface ActiveFilterChip {
  id: string;
  category: string;
  label: string;
  onRemove: () => void;
}

export interface FilterChipsBarProps {
  chips: ActiveFilterChip[];
  onClearAll: () => void;
  className?: string;
}

export const FilterChipsBar: React.FC<FilterChipsBarProps> = ({
  chips,
  onClearAll,
  className = '',
}) => {
  if (chips.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap pt-1 ${className}`}>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
        Active Filters:
      </span>

      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/80 shadow-3xs animate-fadeIn"
        >
          <span className="text-blue-500 font-normal">{chip.category}:</span>
          <span className="font-semibold truncate max-w-[150px]" title={chip.label}>
            {chip.label}
          </span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="text-blue-400 hover:text-blue-900 transition-colors cursor-pointer ml-0.5"
            title={`Remove ${chip.category} filter`}
            aria-label={`Remove ${chip.category} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors cursor-pointer underline ml-1"
      >
        Clear all ({chips.length})
      </button>
    </div>
  );
};
