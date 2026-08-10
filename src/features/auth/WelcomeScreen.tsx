import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HorizontalLogo, ShieldSpeedometerMark } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useThemeStore } from '../../store/useThemeStore';

export const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguageStore();
  const { mode, toggleDarkMode } = useThemeStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col font-body-md overflow-x-hidden selection:bg-primary/20">
      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-left focus:outline-none">
            <HorizontalLogo className="h-8" />
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-primary transition-colors">
              How It Works
            </button>
            <button onClick={() => scrollToSection('safety')} className="hover:text-primary transition-colors">
              Passenger Safety
            </button>
            <button onClick={() => scrollToSection('saccos')} className="hover:text-primary transition-colors">
              For SACCOs
            </button>
            <button onClick={() => scrollToSection('about')} className="hover:text-primary transition-colors">
              About
            </button>
          </nav>

          {/* Desktop Right Controls */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-label-mono text-on-surface-variant hover:bg-surface-container-high transition-colors"
              title="Toggle Language"
            >
              <span className="material-symbols-outlined text-base">language</span>
              <span className="font-bold uppercase">{language}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center"
              title="Toggle Theme"
            >
              <span className="material-symbols-outlined text-base">
                {mode === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Log In */}
            <Button variant="outline" size="sm" onClick={() => navigate('/auth/login')}>
              Log In
            </Button>

            {/* Get Started */}
            <Button variant="primary" size="sm" onClick={() => navigate('/location-permission')}>
              Get Started
            </Button>
          </div>

          {/* Mobile Right Controls & Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-xs font-label-mono text-on-surface-variant"
            >
              <span className="font-bold uppercase">{language}</span>
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-base">
                {mode === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg border border-outline-variant/30 text-on-surface"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-xl">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer Sheet */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-outline-variant/30 bg-surface px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col gap-2 font-label-bold text-sm text-on-surface">
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('safety')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                Passenger Safety
              </button>
              <button
                onClick={() => scrollToSection('saccos')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                For SACCOs
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                About
              </button>
            </nav>

            <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
              <Button variant="outline" className="w-full justify-center" onClick={() => navigate('/auth/login')}>
                Log In
              </Button>
              <Button variant="primary" className="w-full justify-center" onClick={() => navigate('/location-permission')}>
                Start a Safe Trip
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section id="hero" className="relative pt-8 pb-16 lg:pt-16 lg:pb-24 overflow-hidden border-b border-outline-variant/20 bg-gradient-to-b from-surface to-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">shield</span>
                <span>SAFER JOURNEYS. SMARTER TRANSPORT.</span>
              </div>

              <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-on-surface tracking-tight leading-[1.15]">
                Travel safer with <span className="text-primary">Mwendo Salama</span>.
              </h1>

              <p className="text-on-surface-variant text-base sm:text-lg max-w-2xl leading-relaxed font-body">
                Empowering Kenyan commuters with real-time speed awareness and road hazard alerts, while giving transport operators transparent fleet safety intelligence.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/location-permission')}
                  className="shadow-md hover:shadow-lg transition-all"
                >
                  <span>Start a Safe Trip</span>
                  <span className="material-symbols-outlined text-lg ml-1">arrow_forward</span>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/safety-map')}
                  className="border-outline-variant/50"
                >
                  <span className="material-symbols-outlined text-lg mr-1 text-primary">map</span>
                  <span>Explore Safety Map</span>
                </Button>
              </div>

              {/* Qualitative Trust Indicators */}
              <div className="pt-4 border-t border-outline-variant/20 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-medium text-on-surface-variant font-label-mono">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <span>Real-time trip safety</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <span>Speed limit awareness</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <span>Hazard & black spot reporting</span>
                </div>
              </div>
            </div>

            {/* Right Visual Storytelling Card (Hero Visual) */}
            <div className="lg:col-span-5 w-full">
              <div className="relative mx-auto max-w-md lg:max-w-none bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-xl space-y-5 overflow-hidden">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#1b4d2e_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.04] pointer-events-none" />

                {/* Header Badge */}
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <ShieldSpeedometerMark className="h-7 w-7" />
                    <div>
                      <span className="font-bold text-xs text-on-surface block">A104 Waiyaki Way Corridor</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">PSV Route Safety Monitoring</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active Trip
                  </span>
                </div>

                {/* Speed Meter Simulation */}
                <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-on-surface-variant">Live Speed Awareness</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">Within Limit</span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-extrabold text-4xl text-on-surface">72</span>
                      <span className="font-mono text-xs text-on-surface-variant">km/h</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Corridor Speed Limit</span>
                      <span className="font-mono font-bold text-xs text-on-surface">80 km/h</span>
                    </div>
                  </div>

                  {/* Meter Bar */}
                  <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden p-0.5 border border-outline-variant/20">
                    <div className="bg-emerald-600 h-full rounded-full w-[85%] transition-all duration-500" />
                  </div>
                </div>

                {/* Active Hazard Warning Badge */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">
                    warning
                  </span>
                  <div className="space-y-0.5 text-xs">
                    <span className="font-bold text-amber-900 dark:text-amber-200 block">
                      Approaching Unmarked Speed Bump (500m)
                    </span>
                    <span className="text-amber-800/80 dark:text-amber-300/80 block text-[11px]">
                      Community-reported hazard. Slow down for safe passage.
                    </span>
                  </div>
                </div>

                {/* Commuter Safety Badge */}
                <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant pt-1">
                  <span>Vehicle: Super Metro PSV</span>
                  <span className="font-bold text-primary">Mwendo Salama Protected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: HOW IT WORKS */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-surface-container-lowest border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
              SIMPLE THREE-STEP SAFETY
            </span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
              How Mwendo Salama Works
            </h2>
            <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
              Designed specifically for everyday public transport commuters in Kenya to keep journeys transparent and safe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 space-y-4 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-lg">
                01
              </div>
              <h3 className="font-bold text-lg text-on-surface">Start Your Journey</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Select or scan your PSV details or let location awareness guide your ride. Your trip safety monitoring starts instantly.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 space-y-4 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-lg">
                02
              </div>
              <h3 className="font-bold text-lg text-on-surface">Monitor Your Trip</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Receive gentle real-time speed limit awareness, corridor alerts, and approach notifications for known road black spots.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 space-y-4 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-lg">
                03
              </div>
              <h3 className="font-bold text-lg text-on-surface">Travel With Awareness</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Submit anonymous road hazard feedback and contribute to community safety intelligence across Kenyan transit corridors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: PASSENGER SAFETY FEATURES */}
      <section id="safety" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
            PASSENGER SAFETY FEATURES
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
            Built for Every Commuter in Kenya
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
            Essential tools to help you travel with confidence, awareness, and peace of mind.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Feature 1 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">speed</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">Real-Time Speedometer & Limit Awareness</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Clear visual speed gauge indicating current vehicle speed against official NTSA route speed limits during your trip.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">map</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">Verified Road Hazard & Black Spot Map</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Community-verified map highlighting dangerous curves, pothole clusters, unlit road sections, and frequent accident spots.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">sos</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">Rapid Emergency SOS Assistance</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              One-tap direct access to emergency response contacts and location sharing during critical events on the road.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">rate_review</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">Direct SACCO Feedback & Accountability</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Submit constructive feedback directly to SACCO management to encourage driver compliance and vehicle roadworthiness.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: SAFETY INTELLIGENCE & ABOUT */}
      <section id="about" className="py-16 sm:py-24 bg-surface-container-low border-y border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
              COMMUNITY-DRIVEN ROAD SAFETY
            </span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
              Turning Citizen Reports into Safer Corridors
            </h2>
            <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
              Combining passenger vigilance with transport operator insights to reduce speed infractions and protect lives.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/30 space-y-3">
              <span className="material-symbols-outlined text-3xl text-primary">groups</span>
              <h3 className="font-bold text-base text-on-surface">Crowdsourced Intelligence</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Verified passenger hazard reports create a dynamic safety picture across Nairobi, Kiambu, Nakuru, and national corridors.
              </p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/30 space-y-3">
              <span className="material-symbols-outlined text-3xl text-primary">assured_workload</span>
              <h3 className="font-bold text-base text-on-surface">Transparent Oversight</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                NTSA inspectors and county traffic teams gain objective data on high-risk road sections and repeat speed violations.
              </p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/30 space-y-3">
              <span className="material-symbols-outlined text-3xl text-primary">directions_bus</span>
              <h3 className="font-bold text-base text-on-surface">Smarter PSV Operations</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Helps SACCO officials identify driver risk patterns early, reward safe driving standards, and maintain vehicle roadworthiness.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: FOR SACCOS & FLEET OPERATORS */}
      <section id="saccos" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
            FOR SACCO MANAGERS & FLEET OPERATORS
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
            Complete Visibility Over Your Fleet Safety
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
            Modern tools for transport operators to maintain route compliance, protect vehicle investments, and uphold NTSA safety standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">analytics</span>
            <h3 className="font-bold text-base text-on-surface">Fleet Safety Scorecards</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Track driver safety ratings and fleet compliance across assigned routes.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">report_problem</span>
            <h3 className="font-bold text-base text-on-surface">Overspeed Exception Logs</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Review automated overspeed alerts with timestamped GPS location data.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">badge</span>
            <h3 className="font-bold text-base text-on-surface">Driver & Vehicle Registry</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Maintain registered driver credentials, PSV badges, and vehicle status.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">gavel</span>
            <h3 className="font-bold text-base text-on-surface">NTSA Inspection Alignment</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Prepare for regulatory audits with transparent digital compliance logs.
            </p>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <h4 className="font-bold text-lg text-on-surface">Are you a SACCO Official or Operator?</h4>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Access fleet oversight, driver scorecards, and violation management portals.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/auth/login')}>
            Go to SACCO Portal
            <span className="material-symbols-outlined text-lg ml-1">login</span>
          </Button>
        </div>
      </section>

      {/* SECTION 6: TRUST & PRIVACY */}
      <section className="py-12 sm:py-16 bg-surface-container-lowest border-y border-outline-variant/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-2xl">lock</span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider">RESPONSIBLE DATA & PRIVACY</span>
          </div>

          <h3 className="font-display font-bold text-xl sm:text-2xl text-on-surface">
            Built Around Commuter Privacy and Data Security
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left pt-2">
            <div className="space-y-1">
              <span className="font-bold text-xs text-on-surface block">🔒 Trip-Only Location Access</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                GPS location tracking is active strictly while you monitor a trip.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-xs text-on-surface block">🛡️ Kenya Data Protection Alignment</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Designed in compliance with national data protection regulations.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-xs text-on-surface block">👥 Anonymous Commuter Feedback</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Passenger reports are de-identified to protect commuter identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: FINAL CTA */}
      <section className="py-16 sm:py-20 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
          Make Every Journey More Safety-Aware.
        </h2>
        <p className="text-on-surface-variant text-sm sm:text-base font-body max-w-2xl mx-auto leading-relaxed">
          Join commuters, SACCO operators, and road safety advocates building safer public transport across Kenya.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button variant="primary" size="lg" onClick={() => navigate('/location-permission')}>
            Start Your Journey
            <span className="material-symbols-outlined text-lg ml-1">arrow_forward</span>
          </Button>

          <Button variant="outline" size="lg" onClick={() => scrollToSection('how-it-works')}>
            Learn How It Works
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-surface-container-high border-t border-outline-variant/30 text-on-surface py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: Brand */}
            <div className="space-y-3 md:col-span-1">
              <HorizontalLogo className="h-8" />
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Mwendo Salama — Securing every journey across Kenyan public transport corridors.
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface block uppercase font-mono tracking-wider">Product</span>
              <ul className="space-y-1.5 text-on-surface-variant">
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-primary">How It Works</button></li>
                <li><button onClick={() => navigate('/location-permission')} className="hover:text-primary">Passenger Trip Safety</button></li>
                <li><button onClick={() => navigate('/safety-map')} className="hover:text-primary">Safety Hazard Map</button></li>
                <li><button onClick={() => navigate('/auth/login')} className="hover:text-primary">SACCO Portal</button></li>
              </ul>
            </div>

            {/* Col 3: Community & Safety */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface block uppercase font-mono tracking-wider">Safety & Impact</span>
              <ul className="space-y-1.5 text-on-surface-variant">
                <li><button onClick={() => navigate('/safety-map')} className="hover:text-primary">Black Spot Reports</button></li>
                <li><button onClick={() => scrollToSection('about')} className="hover:text-primary">Safety Intelligence</button></li>
                <li><button onClick={() => navigate('/auth/login')} className="hover:text-primary">Inspector Portal</button></li>
              </ul>
            </div>

            {/* Col 4: Legal & Contact */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface block uppercase font-mono tracking-wider">Legal & Support</span>
              <ul className="space-y-1.5 text-on-surface-variant">
                <li><span className="text-on-surface-variant/80">Privacy Policy</span></li>
                <li><span className="text-on-surface-variant/80">Terms of Service</span></li>
                <li><span className="text-on-surface-variant/80">Data Protection</span></li>
                <li><span className="text-on-surface-variant/80">Emergency Contact: 999 / 112</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-on-surface-variant">
            <span>© 2026 Mwendo Salama. All rights reserved.</span>

            <div className="flex items-center gap-4">
              <button onClick={toggleLanguage} className="hover:text-primary uppercase font-bold">
                Language: {language.toUpperCase()}
              </button>
              <span>•</span>
              <button onClick={toggleDarkMode} className="hover:text-primary font-bold">
                Theme: {mode.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
