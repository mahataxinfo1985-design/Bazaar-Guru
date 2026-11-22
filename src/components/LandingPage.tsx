import React, { useState } from 'react';
import { 
  FileText, ShoppingCart, Landmark, BookOpen, 
  RefreshCw, Camera, ShieldCheck, ChevronRight,
  ArrowRight, Menu, X
} from 'lucide-react';
import Ribbons from './reactbits/Ribbons';
import StarBorder from './reactbits/StarBorder';

interface LandingPageProps {
  onEnterApp: () => void;
  onLoginClick?: () => void;
}

export default function LandingPage({ onEnterApp, onLoginClick }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const features = [
    {
      icon: FileText,
      title: "GST Invoicing",
      desc: "Create compliant Tax Invoices, Bills of Supply, Credit Notes, and Delivery Challans with automated CGST, SGST, and IGST computations."
    },
    {
      icon: ShoppingCart,
      title: "Purchase & Inventory",
      desc: "Record supplier bills, track input tax credits (ITC), automate godown stock updates, and monitor batch expiry schedules."
    },
    {
      icon: BookOpen,
      title: "Double-Entry Accounting",
      desc: "Automated general ledger and journal vouchers with mathematical Trial Balance verification for audit-ready books."
    },
    {
      icon: Landmark,
      title: "Banking & Ageing Reminders",
      desc: "Manage multiple bank and cash registers, reconcile statements, and generate one-click WhatsApp payment reminders for overdue balances."
    },
    {
      icon: Camera,
      title: "Scan Bills",
      desc: "Digitize supplier paper receipts and purchase bills into structured accounting vouchers with instant preview."
    },
    {
      icon: RefreshCw,
      title: "Offline-First & Cloud Sync",
      desc: "Operate uninterrupted without internet connectivity using local storage, with cryptographic multi-device cloud synchronization."
    }
  ];

  const steps = [
    {
      num: "01",
      title: "Set Up Business Profile",
      desc: "Enter your registered GSTIN, trade name, state, and bank details for automated tax application."
    },
    {
      num: "02",
      title: "Create Invoices & Log Bills",
      desc: "Add products or services from your catalogue, calculate taxes in real-time, and print GST-compliant A4 or thermal slips."
    },
    {
      num: "03",
      title: "Track P&L & Balance Sheet",
      desc: "Review real-time financial statements, trial balances, and cashbook registers derived strictly from posted vouchers."
    }
  ];

  const faqs = [
    {
      q: "Does Bazaar-Guru work without an active internet connection?",
      a: "Yes. Bazaar-Guru runs on an offline-first architecture powered by IndexedDB. You can record sales, create invoices, and check stock offline. When internet is restored, changes synchronize automatically."
    },
    {
      q: "How does the GST calculation engine handle inter-state transactions?",
      a: "The engine automatically compares your business registered state with the customer or supplier billing state. Intra-state trades split evenly into CGST and SGST, while inter-state transactions apply IGST."
    },
    {
      q: "Where is my business data stored?",
      a: "Your data is stored securely in encrypted local browser storage (IndexedDB) for zero-latency operations, and backed up in real time to your cloud Supabase database when signed in."
    },
    {
      q: "Can I export invoices and reports to Excel and JSON?",
      a: "Yes. Bazaar-Guru supports one-click exports of GSTR-1, GSTR-3B summaries, Sales registers, P&L statements, and Balance Sheets into formatted Excel (.xlsx) and JSON files."
    }
  ];

  return (
    <div className="w-full bg-[#FFF8EC] text-[#12263A] min-h-screen selection:bg-[#E0771A]/20">
      {/* 1. Header & Navigation */}
      <header className="sticky top-0 z-40 bg-[#FFF8EC]/90 backdrop-blur-md border-b border-[#E8DFCF] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Bazaar-Guru" 
            className="h-9 w-auto object-contain cursor-pointer" 
            onClick={onEnterApp}
          />
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#3E5368]">
          <a href="#features" className="hover:text-[#E0771A] transition">Features</a>
          <a href="#how-it-works" className="hover:text-[#E0771A] transition">How It Works</a>
          <a href="#compliance" className="hover:text-[#E0771A] transition">GST Compliance</a>
          <a href="#faq" className="hover:text-[#E0771A] transition">FAQ</a>
        </nav>

        {/* CTAs with StarBorder */}
        <div className="hidden sm:flex items-center gap-3">
          <StarBorder
            onClick={onLoginClick || onEnterApp}
            color="#1F86CC"
            trailColor="#333667"
            theme="light"
            thickness={1.5}
            radius={8}
            className="!min-h-[38px] !text-[13px] !px-4 !py-1.5 font-semibold text-[#12263A] bg-white hover:bg-[#FFFBF3] border border-[#E8DFCF]"
          >
            Log In
          </StarBorder>
          <StarBorder
            onClick={onEnterApp}
            color="#f97316"
            trailColor="#ff4d2e"
            theme="dark"
            thickness={2}
            radius={8}
            className="!min-h-[38px] !text-[13px] !px-5 !py-1.5 font-semibold bg-[#E0771A] text-white shadow-xs hover:bg-[#B85D0F]"
          >
            <span>Get Started</span>
            <ArrowRight size={14} />
          </StarBorder>
        </div>

        {/* Mobile menu button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#3E5368] hover:bg-[#EAF5FD] rounded-lg"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#E8DFCF] px-6 py-4 space-y-3">
          <a 
            href="#features" 
            onClick={() => setMobileMenuOpen(false)}
            className="block text-[14px] font-medium text-[#3E5368] py-1"
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            onClick={() => setMobileMenuOpen(false)}
            className="block text-[14px] font-medium text-[#3E5368] py-1"
          >
            How It Works
          </a>
          <a 
            href="#compliance" 
            onClick={() => setMobileMenuOpen(false)}
            className="block text-[14px] font-medium text-[#3E5368] py-1"
          >
            GST Compliance
          </a>
          <a 
            href="#faq" 
            onClick={() => setMobileMenuOpen(false)}
            className="block text-[14px] font-medium text-[#3E5368] py-1"
          >
            FAQ
          </a>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => { setMobileMenuOpen(false); (onLoginClick || onEnterApp)(); }}
              className="btn-secondary w-full"
            >
              Log In
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onEnterApp(); }}
              className="btn-primary w-full"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* 2. Hero Section with Interactive Ribbons Canvas */}
      <div className="relative overflow-hidden">
        {/* Ribbons Interactive Canvas */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-45">
          <Ribbons
            colors={["#f97316", "#333667", "#ccaa95"]}
            thickness={30}
            length={1.4}
          />
        </div>

        <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF5FD] text-[#14689F] text-[13px] font-semibold border border-[#D4EBFA] mb-6">
            <ShieldCheck size={15} className="text-[#1F86CC]" />
            <span>GST Billing, Stock & Double-Entry Accounting for Indian Businesses</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#12263A] max-w-4xl leading-tight">
            Reliable GST Invoicing & Accounting Software That Works Offline
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[#3E5368] max-w-2xl leading-relaxed">
            Manage customer sales, vendor bills, inventory valuation, and multi-bank reconciliation in a fast, privacy-respecting workspace.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <StarBorder
              onClick={onEnterApp}
              color="#f97316"
              trailColor="#ff4d2e"
              theme="dark"
              thickness={2}
              radius={10}
              className="w-full sm:w-auto !min-h-[46px] !px-8 !text-[15px] font-semibold bg-[#E0771A] text-white shadow-md hover:bg-[#B85D0F]"
            >
              <span>Launch Workspace</span>
              <ArrowRight size={16} />
            </StarBorder>
            <a
              href="#features"
              className="btn-secondary w-full sm:w-auto !min-h-[44px] !px-6 !text-[15px]"
            >
              View Features
            </a>
          </div>

          {/* CSS Mockup of Dashboard UI */}
          <div className="mt-14 w-full max-w-4xl bg-white rounded-xl border border-[#E8DFCF] shadow-lg overflow-hidden text-left">
            <div className="bg-[#FFFBF3] border-b border-[#E8DFCF] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#C23B3B]/30" />
                <span className="w-3 h-3 rounded-full bg-[#F28C28]/30" />
                <span className="w-3 h-3 rounded-full bg-[#1E8E5A]/30" />
                <span className="ml-2 text-[12px] text-[#3E5368] font-mono">bazaarguru.local / dashboard</span>
              </div>
              <span className="text-[11px] font-semibold text-[#1E8E5A] bg-[#E6F6EE] px-2 py-0.5 rounded">
                Double-Entry Verified
              </span>
            </div>
            
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white">
              <div className="p-4 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3]">
                <div className="text-[12px] font-medium text-[#3E5368]">Total Sales (MTD)</div>
                <div className="text-2xl font-bold text-[#12263A] mt-1">₹12,293.00</div>
                <div className="text-[11px] text-[#1E8E5A] mt-2 font-medium">↑ Realtime voucher sync</div>
              </div>
              <div className="p-4 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3]">
                <div className="text-[12px] font-medium text-[#3E5368]">GST Liability Due</div>
                <div className="text-2xl font-bold text-[#12263A] mt-1">₹2,704.48</div>
                <div className="text-[11px] text-[#14689F] mt-2 font-medium">CGST + SGST + IGST Net</div>
              </div>
              <div className="p-4 rounded-lg border border-[#E8DFCF] bg-[#FFFBF3]">
                <div className="text-[12px] font-medium text-[#3E5368]">Bank & Cash Vault</div>
                <div className="text-2xl font-bold text-[#12263A] mt-1">₹1,53,74,940.00</div>
                <div className="text-[11px] text-[#3E5368] mt-2 font-medium">Balanced & Reconciled</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">
            Complete Financial Control for Indian Traders & Manufacturers
          </h2>
          <p className="mt-3 text-[15px] text-[#3E5368]">
            Everything required for daily business billing, double-entry ledgers, and audit compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div 
                key={i} 
                className="p-6 bg-white rounded-xl border border-[#E8DFCF] shadow-2xs hover:shadow-md transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-[#FFF8EC] border border-[#E8DFCF] flex items-center justify-center text-[#E0771A] mb-4">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-[#12263A] mb-2">{f.title}</h3>
                  <p className="text-[13px] text-[#3E5368] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. How It Works (3 Steps) */}
      <section id="how-it-works" className="py-20 px-4 sm:px-8 bg-white border-y border-[#E8DFCF]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">
              Get Started in Minutes
            </h2>
            <p className="mt-3 text-[15px] text-[#3E5368]">
              No complicated configuration. Seamless onboarding for Indian business owners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-start p-6 rounded-xl bg-[#FFFBF3] border border-[#E8DFCF]">
                <div className="text-3xl font-black text-[#E0771A] font-mono mb-3">{s.num}</div>
                <h3 className="text-lg font-bold text-[#12263A] mb-2">{s.title}</h3>
                <p className="text-[13px] text-[#3E5368] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. GST Compliance Highlights */}
      <section id="compliance" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto">
        <div className="bg-[#FFFBF3] rounded-2xl border border-[#E8DFCF] p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F6EE] text-[#1E8E5A] text-[12px] font-semibold border border-[#1E8E5A]/20 mb-4">
              <span>Statutory Compliance Assured</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">
              Designed Specifically for Indian Tax Regulations
            </h2>
            <p className="mt-3 text-[14px] text-[#3E5368] leading-relaxed">
              Every sales and purchase transaction automatically generates compliant journal entries, computes intra-state (CGST + SGST) vs inter-state (IGST) breakdowns, and prepares GSTR-1 & GSTR-3B audit tables with HSN summary reporting.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-[13px] font-medium text-[#12263A]">
              <span className="flex items-center gap-1.5"><span className="text-[#1E8E5A]">✓</span> 15-Digit GSTIN Verification</span>
              <span className="flex items-center gap-1.5"><span className="text-[#1E8E5A]">✓</span> State POS Determination</span>
              <span className="flex items-center gap-1.5"><span className="text-[#1E8E5A]">✓</span> Rounding Rule Offsets</span>
            </div>
          </div>
          <div className="w-full lg:w-auto shrink-0">
            <StarBorder
              onClick={onEnterApp}
              color="#f97316"
              trailColor="#ff4d2e"
              theme="dark"
              thickness={2}
              radius={10}
              className="w-full lg:w-auto !min-h-[46px] !px-8 !text-[15px] font-semibold bg-[#E0771A] text-white shadow-md hover:bg-[#B85D0F]"
            >
              <span>Explore GST System</span>
              <ArrowRight size={16} />
            </StarBorder>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="bg-white rounded-xl border border-[#E8DFCF] overflow-hidden transition"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full px-5 py-4 text-left font-semibold text-[15px] text-[#12263A] flex items-center justify-between gap-4 cursor-pointer"
              >
                <span>{faq.q}</span>
                <ChevronRight 
                  size={18} 
                  className={`text-[#3E5368] transition-transform duration-200 ${openFaq === idx ? 'rotate-90 text-[#E0771A]' : ''}`} 
                />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-4 text-[13px] text-[#3E5368] leading-relaxed border-t border-[#FFF8EC] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. Final CTA Band & Footer */}
      <section className="bg-[#14689F] text-white py-14 px-4 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-bold leading-tight">
            Ready to Streamline Your Business Accounting?
          </h2>
          <p className="mt-3 text-white/80 text-[14px]">
            No credit card required. Works directly in your browser with secure local storage.
          </p>
          <div className="mt-6 flex justify-center">
            <StarBorder
              onClick={onEnterApp}
              color="#f97316"
              trailColor="#ff4d2e"
              theme="dark"
              thickness={2}
              radius={10}
              className="!min-h-[46px] !px-8 !text-[15px] font-semibold bg-[#E0771A] text-white shadow-md hover:bg-[#B85D0F]"
            >
              <span>Get Started Now</span>
              <ArrowRight size={16} />
            </StarBorder>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-[#E8DFCF] py-8 px-4 sm:px-8 text-[13px] text-[#3E5368]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Bazaar-Guru" className="h-6 w-auto object-contain" />
            <span>— Business Accounting & Inventory Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-slate-400">Privacy First</span>
            <span className="text-slate-400">Offline Enabled</span>
            <span className="text-slate-400">Double-Entry Certified</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
