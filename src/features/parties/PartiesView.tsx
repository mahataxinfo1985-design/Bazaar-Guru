import React, { useState, useMemo } from 'react';
import { Plus, Users, BookOpen, DollarSign, Search, Filter } from 'lucide-react';
import { Party, PartyType } from '../../types';

interface PartiesViewProps {
  parties: Party[];
  onAddParty: (type: PartyType) => void;
  onViewLedger: (party: Party) => void;
  onRecordPayment: (party: Party) => void;
}

export default function PartiesView({
  parties,
  onAddParty,
  onViewLedger,
  onRecordPayment,
}: PartiesViewProps) {
  const [activeType, setActiveType] = useState<PartyType>('customer');
  const [searchQuery, setSearchQuery] = useState('');
  const [gstFilter, setGstFilter] = useState<'all' | 'registered' | 'unregistered'>('all');

  const filteredParties = useMemo(() => {
    return parties
      .filter((p) => p.type === activeType)
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.phone && p.phone.toLowerCase().includes(q)) ||
          (p.gstin && p.gstin.toLowerCase().includes(q)) ||
          (p.billingAddress && p.billingAddress.toLowerCase().includes(q))
        );
      })
      .filter((p) => {
        if (gstFilter === 'registered') return Boolean(p.gstin && p.gstin.trim());
        if (gstFilter === 'unregistered') return !p.gstin || !p.gstin.trim();
        return true;
      });
  }, [parties, activeType, searchQuery, gstFilter]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Type Toggle Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8DFCF] pb-2">
        <button
          onClick={() => setActiveType('customer')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeType === 'customer'
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs'
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          Customers Database
        </button>
        <button
          onClick={() => setActiveType('supplier')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeType === 'supplier'
              ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30 shadow-2xs'
              : 'text-[#3E5368] hover:bg-[#FFFBF3] hover:text-[#12263A]'
          }`}
        >
          Suppliers Database
        </button>
      </div>

      {/* Header, Search & Add Button */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#12263A] tracking-tight">
            Registered {activeType === 'customer' ? 'Customers' : 'Suppliers'} ({filteredParties.length})
          </h2>
          <p className="text-xs text-[#3E5368] mt-0.5">
            Track individual party ledgers, running balances, and payment settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onAddParty(activeType)}
            className="flex items-center gap-1.5 rounded-lg bg-[#E0771A] hover:bg-[#B85D0F] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-all cursor-pointer"
          >
            <Plus size={15} /> Add {activeType === 'customer' ? 'Customer' : 'Supplier'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white p-2.5 rounded-xl border border-[#E8DFCF] shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3E5368]" />
          <input
            type="text"
            placeholder={`Search ${activeType}s by name, phone, GSTIN...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-10 text-xs rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] placeholder-[#3E5368]/60 focus:bg-white focus:outline-hidden focus:border-[#3BA0E6] focus:ring-1 focus:ring-[#3BA0E6]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#3E5368]" />
          <select
            value={gstFilter}
            onChange={(e) => setGstFilter(e.target.value as any)}
            className="h-10 text-xs px-3 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] text-[#12263A] focus:outline-hidden focus:border-[#3BA0E6]"
          >
            <option value="all">All Statuses</option>
            <option value="registered">GST Registered</option>
            <option value="unregistered">Unregistered</option>
          </select>
        </div>
      </div>

      {/* Grid of Party Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredParties.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-[#3E5368] bg-white rounded-xl border border-[#E8DFCF]">
            No {activeType === 'customer' ? 'customers' : 'suppliers'} match your query. Click "Add {activeType === 'customer' ? 'Customer' : 'Supplier'}" to register one.
          </div>
        ) : (
          filteredParties.map((p) => {
            const isDr = (p.outstandingBalance || 0) >= 0;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-[#E8DFCF] bg-white p-4 shadow-2xs flex flex-col justify-between hover:border-[#3BA0E6]/50 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-[#12263A] text-sm">{p.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold ${
                        p.gstin
                          ? 'bg-[#EAF5FD] text-[#1F86CC] border border-[#3BA0E6]/30'
                          : 'bg-[#EEF2F6] text-[#3E5368] border border-[#E8DFCF]'
                      }`}
                    >
                      {p.gstin ? 'GST Registered' : 'Unregistered'}
                    </span>
                  </div>

                  <p className="text-xs text-[#3E5368] font-medium">GSTIN: {p.gstin || 'N/A'}</p>
                  <p className="text-xs text-[#3E5368] font-medium mt-0.5">Phone: {p.phone || 'N/A'}</p>
                  <p className="text-xs text-[#3E5368]/80 mt-1.5 truncate">Address: {p.billingAddress || 'N/A'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E8DFCF]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#3E5368]">Ledger Outstanding:</span>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        isDr ? 'text-[#12263A]' : 'text-[#1E8E5A]'
                      }`}
                    >
                      ₹{Math.abs(p.outstandingBalance || 0).toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-[#3E5368] font-normal">{isDr ? '(Dr)' : '(Cr)'}</span>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewLedger(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3] hover:bg-[#EAF5FD] text-xs font-semibold text-[#1F86CC] transition cursor-pointer"
                    >
                      <BookOpen size={13} />
                      <span>View Statement</span>
                    </button>
                    <button
                      onClick={() => onRecordPayment(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[#1E8E5A]/30 bg-[#E6F6EE] hover:bg-[#1E8E5A]/15 text-xs font-semibold text-[#1E8E5A] transition cursor-pointer"
                    >
                      <DollarSign size={13} />
                      <span>{activeType === 'customer' ? 'Receive Payment' : 'Pay Supplier'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
