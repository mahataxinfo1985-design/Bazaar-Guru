import React, { useState } from 'react';
import { Plus, Users, BookOpen, DollarSign } from 'lucide-react';
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

  const filteredParties = parties.filter((p) => p.type === activeType);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Type Toggle Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveType('customer')}
          className={`px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition cursor-pointer ${
            activeType === 'customer' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Customers Database
        </button>
        <button
          onClick={() => setActiveType('supplier')}
          className={`px-4 py-2.5 text-xs font-bold uppercase border-b-2 transition cursor-pointer ${
            activeType === 'supplier' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Suppliers Database
        </button>
      </div>

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-950">
            Registered {activeType === 'customer' ? 'Customers' : 'Suppliers'} ({filteredParties.length})
          </h3>
          <p className="text-xs text-slate-500">
            Track individual party ledgers, running balances, and payment settlements.
          </p>
        </div>
        <button
          onClick={() => onAddParty(activeType)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-blue-800 transition cursor-pointer"
        >
          <Plus size={16} /> Add {activeType === 'customer' ? 'Customer' : 'Supplier'}
        </button>
      </div>

      {/* Grid of Party Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredParties.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No {activeType === 'customer' ? 'customers' : 'suppliers'} registered yet. Click the button above to add one.
          </div>
        ) : (
          filteredParties.map((p) => {
            const isDr = p.outstandingBalance >= 0;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-950 text-sm">{p.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold ${
                        p.gstin ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.gstin ? 'GST Registered' : 'Unregistered'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-medium">GSTIN: {p.gstin || 'N/A'}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Phone: {p.phone}</p>
                  <p className="text-xs text-slate-400 mt-2 truncate">Address: {p.billingAddress}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400">Ledger Outstanding:</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        isDr ? 'text-slate-900' : 'text-emerald-600'
                      }`}
                    >
                      ₹{Math.abs(p.outstandingBalance || 0).toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-slate-400">{isDr ? '(Dr)' : '(Cr)'}</span>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewLedger(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                    >
                      <BookOpen size={13} className="text-blue-600" />
                      <span>View Statement</span>
                    </button>
                    <button
                      onClick={() => onRecordPayment(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-700 transition cursor-pointer"
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
