import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, UserPlus, Sparkles, Building2, AlertCircle, KeyRound, ArrowLeft, Check, X } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: () => void;
  initialMode?: 'signin' | 'signup';
}

export default function AuthScreen({ onAuthSuccess, initialMode = 'signin' }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'magiclink' | 'forgot_password'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setMessage(null);
    }
  }, [initialMode]);

  // Password Security Strength Evaluation
  const checkPasswordStrength = (pwd: string) => {
    const hasMinLength = pwd.length >= 8;
    const hasNumber = /\d/.test(pwd);
    const hasLetters = /[a-zA-Z]/.test(pwd);
    const hasUpperLower = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);

    let score = 0;
    if (pwd.length > 0) score += 15;
    if (hasMinLength) score += 35;
    if (hasNumber) score += 20;
    if (hasUpperLower || (hasLetters && hasSpecial)) score += 15;
    if (hasSpecial) score += 15;

    score = Math.min(score, 100);

    let label = 'Too short';
    let barColor = 'bg-red-500';
    let textColor = 'text-red-600';

    if (!hasMinLength) {
      label = 'Weak (Must be at least 8 digits/characters)';
      barColor = 'bg-red-500';
      textColor = 'text-red-600';
    } else if (score < 60) {
      label = 'Moderate (Add uppercase letters & symbols)';
      barColor = 'bg-amber-500';
      textColor = 'text-amber-600';
    } else if (score < 85) {
      label = 'Good password';
      barColor = 'bg-blue-500';
      textColor = 'text-blue-600';
    } else {
      label = 'Strong password';
      barColor = 'bg-emerald-600';
      textColor = 'text-emerald-700';
    }

    return {
      score,
      label,
      barColor,
      textColor,
      hasMinLength,
      hasNumber,
      hasUpperLower,
      hasSpecial
    };
  };

  const pwdSecurity = checkPasswordStrength(password);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setMessage(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Google authentication failed. Please try again.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'magiclink') {
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
      } else if (mode === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Password recovery email sent! Check your inbox to set a new password.',
        });
      } else if (mode === 'signup') {
        // Enforce 8 digits / characters minimum
        if (password.length < 8) {
          setMessage({
            type: 'error',
            text: 'Password security requirement: Minimum 8 characters or digits are required.',
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: businessName || 'My Business',
              business_name: businessName || 'My Business',
            },
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Account created successfully! Please sign in with your credentials.',
        });
        setMode('signin');
      } else {
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
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="flex justify-center mb-2">
          <img 
            src="/logo.png" 
            alt="Bazaar-Guru" 
            className="h-12 w-auto object-contain" 
          />
        </div>
        <p className="text-[#3E5368] text-xs font-semibold">
          {mode === 'signup' 
            ? 'Create Your Business Workspace (Register New Account)' 
            : mode === 'forgot_password'
            ? 'Reset Your Password'
            : 'Sign in to access your cloud accounting records'}
        </p>
      </div>

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

      {/* Google OAuth Button */}
      {mode !== 'forgot_password' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 h-10 bg-white hover:bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg transition duration-150 text-xs font-semibold text-[#12263A] cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-[#E0771A]/30 border-t-[#E0771A] rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E8DFCF]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-[#3E5368]">
              <span className="bg-white px-2">Or continue with email</span>
            </div>
          </div>
        </div>
      )}

      {/* Email Form */}
      <form onSubmit={handleAuth} className="space-y-3.5">
        {mode === 'signup' && (
          <div>
            <label className="block text-[11px] font-semibold text-[#3E5368] uppercase tracking-wider mb-1">
              Business / Company Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3E5368]/60">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Aditya Retail Private Limited"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="block w-full pl-9 pr-3 h-10 bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg focus:outline-hidden focus:border-[#3BA0E6] text-[#12263A] placeholder-[#3E5368]/50 text-xs font-medium"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-[#3E5368] uppercase tracking-wider mb-1">
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

        {mode !== 'magiclink' && mode !== 'forgot_password' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-[#3E5368] uppercase tracking-wider">
                Password {mode === 'signup' && <span className="text-[#E0771A] font-bold">(Min. 8 digits/chars)</span>}
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot_password'); setMessage(null); }}
                  className="text-[11px] text-[#1F86CC] hover:underline font-medium cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3E5368]/60">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                placeholder={mode === 'signup' ? 'Min 8 characters / digits' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-9 pr-3 h-10 bg-[#FFFBF3] border border-[#E8DFCF] rounded-lg focus:outline-hidden focus:border-[#3BA0E6] text-[#12263A] placeholder-[#3E5368]/50 text-xs font-medium"
              />
            </div>

            {/* Real-time Password Security Progress Bar & Checklist for Registration */}
            {mode === 'signup' && password.length > 0 && (
              <div className="mt-2 p-2.5 bg-[#FFF8EC] rounded-lg border border-[#E8DFCF]/70 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#3E5368]">Security Strength:</span>
                  <span className={`font-bold ${pwdSecurity.textColor}`}>{pwdSecurity.label}</span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[#E8DFCF] rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 rounded-full ${pwdSecurity.barColor}`}
                    style={{ width: `${pwdSecurity.score}%` }}
                  />
                </div>

                {/* Requirements Checklist */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                  <div className={`flex items-center gap-1 ${pwdSecurity.hasMinLength ? 'text-[#1E8E5A] font-semibold' : 'text-[#3E5368]/70'}`}>
                    {pwdSecurity.hasMinLength ? <Check size={11} className="text-[#1E8E5A]" /> : <X size={11} className="text-red-400" />}
                    <span>Min. 8 characters/digits</span>
                  </div>
                  <div className={`flex items-center gap-1 ${pwdSecurity.hasNumber ? 'text-[#1E8E5A] font-semibold' : 'text-[#3E5368]/70'}`}>
                    {pwdSecurity.hasNumber ? <Check size={11} className="text-[#1E8E5A]" /> : <X size={11} className="text-red-400" />}
                    <span>At least 1 digit (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1 ${pwdSecurity.hasUpperLower ? 'text-[#1E8E5A] font-semibold' : 'text-[#3E5368]/70'}`}>
                    {pwdSecurity.hasUpperLower ? <Check size={11} className="text-[#1E8E5A]" /> : <X size={11} className="text-red-400" />}
                    <span>Upper & lower letters</span>
                  </div>
                  <div className={`flex items-center gap-1 ${pwdSecurity.hasSpecial ? 'text-[#1E8E5A] font-semibold' : 'text-[#3E5368]/70'}`}>
                    {pwdSecurity.hasSpecial ? <Check size={11} className="text-[#1E8E5A]" /> : <X size={11} className="text-red-400" />}
                    <span>Special character (!@#)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-10 bg-[#E0771A] hover:bg-[#B85D0F] disabled:opacity-50 text-white font-semibold rounded-lg transition duration-150 text-xs cursor-pointer shadow-2xs mt-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : mode === 'magiclink' ? (
            <>
              <Sparkles className="w-4 h-4" />
              Send Magic Link
            </>
          ) : mode === 'forgot_password' ? (
            <>
              <KeyRound className="w-4 h-4" />
              Send Password Reset Link
            </>
          ) : mode === 'signup' ? (
            <>
              <UserPlus className="w-4 h-4" />
              Register Business & Create Account
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* Navigation Footer */}
      <div className="mt-4 pt-3 border-t border-[#E8DFCF] flex flex-col gap-2 text-center text-xs">
        {mode === 'forgot_password' ? (
          <button
            type="button"
            onClick={() => { setMode('signin'); setMessage(null); }}
            className="flex items-center justify-center gap-1.5 text-[#1F86CC] hover:underline font-semibold cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Sign In</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setMessage(null);
              }}
              className="text-[#1F86CC] hover:underline font-semibold cursor-pointer"
            >
              {mode === 'signup' ? 'Already registered? Sign In here' : "Don't have an account? Register new business"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'magiclink' ? 'signin' : 'magiclink');
                setMessage(null);
              }}
              className="text-[#3E5368] hover:text-[#12263A] font-medium transition cursor-pointer"
            >
              {mode === 'magiclink' ? 'Back to password login' : 'Or log in with passwordless magic link'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
