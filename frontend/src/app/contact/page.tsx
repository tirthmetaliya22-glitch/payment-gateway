'use client';

import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { API_URL } from '@/lib/api';

export default function ContactPage() {
  const router = useRouter();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    username: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log(`Attempting sign up at: ${API_URL}/contact`);
      const response = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Sign up successful:', result);

      // Show success state
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error during sign up:', error);
      alert('Connection error. Please ensure the backend is running at ' + API_URL);
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-border flex items-center px-8 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-muted hover:text-secondary transition-colors group">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold">Back to Home</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full grid md:grid-cols-2 gap-12 bg-white rounded-3xl shadow-xl shadow-slate-200 border border-border overflow-hidden">
          {/* Left Side: Info */}
          <div className="bg-secondary p-12 text-white flex flex-col">
            <div className="flex items-center gap-2 mb-12">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold">P</div>
              <span className="text-xl font-bold tracking-tight">PayFlow</span>
            </div>

            <h1 className="text-3xl font-bold mb-6">Contact our institutional team</h1>
            <p className="text-slate-400 mb-12 leading-relaxed">
              Our experts are ready to help you scale your financial operations with precision-tuned infrastructure.
            </p>

            <div className="space-y-6 mt-auto">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-primary">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Call Us</p>
                  <p className="font-medium text-sm">+1 (555) 000-PAYFLOW</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Us</p>
                  <p className="font-medium text-sm">contact@payflow.com</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form or Success */}
          <div className="p-12 flex flex-col justify-center">
            {isSubmitted ? (
              <div className="text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-secondary mb-3">Application Received</h2>
                <p className="text-muted text-sm mb-8 leading-relaxed">
                  Thank you for applying. Your institutional account is currently under review.
                  Our team will contact you once your dashboard is ready for activation.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-8 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Return to Home
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@enterprise.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">Desired Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="johndoe_p"
                    className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-100 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? 'Creating Account...' : 'Sign Up Now'} <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>

                <p className="text-[10px] text-center text-muted leading-relaxed">
                  By submitting this form, you agree to our <Link href="#" className="text-primary hover:underline">Privacy Policy</Link> and <Link href="#" className="text-primary hover:underline">Terms of Service</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
