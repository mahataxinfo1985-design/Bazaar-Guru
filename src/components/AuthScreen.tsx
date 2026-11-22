import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, UserPlus, Sparkles, Building2, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [magicLink, setMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (magicLink) {
        // Magic Link
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Magic login link sent to your email! Please check your inbox.',
        });
      } else if (isSignUp) {
        // Sign Up
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: businessName || 'My Business',
            },
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Account created! Please sign in with your credentials.',
        });
        setIsSignUp(false);
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'An error occurred during authentication.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8EC] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E8DFCF] overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center bg-[#FFFBF3] border-b border-[#E8DFCF]">
          <div className="flex justify-center mb-2">
            <img 
              src="/logo.png" 
              alt="Bazaar-Guru" 
              className="h-14 w-auto object-contain" 
            />
          </div>
          <p className="text-[#3E5368] text-xs font-semibold">Professional GST Invoicing & Accounting Suite</p>
        </div>

        {/* Body */}
        <div className="p-6">
          {message && (
            <div className={`p-3.5 rounded-lg mb-5 flex items-start gap-2.5 text-xs font-semibold ${
              message.type === 'success' 
                ? 'bg-[#E6F6EE] text-[#1E8E5A] border border-[#1E8E5A]/20' 
                : 'bg-[#FDECEC] text-[#C23B3B] border border-[#C23B3B]/20'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && !magicLink && (
              <div>
                <label className="block text-[11px] font-semibold text-[#3E5368] uppercase tracking-wider mb-1.5">
                  Business / Company Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3E5368]/60">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="block w-full pl-9 pr-3 h-10 bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg focus:outline-hidden focus:border-[#3BA0E6] text-[#12263A] placeholder-[#3E5368]/50 text-xs font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#3E5368] uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3E5368]/60">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 h-10 bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg focus:outline-hidden focus:border-[#3BA0E6] text-[#12263A] placeholder-[#3E5368]/50 text-xs font-medium"
                />
              </div>
            </div>

            {!magicLink && (
              <div>
                <label className="block text-[11px] font-semibold text-[#3E5368] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3E5368]/60">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-9 pr-3 h-10 bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg focus:outline-hidden focus:border-[#3BA0E6] text-[#12263A] placeholder-[#3E5368]/50 text-xs font-medium"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-10 bg-[#E0771A] hover:bg-[#B85D0F] disabled:opacity-50 text-white font-semibold rounded-lg transition duration-150 text-xs cursor-pointer shadow-2xs mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : magicLink ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Send Magic Link
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Register Business
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Toggle Options */}
          <div className="mt-5 pt-4 border-t border-[#E8DFCF] flex flex-col gap-2 text-center text-xs">
            {!magicLink && (
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-[#1F86CC] hover:underline font-semibold cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Register"}
              </button>
            )}

            <button
              onClick={() => {
                setMagicLink(!magicLink);
                setMessage(null);
              }}
              className="text-[#3E5368] hover:text-[#12263A] font-medium transition cursor-pointer"
            >
              {magicLink ? 'Back to password login' : 'Or log in with a Passwordless Magic Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
