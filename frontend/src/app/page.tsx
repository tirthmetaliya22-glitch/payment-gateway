'use client';

import React from 'react';
import {
  ShieldCheck,
  Globe,
  Zap,
  Code2,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Menu,
  X,
  Lock,
  BarChart3,
  TrendingUp,
  Layers,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from "../components/AuthProvider";

const brands = ['VISA', 'Mastercard', 'STRIPE', 'GOLDMAN', 'CITI', 'AMEX', 'VISA', 'Mastercard', 'STRIPE', 'GOLDMAN', 'CITI', 'AMEX'];

export default function LandingPage() {
  const router = useRouter();
  const { isLoggedIn, userEmail } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isMenuOpen ? 'bg-white' : 'glass-panel border-b border-border'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2 z-[60]">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold hover:rotate-12 hover:scale-110 transition-all duration-300">P</div>
              <span className="text-xl font-bold tracking-tight text-secondary">PayFlow</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8 text-sm font-medium text-muted">
              {['Solutions', 'Pricing', 'Developers'].map((item) => (
                <Link key={item} href={`#${item.toLowerCase()}`}
                  className="relative group hover:text-primary transition-colors duration-200">
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary rounded-full group-hover:w-full transition-all duration-300" />
                </Link>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3 z-10">

              <div className="w-px h-4 bg-slate-200 mx-1" />
              <Link href="/login"
                className="px-4 py-2 text-secondary hover:text-primary transition-colors text-sm font-bold">
                Login
              </Link>
              <Link href="/contact"
                className="px-4 py-2 bg-secondary text-white rounded-md hover:bg-primary transition-all duration-300 text-sm font-bold hover:shadow-lg hover:shadow-indigo-200 hover:scale-105">
                Sign Up
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden z-[60] p-2 text-secondary hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        <div className={`fixed inset-0 z-50 md:hidden transition-all duration-500 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className={`absolute inset-0 bg-white/95 backdrop-blur-xl flex flex-col pt-24 px-6 transition-transform duration-500 ${isMenuOpen ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex flex-col gap-6 mb-12">
              {['Solutions', 'Pricing', 'Developers'].map((item) => (
                <Link
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-2xl font-bold text-secondary hover:text-primary transition-colors flex justify-between items-center group"
                >
                  {item}
                  <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
            <div className="mt-auto pb-12 flex flex-col gap-4">

              <Link
                href="/login"
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-4 text-center text-secondary font-bold border-2 border-slate-100 rounded-xl hover:bg-slate-50 transition-all"
              >
                Merchant Login
              </Link>
              <Link
                href="/contact"
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-4 text-center bg-primary text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      {/* ── Hero ── */}
      <section className="relative pt-24 md:pt-36 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute -top-10 md:-top-20 -left-16 md:-left-32 w-[350px] md:w-[700px] h-[350px] md:h-[700px] bg-indigo-100/60 rounded-full blur-[80px] md:blur-[160px] animate-float-slow" />
          <div className="absolute top-32 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-teal-100/50 rounded-full blur-[60px] md:blur-[120px] animate-float" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[250px] md:w-[400px] h-[200px] md:h-[300px] bg-indigo-50/80 rounded-full blur-[50px] md:blur-[100px] animate-pulse" />
          {/* Floating grid dots */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#4f46e5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center page-entry">
          {/* Animated live badge */}
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-white border border-indigo-100 shadow-sm shadow-indigo-100 text-indigo-600 text-[10px] md:text-xs font-bold mb-6 md:mb-10 hover:shadow-md transition-shadow cursor-default group">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
            </span>
            Live · Institutional Grade Infrastructure
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Headline with gradient sweep */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-4 md:mb-6 leading-[1.1] text-secondary">
            Seamless Global <br className="hidden sm:block" />
            <span className="gradient-text">Payments</span>
            {' '}for Enterprise
          </h1>

          <p className="text-base md:text-xl text-muted max-w-2xl mx-auto mb-8 md:mb-12 leading-relaxed px-2 md:px-0">
            The ultimate financial bridge for high-net-worth individuals and institutional partners.
            Secure, transparent, and built for precision.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4 mb-12 md:mb-20">
            <Link href="/contact"
              className="group relative px-6 md:px-8 py-3.5 md:py-4 bg-primary text-white rounded-xl font-bold overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-indigo-200 flex items-center justify-center gap-2">
              <span className="absolute inset-0 bg-gradient-to-r from-primary via-indigo-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative">Sign Up Now</span>
              <ArrowRight className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/login"
              className="group px-6 md:px-8 py-3.5 md:py-4 bg-white border-2 border-border text-secondary rounded-xl font-bold hover:border-primary/40 hover:bg-indigo-50/50 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2">
              Merchant Login
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform opacity-50" />
            </Link>

          </div>

          {/* Floating stat pills */}
          <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-12 md:mb-20">
            {[
              { icon: <TrendingUp className="w-3.5 h-3.5" />, label: '₹42B+ processed', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { icon: <Globe className="w-3.5 h-3.5" />, label: '140+ currencies', color: 'text-teal-600 bg-teal-50 border-teal-100' },
              { icon: <Zap className="w-3.5 h-3.5" />, label: '42ms latency', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: '99.99% uptime', color: 'text-teal-600 bg-teal-50 border-teal-100' },
            ].map((pill) => (
              <span key={pill.label}
                className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[10px] md:text-xs font-bold border ${pill.color} hover:scale-105 transition-transform cursor-default`}>
                {pill.icon} {pill.label}
              </span>
            ))}
          </div>
        </div>

        {/* Auto-scrolling brand ticker */}
        <div className="py-4 md:py-6 border-y border-slate-100 bg-white/60 backdrop-blur-sm relative overflow-hidden">
          <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-muted font-bold text-center mb-4 md:mb-6 relative z-10">Trusted by leading institutional partners</p>

          {/* Gradient fade masks */}
          <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

          <div className="marquee-track flex w-max">
            {[...Array(8)].map((_, groupIdx) => (
              <div key={groupIdx} className="flex gap-12 md:gap-20 pr-12 md:pr-20 shrink-0 items-center">
                {['VISA', 'Mastercard', 'STRIPE', 'GOLDMAN', 'CITI', 'AMEX'].map((brand, i) => (
                  <span key={i} className="text-lg md:text-xl font-black italic text-slate-300 hover:text-slate-500 transition-colors cursor-default shrink-0">
                    {brand}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="solutions" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 page-entry">
            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-widest mb-4">Infrastructure</span>
            <h2 className="text-4xl font-bold text-secondary mb-4">Precision-Tuned<br /><span className="gradient-text">Infrastructure</span></h2>
            <p className="text-muted max-w-xl mx-auto">Designed to handle the complexities of modern global finance with zero friction.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 stagger-entry">
            {[
              {
                icon: <Zap className="w-7 h-7" />,
                title: 'Instant Settlements',
                desc: 'Move capital at the speed of thought. Our proprietary routing ensures sub-second processing for global transactions.',
                iconColor: 'text-teal-600', iconBg: 'bg-teal-50',
              },
              {
                icon: <Globe className="w-7 h-7" />,
                title: 'Global Coverage',
                desc: 'Access 140+ currencies and local payment methods through a single, unified institutional-grade interface.',
                iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50',
              },
              {
                icon: <Code2 className="w-7 h-7" />,
                title: 'Developer First APIs',
                desc: 'Robust SDKs and clear documentation designed for seamless integration into your existing tech stack.',
                iconColor: 'text-teal-600', iconBg: 'bg-teal-50',
              },
            ].map((card) => (
              <div key={card.title}
                className="premium-card glow-hover p-8 rounded-2xl group cursor-default bg-white">
                <div className={`w-14 h-14 ${card.iconBg} rounded-2xl flex items-center justify-center ${card.iconColor} mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-secondary mb-3 group-hover:gradient-text transition-colors">{card.title}</h3>
                <p className="text-muted leading-relaxed text-sm">{card.desc}</p>
                <div className="mt-6 h-0.5 w-0 bg-gradient-to-r from-primary to-teal-500 group-hover:w-full transition-all duration-500 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-secondary via-indigo-950 to-teal-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-32 md:w-64 h-32 md:h-64 bg-indigo-500/10 rounded-full blur-[40px] md:blur-[80px] animate-pulse" />
          <div className="absolute bottom-0 left-1/4 w-24 md:w-48 h-24 md:h-48 bg-teal-500/10 rounded-full blur-[30px] md:blur-[60px] animate-pulse delay-500" />
        </div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
          {[
            { value: '₹42B+', label: 'Total Volume Processed', color: 'text-teal-400', delay: 'slide-up-1' },
            { value: '140+', label: 'Currencies Supported', color: 'text-indigo-300', delay: 'slide-up-2' },
            { value: '99.99%', label: 'Platform Uptime', color: 'text-teal-400', delay: 'slide-up-3' },
            { value: '42ms', label: 'Avg. API Latency', color: 'text-indigo-300', delay: 'slide-up-4' },
          ].map((stat) => (
            <div key={stat.label} className={`text-center slide-up ${stat.delay} group cursor-default`}>
              <p className={`text-4xl font-black mb-2 ${stat.color} group-hover:scale-110 transition-transform duration-300 inline-block`}>{stat.value}</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-16 md:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 page-entry">
            <span className="inline-block px-3 py-1 bg-teal-50 text-teal-600 text-xs font-bold rounded-full uppercase tracking-widest mb-4">Pricing</span>
            <h2 className="text-4xl font-bold text-secondary mb-4">Transparent Pricing</h2>
            <p className="text-muted">Scaling with your growth. No hidden fees, just pure institutional performance.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto stagger-entry">
            {/* Standard */}
            <div className="premium-card glow-hover p-10 rounded-2xl relative overflow-hidden group bg-white">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-300 group-hover:from-primary group-hover:to-teal-500 transition-all duration-500" />
              <h3 className="text-xl font-bold text-secondary mb-2">Standard</h3>
              <p className="text-muted text-sm mb-8">For growing institutions</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-black text-secondary">0.5%</span>
                <span className="text-muted text-sm">per transaction</span>
              </div>
              <ul className="space-y-4 mb-10">
                {['Up to ₹1M monthly volume', '24/7 Priority Support', 'Core API Access', 'Standard Security Suite'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-secondary font-medium group/item">
                    <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 group-hover/item:scale-110 transition-transform" />{f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 bg-secondary text-white rounded-xl font-bold hover:bg-primary transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100 hover:scale-[1.02]">
                Choose Standard
              </button>
            </div>

            {/* Enterprise — border-beam */}
            <div className="border-beam p-10 rounded-2xl relative overflow-hidden group bg-white shadow-xl shadow-indigo-100">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-teal-500 text-white text-[10px] uppercase tracking-widest font-bold px-4 py-1 rounded-bl-lg">
                Most Popular
              </div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-teal-500" />
              <h3 className="text-xl font-bold text-secondary mb-2">Enterprise</h3>
              <p className="text-muted text-sm mb-8">For global operations</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-black gradient-text">Custom</span>
              </div>
              <ul className="space-y-4 mb-10">
                {['Unlimited monthly volume', 'Dedicated Account Manager', 'Custom White-label APIs', 'Advanced Risk Management'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-secondary font-medium group/item">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 group-hover/item:scale-110 transition-transform" />{f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-4 bg-gradient-to-r from-primary to-teal-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-teal-700 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02]">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-secondary via-indigo-950 to-teal-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-10 md:-top-20 -right-10 md:-right-20 w-40 md:w-80 h-40 md:h-80 border border-white/5 rounded-full animate-spin-slow" />
          <div className="absolute top-5 md:top-10 right-5 md:right-10 w-24 md:w-48 h-24 md:h-48 border border-white/5 rounded-full animate-spin-slow" style={{ animationDirection: 'reverse' }} />
          <div className="absolute bottom-0 left-0 w-48 md:w-96 h-48 md:h-96 bg-teal-500/5 rounded-full blur-[40px] md:blur-[80px] animate-pulse" />
          <div className="absolute top-0 right-1/3 w-32 md:w-64 h-32 md:h-64 bg-indigo-500/10 rounded-full blur-[30px] md:blur-[60px] animate-pulse delay-700" />
        </div>
        <div className="max-w-3xl mx-auto text-center page-entry relative z-10">
          <span className="inline-block px-3 py-1 bg-white/10 text-white/80 text-xs font-bold rounded-full uppercase tracking-widest mb-6">Get Started</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to scale your <span className="gradient-text">payments</span>?
          </h2>
          <p className="text-slate-400 mb-10 text-lg">Join 1,200+ institutions already powering their financial operations with PayFlow.</p>
          <Link href="/contact"
            className="group inline-flex items-center gap-3 px-10 py-4 bg-white text-primary rounded-xl font-bold hover:bg-indigo-50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-black/20">
            Get in Touch
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-50 border-t border-border pt-12 md:pt-20 pb-8 md:pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6 group cursor-default">
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-white font-bold group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">P</div>
                <span className="text-xl font-bold tracking-tight text-secondary">PayFlow</span>
              </div>
              <p className="text-sm text-muted max-w-xs mb-8 leading-relaxed">
                Institutional-grade payment infrastructure designed for the next generation of global financial operations. Secure, compliant, and lightning-fast.
              </p>
              <div className="flex gap-3">
                {[Globe, ShieldCheck, Lock, BarChart3].map((Icon, i) => (
                  <div key={i}
                    className="w-9 h-9 bg-white border border-border rounded-lg flex items-center justify-center text-muted hover:text-primary hover:border-primary hover:scale-110 hover:shadow-md hover:shadow-indigo-100 transition-all duration-200 cursor-pointer">
                    <Icon className="w-4 h-4" />
                  </div>
                ))}
              </div>
            </div>

            {[
              { title: 'Solutions', links: ['Cross-border', 'Vaulting', 'Smart Routing', 'Compliance'] },
              { title: 'Resources', links: ['API Docs', 'Integrations', 'System Health', 'Support'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Cookie Policy', 'Security'] },
              { title: 'Admin', links: ['Admin Portal'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-bold text-secondary uppercase tracking-wider mb-6">{col.title}</h4>
                <ul className="space-y-4 text-sm text-muted">
                  {col.links.map((link) => (
                    <li key={link}>
                      <Link href={link === 'Admin Portal' ? '/admin/login' : '#'}
                        className="group inline-flex items-center gap-1 hover:text-primary transition-colors duration-200">
                        {link}
                        <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted font-medium">© 2024 PayFlow Infrastructure Ltd. All rights reserved.</p>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-teal-100">
              <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
              All Systems Operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
