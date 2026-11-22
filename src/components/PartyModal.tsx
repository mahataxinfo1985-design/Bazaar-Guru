import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { Party, PartyType } from '../types';
import { INDIAN_STATES } from '../utils/gstEngine';
import { validateParty } from '../services/parties/partyService';
import { GSTRegistrationType } from '../types/workspace';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (party: Party) => void;
  type: PartyType;
}

export default function PartyModal({ isOpen, onClose, onSave, type }: PartyModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [registrationType, setRegistrationType] = useState<GSTRegistrationType>('regular');
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [creditPeriodDays, setCreditPeriodDays] = useState<number>(30);
  const [state, setState] = useState('Maharashtra');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'debit' | 'credit'>('debit');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const newParty: Party & any = {
      id: `party_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      gstin: gstin.trim().toUpperCase() || undefined,
      pan: pan.trim().toUpperCase() || undefined,
      registrationType,
      creditLimit: creditLimit > 0 ? creditLimit : undefined,
      creditPeriodDays: creditPeriodDays > 0 ? creditPeriodDays : undefined,
      billingAddress: billingAddress.trim(),
      shippingAddress: (sameAsBilling ? billingAddress.trim() : shippingAddress.trim()) || undefined,
      state,
      outstandingBalance: openingBalanceType === 'debit' ? openingBalance : -openingBalance,
      openingBalance,
      openingBalanceType,
      type,
    };

    const validation = validateParty(newParty);
    if (!validation.isValid) {
      return setError(validation.errors.join('; '));
    }

    onSave(newParty);
    // Reset state
    setName('');
    setPhone('');
    setEmail('');
    setGstin('');
    setPan('');
    setCreditLimit(0);
    setCreditPeriodDays(30);
    setState('Maharashtra');
    setBillingAddress('');
    setShippingAddress('');
    setSameAsBilling(true);
    setOpeningBalance(0);
    setOpeningBalanceType('debit');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Users size={20} className="text-blue-400" />
            <h2 className="text-lg font-bold">Add New {type === 'customer' ? 'Customer' : 'Supplier'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Party / Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Reliance Retail Ltd."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden font-mono"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@company.com"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* GSTIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                GSTIN (15 Digits)
              </label>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="27AAAAA1111A1Z1"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden font-mono uppercase"
              />
            </div>

            {/* PAN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                PAN (10 Digits)
              </label>
              <input
                type="text"
                maxLength={10}
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="AAAAA1111A"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden font-mono uppercase"
              />
            </div>

            {/* GST Registration Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tax Registration Type
              </label>
              <select
                value={registrationType}
                onChange={(e) => setRegistrationType(e.target.value as GSTRegistrationType)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden bg-white"
              >
                <option value="regular">Regular Taxpayer</option>
                <option value="composition">Composition Scheme</option>
                <option value="unregistered">Unregistered Business</option>
                <option value="consumer">Consumer (B2C)</option>
                <option value="sez">Special Economic Zone (SEZ)</option>
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                State (Place of Supply) <span className="text-red-500">*</span>
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden bg-white"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Credit Limit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={creditLimit || ''}
                onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                placeholder="0 (Unlimited if 0)"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Credit Period Days */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Credit Period (Days)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={creditPeriodDays || ''}
                onChange={(e) => setCreditPeriodDays(parseInt(e.target.value, 10) || 0)}
                placeholder="30"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Opening Balance */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Opening Balance (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance || ''}
                onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Opening Balance Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Balance Type
              </label>
              <select
                value={openingBalanceType}
                onChange={(e) => setOpeningBalanceType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden bg-white font-medium"
              >
                <option value="debit">{type === 'customer' ? 'Debit (Customer owes you)' : 'Debit (Advance paid to supplier)'}</option>
                <option value="credit">{type === 'customer' ? 'Credit (Advance received from customer)' : 'Credit (You owe supplier)'}</option>
              </select>
            </div>

            {/* Billing Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Billing Address <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Street address, City, Pincode"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Shipping Address Checkbox */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs text-slate-600 font-medium">Shipping address is same as billing address</span>
              </label>
            </div>

            {/* Separate Shipping Address */}
            {!sameAsBilling && (
              <div className="md:col-span-2 animate-in fade-in duration-150">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Shipping Address
                </label>
                <textarea
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Shipping destination / Warehouse address"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-hidden resize-none"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              Save {type === 'customer' ? 'Customer' : 'Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
