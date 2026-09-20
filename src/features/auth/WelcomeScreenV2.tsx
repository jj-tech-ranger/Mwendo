import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const WelcomeScreenV2: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setMobileMenuOpen(false);

    switch (path) {
      case 'home':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'why-mwendo':
      case 'mobility':
      case 'for-passengers':
      case 'ecosystem':
      case 'safety': {
        const el = document.getElementById(path);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
      case 'for-saccos': {
        const el = document.getElementById('ecosystem') || document.getElementById('why-mwendo');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
      case 'about': {
        const el = document.getElementById('why-mwendo');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
      case 'sign-in':
        navigate('/auth/login');
        break;
      case 'get-started':
        navigate('/location-permission');
        break;
      case 'contact':
        window.location.href = 'mailto:support@mwendo.co.ke?subject=Transit%20Support%20Inquiry';
        break;
      case 'privacy-policy':
      case 'terms-of-service':
      case 'system-status':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      default:
        break;
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      {/* FIXED NAVIGATION BAR */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-[#e5eae7] shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 max-w-[1280px] mx-auto px-gutter flex items-center justify-between gap-space-md">
          {/* Brand Lockup */}
          <div className="flex items-center gap-space-lg">
            <a
              className="flex items-center gap-space-sm cursor-pointer"
              data-path="home"
              href="#"
              onClick={(e) => handleNav('home', e)}
            >
              <img
                alt="Mwendo Logo"
                className="h-8 w-auto object-contain"
                src="/logo-light.png"
              />
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight">
                Mwendo
              </span>
            </a>
            <div className="hidden xl:flex items-center gap-space-xs pl-space-sm">
              <span className="inline-flex items-center px-space-sm py-space-xs rounded-full bg-surface-container-low text-primary font-label-badge text-label-badge tracking-wider uppercase">
                Civic Transit OS
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-space-lg" data-active-classes="text-primary font-bold">
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              data-path="why-mwendo"
              href="#why-mwendo"
              onClick={(e) => handleNav('why-mwendo', e)}
            >
              Why Mwendo
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              data-path="mobility"
              href="#mobility"
              onClick={(e) => handleNav('mobility', e)}
            >
              Mobility
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              data-path="for-passengers"
              href="#for-passengers"
              onClick={(e) => handleNav('for-passengers', e)}
            >
              For Passengers
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              data-path="for-saccos"
              href="#for-saccos"
              onClick={(e) => handleNav('for-saccos', e)}
            >
              For SACCOs
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              data-path="ecosystem"
              href="#ecosystem"
              onClick={(e) => handleNav('ecosystem', e)}
            >
              Ecosystem
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              data-path="safety"
              href="#safety"
              onClick={(e) => handleNav('safety', e)}
            >
              Safety
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-space-md">
            <a
              className="hidden sm:inline-flex font-body-md text-body-md text-on-surface-variant hover:text-on-surface px-space-sm py-space-xs transition-colors cursor-pointer"
              data-path="sign-in"
              href="#"
              onClick={(e) => handleNav('sign-in', e)}
            >
              Sign In
            </a>
            <a
              className="inline-flex items-center justify-center bg-primary text-on-primary font-body-md text-body-md font-semibold px-space-lg py-space-sm rounded-lg shadow-[0_4px_20px_-2px_rgba(13,25,18,0.08)] hover:bg-primary-container hover:text-on-primary-container transition-all cursor-pointer"
              data-path="get-started"
              href="#"
              onClick={(e) => handleNav('get-started', e)}
            >
              Get Started
            </a>
            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 cursor-pointer"
              onClick={(e) => handleNav('sign-in', e)}
              title="User Account"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-2xl">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#e5eae7] bg-surface px-gutter py-space-md shadow-lg">
            <nav className="flex flex-col gap-space-sm">
              <a
                className="py-2 text-on-surface font-body-md hover:text-primary transition-colors cursor-pointer"
                data-path="why-mwendo"
                href="#why-mwendo"
                onClick={(e) => handleNav('why-mwendo', e)}
              >
                Why Mwendo
              </a>
              <a
                className="py-2 text-on-surface font-body-md hover:text-primary transition-colors cursor-pointer"
                data-path="mobility"
                href="#mobility"
                onClick={(e) => handleNav('mobility', e)}
              >
                Mobility
              </a>
              <a
                className="py-2 text-on-surface font-body-md hover:text-primary transition-colors cursor-pointer"
                data-path="for-passengers"
                href="#for-passengers"
                onClick={(e) => handleNav('for-passengers', e)}
              >
                For Passengers
              </a>
              <a
                className="py-2 text-on-surface font-body-md hover:text-primary transition-colors cursor-pointer"
                data-path="for-saccos"
                href="#for-saccos"
                onClick={(e) => handleNav('for-saccos', e)}
              >
                For SACCOs
              </a>
              <a
                className="py-2 text-on-surface font-body-md hover:text-primary transition-colors cursor-pointer"
                data-path="ecosystem"
                href="#ecosystem"
                onClick={(e) => handleNav('ecosystem', e)}
              >
                Ecosystem
              </a>
              <a
                className="py-2 text-on-surface font-body-md hover:text-primary transition-colors cursor-pointer"
                data-path="safety"
                href="#safety"
                onClick={(e) => handleNav('safety', e)}
              >
                Safety
              </a>
              <div className="pt-space-sm border-t border-[#e5eae7] flex flex-col gap-space-sm">
                <a
                  className="py-2 text-on-surface font-body-md font-semibold hover:text-primary cursor-pointer"
                  data-path="sign-in"
                  href="#"
                  onClick={(e) => handleNav('sign-in', e)}
                >
                  Sign In
                </a>
                <a
                  className="inline-flex items-center justify-center bg-primary text-on-primary font-body-md font-semibold px-space-lg py-space-sm rounded-lg shadow-md cursor-pointer"
                  data-path="get-started"
                  href="#"
                  onClick={(e) => handleNav('get-started', e)}
                >
                  Get Started
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="w-full pt-20 bg-surface">
        <div className="flex flex-col w-full">
          {/* SECTION 1 — HERO */}
          <section className="relative w-full overflow-hidden bg-surface pb-space-2xl">
            <div className="max-w-[1280px] mx-auto px-gutter">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center pt-space-xl">
                {/* Hero Text Content (Left 7 Cols) */}
                <div className="lg:col-span-7 flex flex-col gap-space-lg">
                  <div className="inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container w-fit">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    <span className="font-label-eyebrow text-label-eyebrow text-primary uppercase tracking-wider">
                      MWENDO / KENYAN MOBILITY PLATFORM
                    </span>
                  </div>

                  <h1 className="font-display-hero text-display-hero text-on-surface tracking-tight">
                    Smarter, safer journeys across{' '}
                    <span className="text-secondary font-extrabold">Kenya</span>.
                  </h1>

                  <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                    Connecting passengers, SACCO operators, and transport authorities to build a more transparent, dependable, and dignified everyday transit experience.
                  </p>

                  {/* Primary Actions */}
                  <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                    <a
                      className="inline-flex items-center justify-center gap-space-xs bg-primary text-on-primary font-body-md text-body-md font-semibold px-space-xl py-space-md rounded-lg shadow-md hover:bg-primary-container transition-all cursor-pointer"
                      data-path="get-started"
                      href="#"
                      onClick={(e) => handleNav('get-started', e)}
                    >
                      <span>Create Account</span>
                      <span className="material-symbols-outlined text-sm">download</span>
                    </a>
                    <a
                      className="inline-flex items-center justify-center gap-space-xs bg-surface-container-low text-primary font-body-md text-body-md font-semibold px-space-lg py-space-md rounded-lg hover:bg-surface-container transition-all cursor-pointer"
                      href="#mobility"
                      onClick={(e) => handleNav('mobility', e)}
                    >
                      <span className="material-symbols-outlined text-secondary">play_circle</span>
                      <span>Watch how it works</span>
                    </a>
                  </div>

                  {/* Store Badges and Civic Trust Metrics */}
                  <div className="flex flex-wrap items-center gap-space-lg pt-space-sm">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary font-label-mono text-xs">
                      <span className="material-symbols-outlined text-sm">security</span>
                      <span className="font-semibold">NTSA &amp; SACCO Federation</span>
                    </div>
                    <div className="h-5 w-px bg-surface-container-high hidden sm:block" />
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-secondary text-base">verified</span>
                      <span className="font-body-sm text-body-sm">Backed by Nairobi &amp; Regional SACCO Cooperatives</span>
                    </div>
                  </div>
                </div>

                {/* Hero Visual Composition (Right 5 Cols) */}
                <div className="lg:col-span-5 relative flex justify-center">
                  <div className="relative w-full rounded-2xl overflow-hidden shadow-xl bg-surface-container border border-[#e5eae7]">
                    <img
                      alt="Mwendo Kenyan Urban Mobility Experience"
                      className="w-full h-full object-cover aspect-[1.79] lg:aspect-[4/5] object-center"
                      src="/images/hero-matatu.jpg"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 — WHY MWENDO (Core Value) */}
          <section className="w-full bg-surface-container-low py-space-3xl" id="why-mwendo">
            <div className="max-w-[1280px] mx-auto px-gutter">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-2xl items-start">
                {/* Left Column */}
                <div className="lg:col-span-5 flex flex-col gap-space-md">
                  <span className="font-label-eyebrow text-label-eyebrow text-secondary tracking-widest uppercase">
                    WHY MWENDO
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    A modern foundation for everyday transit.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant">
                    Public transit carries the lifeblood of Kenya's economy. Mwendo restores calm, predictability, and visibility to everyday urban travel by linking every moving part under a transparent standard.
                  </p>
                  <div className="pt-space-md">
                    <a
                      className="inline-flex items-center gap-space-xs text-primary font-body-md text-body-md font-semibold hover:text-secondary transition-colors cursor-pointer"
                      data-path="about"
                      href="#why-mwendo"
                      onClick={(e) => handleNav('about', e)}
                    >
                      <span>Read our civic transit charter</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  </div>
                </div>

                {/* Right Column: 4 Concise Value Propositions */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-space-lg">
                  {/* Item 1 */}
                  <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">verified_user</span>
                    </div>
                    <h3 className="font-title-md text-title-md text-primary pt-1">Verified Vehicles</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Know relevant vehicle and operator registration before you board. Certified SACCO credentials keep you informed and safe.
                    </p>
                  </div>

                  {/* Item 2 */}
                  <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-surface-container-high text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">location_on</span>
                    </div>
                    <h3 className="font-title-md text-title-md text-primary pt-1">Real-Time Information</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Stay informed about your journey and route progress in real time with synchronized cooperative timetables.
                    </p>
                  </div>

                  {/* Item 3 */}
                  <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-surface-container-high text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                    <h3 className="font-title-md text-title-md text-primary pt-1">Safety Alerts</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Receive timely notices regarding disruptions, sudden blackspots, road conditions, and corridor congestion updates.
                    </p>
                  </div>

                  {/* Item 4 */}
                  <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">hub</span>
                    </div>
                    <h3 className="font-title-md text-title-md text-primary pt-1">Connected Transport</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Bridge passengers, SACCOs, and regional transit authorities seamlessly on a unified, high-integrity open network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3 — REAL-TIME MOBILITY (Network Scale) */}
          <section className="w-full bg-surface py-space-3xl" id="mobility">
            <div className="max-w-[1280px] mx-auto px-gutter">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-2xl items-center">
                {/* Left: Corridor Scale Visual */}
                <div className="lg:col-span-7 relative">
                  <div className="rounded-2xl overflow-hidden shadow-xl bg-surface-container-high border border-[#e5eae7]">
                    <img
                      alt="Nairobi Highway and Corridor Scale"
                      className="w-full h-auto aspect-[1.34] object-cover"
                      src="/images/corridor-routes.jpg"
                    />
                  </div>
                  {/* Floating Badge */}
                  <div className="absolute -bottom-6 right-6 bg-primary text-on-primary p-space-md rounded-xl shadow-xl flex items-center gap-space-sm max-w-xs border border-white/10">
                    <span className="material-symbols-outlined text-secondary-fixed text-3xl">swap_calls</span>
                    <div>
                      <p className="font-label-badge text-label-badge font-bold">Over 85 Arterial Routes</p>
                      <p className="font-body-sm text-body-sm text-on-primary-container font-label-mono">
                        Monitored 24/7 across Nairobi Metropolitan Core
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Editorial Context & Checklist */}
                <div className="lg:col-span-5 flex flex-col gap-space-md mt-8 lg:mt-0">
                  <span className="font-label-eyebrow text-label-eyebrow text-secondary tracking-widest uppercase">
                    REAL-TIME JOURNEY INFORMATION
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    Know what's happening across every corridor.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant">
                    Mwendo unifies active transit feeds and cooperative route schedules to bring clarity to daily movement across Kenya's urban hubs.
                  </p>
                  <div className="flex flex-col gap-space-sm pt-space-sm">
                    <div className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-xl mt-0.5">check_circle</span>
                      <p className="font-body-md text-body-md text-on-surface">
                        Live vehicle verification and corridor status indicators
                      </p>
                    </div>
                    <div className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-xl mt-0.5">check_circle</span>
                      <p className="font-body-md text-body-md text-on-surface">
                        Route stops, expected transit windows, and transparent fares
                      </p>
                    </div>
                    <div className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-xl mt-0.5">check_circle</span>
                      <p className="font-body-md text-body-md text-on-surface">
                        Proactive congestion, road diversion, and weather alerts
                      </p>
                    </div>
                    <div className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-xl mt-0.5">check_circle</span>
                      <p className="font-body-md text-body-md text-on-surface">
                        Multi-point arrival time estimates calibrated by live traffic
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4 — THE CONNECTED ECOSYSTEM */}
          <section className="w-full bg-surface-container-low py-space-3xl" id="ecosystem">
            <div className="max-w-[1280px] mx-auto px-gutter">
              {/* Section Header */}
              <div className="text-center max-w-3xl mx-auto mb-space-2xl">
                <span className="font-label-eyebrow text-label-eyebrow text-secondary tracking-widest uppercase">
                  THE CONNECTED ECOSYSTEM
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight pt-space-xs">
                  Built for every participant in Kenya's transit fabric.
                </h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant pt-space-sm">
                  A truly resilient urban mobility infrastructure aligns travelers, cooperatives, city engineers, and system technicians under one standard.
                </p>
              </div>

              {/* Feature Image (Interchange Aerial) */}
              <div className="w-full rounded-2xl overflow-hidden shadow-lg mb-space-xl border border-[#e5eae7]">
                <img
                  alt="Connected Nairobi Urban Highway Interchange Network"
                  className="w-full h-auto aspect-[1.79] object-cover"
                  src="/images/ecosystem-interchange.jpg"
                />
              </div>

              {/* 4 Core Stakeholder Pillars in Balanced Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-xs hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined">commute</span>
                  </div>
                  <h3 className="font-title-md text-title-md text-primary font-bold">1. Passengers</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Travel with reliable real-time information, predictable transit schedules, and peace of mind on every corridor.
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-xs hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined">supervisor_account</span>
                  </div>
                  <h3 className="font-title-md text-title-md text-primary font-bold">2. SACCOs &amp; Operators</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Streamline vehicle dispatch, verify crew credentials, monitor maintenance readiness, and enhance commuter trust.
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-xs hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined">policy</span>
                  </div>
                  <h3 className="font-title-md text-title-md text-primary font-bold">3. Regulatory Authorities</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Observe arterial corridor density, route compliance rates, and road safety benchmarks in synchronized live feeds.
                  </p>
                </div>

                <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-[#e5eae7] flex flex-col gap-space-xs hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined">domain</span>
                  </div>
                  <h3 className="font-title-md text-title-md text-primary font-bold">4. County Transport Urban Planners</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Coordinate metropolitan transit corridors, terminal allocations, and long-term public mobility masterplans with empirical data.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5 — PASSENGER EXPERIENCE */}
          <section className="w-full bg-surface py-space-3xl" id="for-passengers">
            <div className="max-w-[1280px] mx-auto px-gutter">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-2xl items-center">
                {/* Passenger Visual */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-space-md items-center">
                  <div className="sm:col-span-12 rounded-2xl overflow-hidden shadow-lg bg-surface-container border border-[#e5eae7]">
                    <img
                      alt="Commuter seated calmly by window with backpack in clean transit interior"
                      className="w-full h-auto aspect-[1.79] sm:aspect-[4/5] object-cover"
                      src="/images/passenger-experience.jpg"
                    />
                  </div>
                </div>

                {/* Narrative Copy */}
                <div className="lg:col-span-5 flex flex-col gap-space-md">
                  <span className="font-label-eyebrow text-label-eyebrow text-secondary tracking-widest uppercase">
                    PASSENGER EXPERIENCE
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    Travel with everyday confidence.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant">
                    Whether commuting across Nairobi or embarking on an inter-county connection, Mwendo is engineered around the passenger's human journey—delivering dignity, predictability, and calm.
                  </p>
                  <div className="space-y-4 pt-space-xs">
                    <div className="p-space-md rounded-xl bg-surface-container-low border border-[#e5eae7] flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-2xl">sentiment_satisfied</span>
                      <div>
                        <h4 className="font-title-md text-title-md text-primary font-bold">Unrushed Commuting</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Know exactly when your ride arrives so you spend less time waiting on roadside stages.
                        </p>
                      </div>
                    </div>
                    <div className="p-space-md rounded-xl bg-surface-container-low border border-[#e5eae7] flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-2xl">shield</span>
                      <div>
                        <h4 className="font-title-md text-title-md text-primary font-bold">Guaranteed Accountability</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Trip details and vehicle telemetry stay recorded for safety and prompt customer assistance.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 6 — VEHICLE AWARENESS & SAFETY */}
          <section className="w-full bg-surface-container-low py-space-3xl" id="safety">
            <div className="max-w-[1280px] mx-auto px-gutter">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-2xl items-center">
                {/* Text & Safety Features (Left) */}
                <div className="lg:col-span-6 flex flex-col gap-space-md order-2 lg:order-1">
                  <span className="font-label-eyebrow text-label-eyebrow text-secondary tracking-widest uppercase">
                    TRAVEL WITH MORE INFORMATION
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                    Useful information before you board.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-surface-variant">
                    Make empowered transit decisions. Mwendo confirms the operational health, licensing, and track record of vehicles entering your stage.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-space-sm">
                    <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-[#e5eae7] hover:shadow-md transition-shadow">
                      <span className="material-symbols-outlined text-secondary text-2xl mb-1">fact_check</span>
                      <h4 className="font-title-md text-title-md text-primary font-bold">Verified SACCO Badges</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant pt-1">
                        Licensed PSV compliance status visible before you step foot on board.
                      </p>
                    </div>
                    <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-[#e5eae7] hover:shadow-md transition-shadow">
                      <span className="material-symbols-outlined text-secondary text-2xl mb-1">alt_route</span>
                      <h4 className="font-title-md text-title-md text-primary font-bold">Route Adherence</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant pt-1">
                        Live telemetry indicators confirm vehicles adhere to approved gazetted stages.
                      </p>
                    </div>
                    <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-[#e5eae7] hover:shadow-md transition-shadow">
                      <span className="material-symbols-outlined text-secondary text-2xl mb-1">campaign</span>
                      <h4 className="font-title-md text-title-md text-primary font-bold">Advisory Broadcasts</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant pt-1">
                        Real-time alerts broadcasted instantly across commuters on active sectors.
                      </p>
                    </div>
                    <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-[#e5eae7] hover:shadow-md transition-shadow">
                      <span className="material-symbols-outlined text-secondary text-2xl mb-1">psychology</span>
                      <h4 className="font-title-md text-title-md text-primary font-bold">Informed Mobility</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant pt-1">
                        Transparent fare structures and expected transit delays clearly illuminated.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Portrait of commuter checking bus (Right) */}
                <div className="lg:col-span-6 flex justify-center order-1 lg:order-2">
                  <div className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl bg-surface-container border border-[#e5eae7]">
                    <img
                      alt="Commuter checking mobile verification while viewing incoming bus"
                      className="w-full h-auto aspect-[0.81] object-cover"
                      src="/images/vehicle-verification.jpg"
                    />
                    <div className="absolute top-4 right-4 bg-primary text-on-primary px-3 py-1.5 rounded-full text-xs font-label-mono flex items-center gap-1.5 shadow-md border border-white/10">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                      <span>Vehicle Verified · KDA 892M</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7 — CALL TO ACTION */}
          <section className="w-full bg-surface py-space-2xl">
            <div className="max-w-[1280px] mx-auto px-gutter">
              <div className="bg-primary rounded-3xl p-space-xl md:p-space-3xl text-center text-on-primary shadow-2xl relative overflow-hidden border border-white/10">
                {/* Subtle Ambient Rings */}
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-secondary/15 blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center gap-space-md">
                  <span className="font-label-eyebrow text-label-eyebrow text-primary-fixed uppercase tracking-widest">
                    GET STARTED TODAY
                  </span>
                  <h2 className="font-display-hero text-display-hero text-on-primary tracking-tight">
                    Move with confidence.
                  </h2>
                  <p className="font-body-lg text-body-lg text-on-primary-container">
                    Join thousands of commuters, drivers, and SACCOs building a safer, more connected journey today.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-space-md pt-space-md">
                    <a
                      className="inline-flex items-center justify-center gap-space-xs bg-secondary-container text-on-secondary-container font-body-md text-body-md font-bold px-space-xl py-space-md rounded-lg shadow-md hover:bg-secondary-fixed transition-all cursor-pointer"
                      data-path="get-started"
                      href="#"
                      onClick={(e) => handleNav('get-started', e)}
                    >
                      <span>Create Free Account</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                    <a
                      className="inline-flex items-center justify-center gap-space-xs bg-primary-container text-on-primary font-body-md text-body-md font-semibold px-space-xl py-space-md rounded-lg hover:bg-secondary/20 transition-all cursor-pointer"
                      data-path="contact"
                      href="#"
                      onClick={(e) => handleNav('contact', e)}
                    >
                      <span>Contact Transit Support</span>
                      <span className="material-symbols-outlined text-sm">support_agent</span>
                    </a>
                  </div>

                  <div className="pt-space-lg flex flex-wrap items-center justify-center gap-space-lg font-body-sm text-body-sm text-on-primary-container">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary-fixed text-base">check</span>
                      <span>Free passenger account</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary-fixed text-base">check</span>
                      <span>Certified SACCO network</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary-fixed text-base">check</span>
                      <span>Available in English &amp; Kiswahili</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* INSTITUTIONAL FOOTER */}
      <footer className="w-full bg-primary text-on-primary pt-space-3xl pb-space-2xl border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-gutter">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-xl pb-space-2xl">
            {/* Col 1: Brand & Live Core Status */}
            <div className="lg:col-span-1 flex flex-col gap-space-md">
              <div className="flex items-center gap-space-sm cursor-pointer" onClick={(e) => handleNav('home', e)}>
                <img
                  alt="Mwendo Logo"
                  className="h-8 w-auto object-contain brightness-0 invert"
                  src="/logo-light.png"
                />
                <span className="font-headline-sm text-headline-sm text-on-primary tracking-tight">
                  Mwendo
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-primary-container max-w-xs">
                Kenya's unified public transit platform connecting commuters, SACCO operations, and civic transport infrastructure.
              </p>
              <div className="flex items-center gap-space-xs pt-space-xs">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim animate-pulse" />
                <span className="font-label-mono text-label-mono text-on-primary-container">
                  Nairobi Metropolitan Core · Live
                </span>
              </div>
            </div>

            {/* Col 2: Platform */}
            <div className="flex flex-col gap-space-sm">
              <span className="font-label-eyebrow text-label-eyebrow text-primary-fixed uppercase tracking-wider">
                Platform
              </span>
              <nav className="flex flex-col gap-space-xs">
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="mobility"
                  href="#mobility"
                  onClick={(e) => handleNav('mobility', e)}
                >
                  Unified Route Network
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="mobility"
                  href="#mobility"
                  onClick={(e) => handleNav('mobility', e)}
                >
                  Real-Time Fleet Telemetry
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="mobility"
                  href="#mobility"
                  onClick={(e) => handleNav('mobility', e)}
                >
                  Fare Clearance Engine
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="mobility"
                  href="#mobility"
                  onClick={(e) => handleNav('mobility', e)}
                >
                  Integrated Terminal Ops
                </a>
              </nav>
            </div>

            {/* Col 3: Solutions */}
            <div className="flex flex-col gap-space-sm">
              <span className="font-label-eyebrow text-label-eyebrow text-primary-fixed uppercase tracking-wider">
                Solutions
              </span>
              <nav className="flex flex-col gap-space-xs">
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="for-passengers"
                  href="#for-passengers"
                  onClick={(e) => handleNav('for-passengers', e)}
                >
                  Passenger Mobile Pass
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="for-saccos"
                  href="#for-saccos"
                  onClick={(e) => handleNav('for-saccos', e)}
                >
                  SACCO Fleet Management
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="for-saccos"
                  href="#for-saccos"
                  onClick={(e) => handleNav('for-saccos', e)}
                >
                  Crew Compliance &amp; Payouts
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="for-passengers"
                  href="#for-passengers"
                  onClick={(e) => handleNav('for-passengers', e)}
                >
                  Transit Card Top-up
                </a>
              </nav>
            </div>

            {/* Col 4: Ecosystem */}
            <div className="flex flex-col gap-space-sm">
              <span className="font-label-eyebrow text-label-eyebrow text-primary-fixed uppercase tracking-wider">
                Ecosystem
              </span>
              <nav className="flex flex-col gap-space-xs">
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="ecosystem"
                  href="#ecosystem"
                  onClick={(e) => handleNav('ecosystem', e)}
                >
                  Open Transit API
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="ecosystem"
                  href="#ecosystem"
                  onClick={(e) => handleNav('ecosystem', e)}
                >
                  County Transport Authorities
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="ecosystem"
                  href="#ecosystem"
                  onClick={(e) => handleNav('ecosystem', e)}
                >
                  Hardware Integrations
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="ecosystem"
                  href="#ecosystem"
                  onClick={(e) => handleNav('ecosystem', e)}
                >
                  Developer Portal
                </a>
              </nav>
            </div>

            {/* Col 5: Safety & Company */}
            <div className="flex flex-col gap-space-sm">
              <span className="font-label-eyebrow text-label-eyebrow text-primary-fixed uppercase tracking-wider">
                Safety &amp; Company
              </span>
              <nav className="flex flex-col gap-space-xs">
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="safety"
                  href="#safety"
                  onClick={(e) => handleNav('safety', e)}
                >
                  Emergency SOS Network
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="safety"
                  href="#safety"
                  onClick={(e) => handleNav('safety', e)}
                >
                  Driver Accreditation
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="why-mwendo"
                  href="#why-mwendo"
                  onClick={(e) => handleNav('why-mwendo', e)}
                >
                  About Mwendo
                </a>
                <a
                  className="font-body-sm text-body-sm text-on-primary-container hover:text-on-primary transition-colors cursor-pointer"
                  data-path="why-mwendo"
                  href="#why-mwendo"
                  onClick={(e) => handleNav('why-mwendo', e)}
                >
                  Civic Mission &amp; Impact
                </a>
              </nav>
            </div>
          </div>

          {/* Bottom Legal Bar */}
          <div className="pt-space-lg border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-space-md font-body-sm text-body-sm text-on-primary-container">
            <p>© 2025 Mwendo Mobility Technologies Ltd. All rights reserved. Sovereign East African Public Infrastructure.</p>
            <div className="flex items-center gap-space-lg">
              <a
                className="hover:text-on-primary transition-colors cursor-pointer"
                data-path="privacy-policy"
                href="#"
                onClick={(e) => handleNav('privacy-policy', e)}
              >
                Privacy Policy
              </a>
              <a
                className="hover:text-on-primary transition-colors cursor-pointer"
                data-path="terms-of-service"
                href="#"
                onClick={(e) => handleNav('terms-of-service', e)}
              >
                Terms of Service
              </a>
              <a
                className="hover:text-on-primary transition-colors cursor-pointer"
                data-path="system-status"
                href="#"
                onClick={(e) => handleNav('system-status', e)}
              >
                System Status
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WelcomeScreenV2;
