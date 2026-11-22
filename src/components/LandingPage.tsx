import React, { useState } from 'react';
import { 
  FileText, ShoppingCart, Landmark, Boxes, BookOpen, 
  RefreshCw, Camera, ShieldCheck, ChevronRight, CheckCircle2,
  HelpCircle, ArrowRight, Menu, X, ArrowUpRight
} from 'lucide-react';

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
      q: "Can I manage multiple bank and cash accounts?",
      a: "Yes. You can configure multiple commercial bank accounts, cash registers, and petty cash boxes with support for internal contra fund transfers."
    },
    {
      q: "Are financial reports generated from real accounting entries?",
      a: "Yes. Profit & Loss, Balance Sheet, Cash Flow, and Trial Balance statements are dynamically derived from balanced double-entry journal vouchers."
    },
    {
      q: "Can I export data for my Chartered Accountant or tax consultant?",
      a: "Yes. All invoice registers, ledgers, and cash/bank books can be exported directly into Excel (.xlsx), CSV, and JSON formats."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FFF8EC] text-[#12263A] flex flex-col font-sans selection:bg-[#F28C28]/20">
      
      {/* 1. Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8DFCF] px-4 sm:px-8 py-3.5 flex items-center justify-between">
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

        {/* CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onLoginClick || onEnterApp}
            className="btn-secondary !min-h-[38px] !text-[13px] !px-4"
          >
            Log In
          </button>
          <button
            onClick={onEnterApp}
            className="btn-primary !min-h-[38px] !text-[13px] !px-5"
          >
            <span>Get Started</span>
            <ArrowRight size={14} />
          </button>
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

      {/* 2. Hero Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto text-center flex flex-col items-center">
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
          <button
            onClick={onEnterApp}
            className="btn-primary w-full sm:w-auto !min-h-[44px] !px-7 !text-[15px]"
          >
            <span>Launch Workspace</span>
            <ArrowRight size={16} />
          </button>
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
            <span className="badge-status badge-paid">Double-Entry Verified</span>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white">
            <div className="p-4 rounded-lg bg-[#FFF8EC] border border-[#E8DFCF]">
              <span className="text-[12px] text-[#3E5368] font-medium">Sales Revenue</span>
              <p className="text-xl font-bold text-[#12263A] mt-1 tabular-nums">₹4,82,500.00</p>
            </div>
            <div className="p-4 rounded-lg bg-[#FFF8EC] border border-[#E8DFCF]">
              <span className="text-[12px] text-[#3E5368] font-medium">Gross Profit</span>
              <p className="text-xl font-bold text-[#1E8E5A] mt-1 tabular-nums">₹1,14,200.00</p>
            </div>
            <div className="p-4 rounded-lg bg-[#FFF8EC] border border-[#E8DFCF]">
              <span className="text-[12px] text-[#3E5368] font-medium">Liquid Treasury</span>
              <p className="text-xl font-bold text-[#14689F] mt-1 tabular-nums">₹2,45,000.00</p>
            </div>
            <div className="p-4 rounded-lg bg-[#FFF8EC] border border-[#E8DFCF]">
              <span className="text-[12px] text-[#3E5368] font-medium">Accounts Receivable</span>
              <p className="text-xl font-bold text-[#B7791F] mt-1 tabular-nums">₹68,300.00</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Grid */}
      <section id="features" className="py-16 bg-white border-y border-[#E8DFCF] px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">Built for Indian Trade & Commerce</h2>
            <p className="text-[14px] text-[#3E5368] mt-2">
              Every tool required to record, track, and reconcile your business operations in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div 
                  key={idx}
                  className="p-6 rounded-xl border border-[#E8DFCF] bg-[#FFFBF3] hover:border-[#1F86CC] transition shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#EAF5FD] text-[#14689F] flex items-center justify-center mb-4">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-base font-bold text-[#12263A]">{feat.title}</h3>
                    <p className="text-[13px] text-[#3E5368] mt-2 leading-relaxed">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. How It Works (3 Steps) */}
      <section id="how-it-works" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">How It Works</h2>
          <p className="text-[14px] text-[#3E5368] mt-2">Simple three-step workflow from setup to financial closure.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((st, idx) => (
            <div key={idx} className="bg-white p-6 rounded-xl border border-[#E8DFCF] relative">
              <span className="text-2xl font-bold text-[#F28C28] font-mono">{st.num}</span>
              <h3 className="text-lg font-bold text-[#12263A] mt-2">{st.title}</h3>
              <p className="text-[13px] text-[#3E5368] mt-2 leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. GST Compliance Strip */}
      <section id="compliance" className="py-12 bg-[#FFFBF3] border-y border-[#E8DFCF] px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-[#12263A]">GST-Compliant Documentation</h3>
              <p className="text-[13px] text-[#3E5368] mt-1">
                Formatted according to statutory requirements with valid HSN/SAC, state codes, and automated tax slabs.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['CGST + SGST (Intra-state)', 'IGST (Inter-state)', 'HSN / SAC Master', 'Rupee Amount in Words', 'Input Tax Credit (ITC)'].map((tag, i) => (
                <span key={i} className="px-3 py-1 rounded-md bg-white border border-[#E8DFCF] text-[12px] font-medium text-[#14689F]">
                  ✓ {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-16 px-4 sm:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#12263A]">Frequently Asked Questions</h2>
          <p className="text-[14px] text-[#3E5368] mt-1">Common answers about Bazaar-Guru capabilities.</p>
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
                  className={`text-[#3E5368] transition-transform ${openFaq === idx ? 'rotate-90' : ''}`} 
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
            <button
              onClick={onEnterApp}
              className="btn-primary !min-h-[44px] !px-8 !text-[15px]"
            >
              <span>Get Started Now</span>
              <ArrowRight size={16} />
            </button>
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
