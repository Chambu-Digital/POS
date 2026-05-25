'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ArrowRight, ShoppingCart, Globe, Smartphone, Zap, BarChart3, Users, Shield } from 'lucide-react'

const WA_LINK = 'https://wa.me/254756528950?text=Hi%2C%20I%27m%20interested%20in%20Business%20Kit%20for%20my%20business.'

export default function LandingPage() {
  const router = useRouter()
  const [pwaChecked, setPwaChecked] = useState(false)

  useEffect(() => {
    // PWA detection — if running in standalone/installed mode, skip landing page
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) {
      router.replace('/auth/login')
      return
    }

    setPwaChecked(true)
  }, [router])

  // Don't flash landing page while checking PWA mode
  if (!pwaChecked) return null

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">Chambu Digital</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-green-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-green-600 transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-green-600 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Sign in
            </Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-20 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Zap size={12} /> All-in-one Business Solution
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
                Turn Engagement<br />
                <span className="text-green-600">into Sales</span> — Online<br />
                & In-Store
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Everything your business needs to sell smarter. POS system, professional website, and M-Pesa payments — all in one package.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3.5 rounded-xl text-center transition-colors flex items-center justify-center gap-2">
                  Get Business Kit <ArrowRight size={16} />
                </a>
                <Link href="/auth/demo" className="border border-gray-200 hover:border-green-400 text-gray-700 font-semibold px-6 py-3.5 rounded-xl text-center transition-colors">
                  Try Demo
                </Link>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><Check size={14} className="text-green-500" /> No setup fees</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-green-500" /> M-Pesa ready</span>
                <span className="flex items-center gap-1.5"><Check size={14} className="text-green-500" /> Works offline</span>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image src="/heropos.png" alt="POS System" width={600} height={400} className="w-full object-cover" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <BarChart3 size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Today's Sales</p>
                  <p className="text-sm font-bold text-gray-900">KES 24,500</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PAIN POINTS ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <p className="text-green-600 font-semibold text-sm uppercase tracking-wide mb-2">The Problem</p>
          <h2 className="text-3xl font-bold text-gray-900">Selling Online Shouldn't Be So Hard</h2>
        </div>
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-6">
          {[
            { img: '/retailugc.png', title: 'Don\'t Lose Customers', desc: 'Track every sale and never miss a customer again' },
            { img: '/posmockup.png', title: 'Do More, Less Time', desc: 'Automate your sales process and save hours daily' },
            { img: '/mpesaintergration.png', title: 'Don\'t Delay Your Time', desc: 'Accept M-Pesa payments instantly, no delays' },
            { img: '/businesskit.png', title: 'Deliver the Best in Business', desc: 'Professional tools that grow with your business' },
          ].map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
              <div className="h-40 bg-gray-50 overflow-hidden">
                <Image src={item.img} alt={item.title} width={300} height={160} className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BUSINESS KIT HERO ───────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              ⭐ Our Flagship Product
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to<br />Sell Smarter Online
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">Business Kit combines a powerful POS, a professional website, and M-Pesa payments into one seamless package.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: ShoppingCart,
                title: 'Point of Sale System',
                desc: 'Full POS with inventory management, sales tracking, staff management, and real-time reports. Works offline too.',
                color: 'bg-green-100 text-green-600',
              },
              {
                icon: Globe,
                title: 'Professional Website',
                desc: 'A beautiful, mobile-ready business website that showcases your products and drives online orders.',
                color: 'bg-blue-100 text-blue-600',
              },
              {
                icon: Smartphone,
                title: 'M-Pesa Integration',
                desc: 'Accept payments via M-Pesa STK Push, Paybill, or Till. Instant confirmation, zero delays.',
                color: 'bg-purple-100 text-purple-600',
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon size={22} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: BarChart3, label: 'Real-time Reports' },
              { icon: Users, label: 'Staff Management' },
              { icon: Shield, label: 'Secure & Reliable' },
              { icon: Zap, label: 'Works Offline' },
              { icon: Smartphone, label: 'Mobile Friendly' },
              { icon: Check, label: 'Easy Setup' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <f.icon size={15} className="text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-green-400 font-semibold text-sm uppercase tracking-wide mb-2">Simple Process</p>
          <h2 className="text-3xl font-bold mb-4">Start in Just 4 Simple Steps</h2>
          <p className="text-gray-400 mb-14">Get your business running digitally in minutes, not days.</p>

          <div className="grid md:grid-cols-4 gap-6 mb-14">
            {[
              { step: '01', title: 'Register', desc: 'Create your account with basic business details' },
              { step: '02', title: 'Set Up', desc: 'Add your products, staff, and payment methods' },
              { step: '03', title: 'Go Live', desc: 'Start selling in-store and online immediately' },
              { step: '04', title: 'Grow', desc: 'Track performance and scale your business' },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-4">
                  {s.step}
                </div>
                {i < 3 && <div className="hidden md:block absolute top-6 left-[calc(50%+24px)] right-0 h-px bg-green-800" />}
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>

          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-4 rounded-xl transition-colors text-lg">
            Start Selling Today <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-green-600 font-semibold text-sm uppercase tracking-wide mb-2">Pricing</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for Sellers, Shops and Brands Ready to Grow Online</h2>
            <p className="text-gray-500">Choose the plan that fits your business. Upgrade anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* POS Only */}
            <div className="border border-gray-200 rounded-2xl p-6">
              <p className="text-sm font-semibold text-gray-500 mb-1">Starter</p>
              <h3 className="text-xl font-bold text-gray-900 mb-1">POS Only</h3>
              <p className="text-sm text-gray-500 mb-6">For businesses that just need a point of sale system</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">KES 1,500</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                {['Full POS system', 'Inventory management', 'Sales reports', 'Staff accounts', 'M-Pesa payments', 'Offline mode'].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check size={14} className="text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="block text-center border border-green-600 text-green-600 hover:bg-green-50 font-semibold py-3 rounded-xl transition-colors">
                Get Started
              </a>
            </div>

            {/* Business Kit — FEATURED */}
            <div className="border-2 border-green-500 rounded-2xl p-6 relative shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                MOST POPULAR
              </div>
              <p className="text-sm font-semibold text-green-600 mb-1">Complete Solution</p>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Business Kit</h3>
              <p className="text-sm text-gray-500 mb-6">Everything you need to run and grow your business digitally</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">KES 3,500</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                {[
                  'Everything in POS Only',
                  'Professional business website',
                  'Online product catalog',
                  'M-Pesa STK Push',
                  'Customer management',
                  'Priority support',
                  'Custom domain',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check size={14} className="text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="block text-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
                Get Business Kit
              </a>
            </div>

            {/* Website Only */}
            <div className="border border-gray-200 rounded-2xl p-6">
              <p className="text-sm font-semibold text-gray-500 mb-1">Online Presence</p>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Website Only</h3>
              <p className="text-sm text-gray-500 mb-6">For businesses that already have a POS and need an online presence</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold text-gray-900">KES 2,000</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                {['Professional website', 'Product catalog', 'Online orders', 'M-Pesa checkout', 'Mobile optimized', 'Custom domain'].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check size={14} className="text-green-500 shrink-0" />{f}</li>
                ))}
              </ul>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="block text-center border border-green-600 text-green-600 hover:bg-green-50 font-semibold py-3 rounded-xl transition-colors">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-600 to-emerald-700 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Start Growing with AI-Powered Tools</h2>
          <p className="text-green-100 mb-8">Join hundreds of businesses already selling smarter with Chambu Digital.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="bg-white text-green-700 font-bold px-8 py-4 rounded-xl hover:bg-green-50 transition-colors">
              Get Business Kit — KES 3,500/mo
            </a>
            <Link href="/auth/demo" className="border border-white/40 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
              Try Demo First
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-green-200">
            <span className="flex items-center gap-1.5"><Check size={14} /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check size={14} /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-600 rounded-lg flex items-center justify-center">
              <ShoppingCart size={13} className="text-white" />
            </div>
            <span className="text-white font-bold">Chambu Digital</span>
          </div>
          <p className="text-sm">support@chambudigital.co.ke</p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Register</a>
            <Link href="/auth/demo" className="hover:text-white transition-colors">Demo</Link>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} Chambu Digital. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
