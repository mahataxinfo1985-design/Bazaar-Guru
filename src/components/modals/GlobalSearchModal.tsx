import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, ShoppingCart, Users, Package, CreditCard, ChevronRight } from 'lucide-react';
import { GlobalSearchResult } from '../../types/workspace';
import { performGlobalSearch } from '../../services/search/globalSearchService';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: GlobalSearchResult) => void;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectResult
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Handle ESC key press inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const res = await performGlobalSearch(query);
          setResults(res);
        } catch (err) {
          console.error('Global search error:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const getIconForType = (type: GlobalSearchResult['type']) => {
    switch (type) {
      case 'invoice':
      case 'quotation':
      case 'sales_order':
      case 'challan':
        return <FileText size={16} className="text-blue-500" />;
      case 'purchase_order':
      case 'purchase_bill':
        return <ShoppingCart size={16} className="text-purple-500" />;
      case 'party':
        return <Users size={16} className="text-emerald-500" />;
      case 'product':
        return <Package size={16} className="text-amber-500" />;
      case 'payment_voucher':
        return <CreditCard size={16} className="text-teal-500" />;
      default:
        return <FileText size={16} className="text-slate-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-[#E8DFCF] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[#E8DFCF] gap-3 bg-[#FFFBF3]">
          <Search size={18} className="text-[#3E5368]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoices, parties, items, quotes, vouchers, phone, GSTIN..."
            className="flex-1 bg-transparent text-sm text-[#12263A] placeholder-[#3E5368] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#3E5368] hover:text-[#12263A] p-1 rounded cursor-pointer"
              title="Clear input"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-semibold text-[#3E5368] hover:text-[#12263A] bg-white hover:bg-[#EAF5FD] rounded border border-[#E8DFCF] transition cursor-pointer"
            title="Close search (Esc)"
          >
            ESC
          </button>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden text-[#3E5368] hover:text-[#12263A] p-1 rounded cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">Searching business records...</div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching records found for "{query}".
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="py-6 text-center text-xs text-slate-400">
              Type at least 2 characters to search across all records...
            </div>
          )}

          {!loading && results.map((result) => (
            <div
              key={`${result.type}_${result.id}`}
              onClick={() => {
                onSelectResult(result);
                onClose();
              }}
              className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-100"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-100">
                  {getIconForType(result.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800 truncate">{result.title}</span>
                    {result.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600">
                        {result.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{result.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-400 pl-2">
                {result.amount !== undefined && (
                  <span className="text-xs font-semibold text-slate-700">₹{result.amount.toFixed(2)}</span>
                )}
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
