import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HorizontalLogo, ShieldSpeedometerMark } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { LanguageToggle } from '../../components/common/LanguageToggle';
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
              {t('welcome.nav.howItWorks')}
            </button>
            <button onClick={() => scrollToSection('safety')} className="hover:text-primary transition-colors">
              {t('welcome.nav.passengerSafety')}
            </button>
            <button onClick={() => scrollToSection('saccos')} className="hover:text-primary transition-colors">
              {t('welcome.nav.forSaccos')}
            </button>
            <button onClick={() => scrollToSection('about')} className="hover:text-primary transition-colors">
              {t('welcome.nav.about')}
            </button>
          </nav>

          {/* Desktop Right Controls */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Segmented Toggle */}
            <LanguageToggle />

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer"
              title="Toggle Theme"
              aria-label="Toggle theme"
            >
              <span className="material-symbols-outlined text-base">
                {mode === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Log In */}
            <Button variant="outline" size="sm" onClick={() => navigate('/auth/login')}>
              {t('welcome.nav.logIn')}
            </Button>

            {/* Get Started */}
            <Button variant="primary" size="sm" onClick={() => navigate('/location-permission')}>
              {t('welcome.nav.getStarted')}
            </Button>
          </div>

          {/* Mobile Right Controls & Hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />

            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant cursor-pointer"
              aria-label="Toggle theme"
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
                {t('welcome.nav.howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('safety')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                {t('welcome.nav.passengerSafety')}
              </button>
              <button
                onClick={() => scrollToSection('saccos')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                {t('welcome.nav.forSaccos')}
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-left py-2 px-3 rounded-lg hover:bg-surface-container"
              >
                {t('welcome.nav.about')}
              </button>
            </nav>

            <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
              <Button variant="outline" className="w-full justify-center" onClick={() => navigate('/auth/login')}>
                {t('welcome.nav.logIn')}
              </Button>
              <Button variant="primary" className="w-full justify-center" onClick={() => navigate('/location-permission')}>
                {t('welcome.nav.startSafeTrip')}
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
                <span>{t('welcome.hero.badge')}</span>
              </div>

              <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-on-surface tracking-tight leading-[1.15]">
                {t('welcome.hero.title')} <span className="text-primary">Mwendo Salama</span>.
              </h1>

              <p className="text-on-surface-variant text-base sm:text-lg max-w-2xl leading-relaxed font-body">
                {t('welcome.hero.description')}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/location-permission')}
                  className="shadow-md hover:shadow-lg transition-all"
                >
                  <span>{t('welcome.hero.startSafeTrip')}</span>
                  <span className="material-symbols-outlined text-lg ml-1">arrow_forward</span>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/safety-map')}
                  className="border-outline-variant/50"
                >
                  <span className="material-symbols-outlined text-lg mr-1 text-primary">map</span>
                  <span>{t('welcome.hero.exploreSafetyMap')}</span>
                </Button>
              </div>

              {/* Qualitative Trust Indicators */}
              <div className="pt-4 border-t border-outline-variant/20 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-medium text-on-surface-variant font-label-mono">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <span>{t('welcome.hero.trustTripSafety')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <span>{t('welcome.hero.trustSpeedAwareness')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                  <span>{t('welcome.hero.trustHazardReporting')}</span>
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
                      <span className="font-bold text-xs text-on-surface block">{t('welcome.hero.visualCorridor')}</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">{t('welcome.hero.visualMonitoring')}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t('welcome.hero.visualActiveTrip')}
                  </span>
                </div>

                {/* Speed Meter Simulation */}
                <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-on-surface-variant">{t('welcome.hero.visualLiveSpeed')}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('welcome.hero.visualWithinLimit')}</span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-extrabold text-4xl text-on-surface">72</span>
                      <span className="font-mono text-xs text-on-surface-variant">km/h</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-on-surface-variant block uppercase font-mono">{t('welcome.hero.visualSpeedLimitLabel')}</span>
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
                      {t('welcome.hero.visualWarningTitle')}
                    </span>
                    <span className="text-amber-800/80 dark:text-amber-300/80 block text-[11px]">
                      {t('welcome.hero.visualWarningDesc')}
                    </span>
                  </div>
                </div>

                {/* Commuter Safety Badge */}
                <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant pt-1">
                  <span>{t('welcome.hero.visualVehicle')}</span>
                  <span className="font-bold text-primary">{t('welcome.hero.visualProtected')}</span>
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
              {t('welcome.howItWorks.tag')}
            </span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
              {t('welcome.howItWorks.title')}
            </h2>
            <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
              {t('welcome.howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 space-y-4 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-lg">
                01
              </div>
              <h3 className="font-bold text-lg text-on-surface">{t('welcome.howItWorks.step1Title')}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {t('welcome.howItWorks.step1Desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 space-y-4 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-lg">
                02
              </div>
              <h3 className="font-bold text-lg text-on-surface">{t('welcome.howItWorks.step2Title')}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {t('welcome.howItWorks.step2Desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 space-y-4 hover:border-primary/40 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-lg">
                03
              </div>
              <h3 className="font-bold text-lg text-on-surface">{t('welcome.howItWorks.step3Title')}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {t('welcome.howItWorks.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: PASSENGER SAFETY FEATURES */}
      <section id="safety" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
            {t('welcome.safety.tag')}
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
            {t('welcome.safety.title')}
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
            {t('welcome.safety.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Feature 1 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">speed</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">{t('welcome.safety.f1Title')}</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              {t('welcome.safety.f1Desc')}
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">map</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">{t('welcome.safety.f2Title')}</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              {t('welcome.safety.f2Desc')}
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">sos</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">{t('welcome.safety.f3Title')}</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              {t('welcome.safety.f3Desc')}
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">rate_review</span>
            </div>
            <h3 className="font-bold text-xl text-on-surface">{t('welcome.safety.f4Title')}</h3>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              {t('welcome.safety.f4Desc')}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: SAFETY INTELLIGENCE & ABOUT */}
      <section id="about" className="py-16 sm:py-24 bg-surface-container-low border-y border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
              {t('welcome.about.tag')}
            </span>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
              {t('welcome.about.title')}
            </h2>
            <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
              {t('welcome.about.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/30 space-y-3">
              <span className="material-symbols-outlined text-3xl text-primary">groups</span>
              <h3 className="font-bold text-base text-on-surface">{t('welcome.about.c1Title')}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t('welcome.about.c1Desc')}
              </p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/30 space-y-3">
              <span className="material-symbols-outlined text-3xl text-primary">assured_workload</span>
              <h3 className="font-bold text-base text-on-surface">{t('welcome.about.c2Title')}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t('welcome.about.c2Desc')}
              </p>
            </div>

            <div className="bg-surface p-6 rounded-2xl border border-outline-variant/30 space-y-3">
              <span className="material-symbols-outlined text-3xl text-primary">directions_bus</span>
              <h3 className="font-bold text-base text-on-surface">{t('welcome.about.c3Title')}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {t('welcome.about.c3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: FOR SACCOS & FLEET OPERATORS */}
      <section id="saccos" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="font-mono text-xs font-bold text-primary uppercase tracking-widest block">
            {t('welcome.saccos.tag')}
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
            {t('welcome.saccos.title')}
          </h2>
          <p className="text-on-surface-variant text-sm sm:text-base font-body leading-relaxed">
            {t('welcome.saccos.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">analytics</span>
            <h3 className="font-bold text-base text-on-surface">{t('welcome.saccos.s1Title')}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('welcome.saccos.s1Desc')}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">report_problem</span>
            <h3 className="font-bold text-base text-on-surface">{t('welcome.saccos.s2Title')}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('welcome.saccos.s2Desc')}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">badge</span>
            <h3 className="font-bold text-base text-on-surface">{t('welcome.saccos.s3Title')}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('welcome.saccos.s3Desc')}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 space-y-3">
            <span className="material-symbols-outlined text-2xl text-primary">gavel</span>
            <h3 className="font-bold text-base text-on-surface">{t('welcome.saccos.s4Title')}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('welcome.saccos.s4Desc')}
            </p>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <h4 className="font-bold text-lg text-on-surface">{t('welcome.saccos.ctaTitle')}</h4>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              {t('welcome.saccos.ctaDesc')}
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate('/auth/login')}>
            {t('welcome.saccos.goToPortal')}
            <span className="material-symbols-outlined text-lg ml-1">login</span>
          </Button>
        </div>
      </section>

      {/* SECTION 6: TRUST & PRIVACY */}
      <section className="py-12 sm:py-16 bg-surface-container-lowest border-y border-outline-variant/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-2xl">lock</span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider">{t('welcome.privacy.tag')}</span>
          </div>

          <h3 className="font-display font-bold text-xl sm:text-2xl text-on-surface">
            {t('welcome.privacy.title')}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left pt-2">
            <div className="space-y-1">
              <span className="font-bold text-xs text-on-surface block">🔒 {t('welcome.privacy.p1Title')}</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                {t('welcome.privacy.p1Desc')}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-xs text-on-surface block">🛡️ {t('welcome.privacy.p2Title')}</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                {t('welcome.privacy.p2Desc')}
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-xs text-on-surface block">👥 {t('welcome.privacy.p3Title')}</span>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                {t('welcome.privacy.p3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: FINAL CTA */}
      <section className="py-16 sm:py-20 max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-on-surface tracking-tight">
          {t('welcome.finalCta.title')}
        </h2>
        <p className="text-on-surface-variant text-sm sm:text-base font-body max-w-2xl mx-auto leading-relaxed">
          {t('welcome.finalCta.subtitle')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button variant="primary" size="lg" onClick={() => navigate('/location-permission')}>
            {t('welcome.finalCta.startJourney')}
            <span className="material-symbols-outlined text-lg ml-1">arrow_forward</span>
          </Button>

          <Button variant="outline" size="lg" onClick={() => scrollToSection('how-it-works')}>
            {t('welcome.finalCta.learnHow')}
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
                {t('welcome.footer.tagline')}
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface block uppercase font-mono tracking-wider">{t('welcome.footer.product')}</span>
              <ul className="space-y-1.5 text-on-surface-variant">
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-primary">{t('welcome.footer.howItWorks')}</button></li>
                <li><button onClick={() => navigate('/location-permission')} className="hover:text-primary">{t('welcome.footer.passengerSafety')}</button></li>
                <li><button onClick={() => navigate('/safety-map')} className="hover:text-primary">{t('welcome.footer.hazardMap')}</button></li>
                <li><button onClick={() => navigate('/auth/login')} className="hover:text-primary">{t('welcome.footer.saccoPortal')}</button></li>
              </ul>
            </div>

            {/* Col 3: Community & Safety */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface block uppercase font-mono tracking-wider">{t('welcome.footer.safetyImpact')}</span>
              <ul className="space-y-1.5 text-on-surface-variant">
                <li><button onClick={() => navigate('/safety-map')} className="hover:text-primary">{t('welcome.footer.blackSpotReports')}</button></li>
                <li><button onClick={() => scrollToSection('about')} className="hover:text-primary">{t('welcome.footer.safetyIntelligence')}</button></li>
                <li><button onClick={() => navigate('/auth/login')} className="hover:text-primary">{t('welcome.footer.inspectorPortal')}</button></li>
              </ul>
            </div>

            {/* Col 4: Legal & Contact */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-on-surface block uppercase font-mono tracking-wider">{t('welcome.footer.legalSupport')}</span>
              <ul className="space-y-1.5 text-on-surface-variant">
                <li><span className="text-on-surface-variant/80">{t('welcome.footer.privacyPolicy')}</span></li>
                <li><span className="text-on-surface-variant/80">{t('welcome.footer.termsOfService')}</span></li>
                <li><span className="text-on-surface-variant/80">{t('welcome.footer.dataProtection')}</span></li>
                <li><span className="text-on-surface-variant/80">{t('welcome.footer.emergencyContact')}</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-on-surface-variant">
            <span>© 2026 Mwendo Salama. {t('welcome.footer.allRightsReserved')}</span>

            <div className="flex items-center gap-3">
              <LanguageToggle />
              <button
                onClick={toggleDarkMode}
                className="p-1 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer"
                title="Toggle Theme"
              >
                <span className="material-symbols-outlined text-sm">
                  {mode === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
