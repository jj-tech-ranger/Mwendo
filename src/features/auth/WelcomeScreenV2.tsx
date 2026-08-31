import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HorizontalLogo, ShieldSpeedometerMark } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { LanguageToggle } from '../../components/common/LanguageToggle';
import { useThemeStore } from '../../store/useThemeStore';

const trustItems: Array<[icon: string, key: string]> = [
  ['check_circle', 'welcome.hero.trustTripSafety'],
  ['speed', 'welcome.hero.trustSpeedAwareness'],
  ['report', 'welcome.hero.trustHazardReporting'],
];

const howItWorksItems: Array<[number: string, icon: string, title: string, desc: string]> = [
  ['01', 'location_on', 'welcome.howItWorks.step1Title', 'welcome.howItWorks.step1Desc'],
  ['02', 'speed', 'welcome.howItWorks.step2Title', 'welcome.howItWorks.step2Desc'],
  ['03', 'shield', 'welcome.howItWorks.step3Title', 'welcome.howItWorks.step3Desc'],
];

const HeroPhotoShowcase: React.FC = () => (
  <div className="relative h-[440px] overflow-hidden rounded-[32px] border border-outline-variant/30 bg-surface-container-high shadow-2xl sm:h-[520px]">
    {/* High-Resolution Transit Photo */}
    <img
      src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80"
      alt="Modern Kenyan passenger transport highway"
      referrerPolicy="no-referrer"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
    
    {/* Dark Forest Overlay for Maximum Legibility & Brand Consistency */}
    <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/60 to-black/35" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.15),transparent_60%)]" />

    {/* Top Badges */}
    <div className="absolute left-5 right-5 top-5 flex items-center justify-between gap-3 sm:left-6 sm:right-6 sm:top-6">
      <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/40 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-md">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
        <span>Live Safety Network Active</span>
      </div>
      <div className="hidden items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-md sm:flex">
        <span className="material-symbols-outlined text-sm text-emerald-300">verified</span>
        <span>SACCO Monitored</span>
      </div>
    </div>

    {/* Center Floating Telemetry Card */}
    <div className="absolute left-5 right-5 top-20 sm:left-8 sm:right-8 sm:top-24">
      <div className="rounded-2xl border border-white/20 bg-slate-950/70 p-4 text-white shadow-xl backdrop-blur-md sm:p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
              <span className="material-symbols-outlined text-xl">directions_bus</span>
            </span>
            <div>
              <p className="text-xs font-extrabold text-white">KBZ 819M · 2N SACCO</p>
              <p className="text-[10px] text-white/70">Nairobi ➔ Nakuru Expressway</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-extrabold text-emerald-300">
            NORMAL
          </span>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Speed</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">74</span>
              <span className="text-[10px] text-white/60">/ 80 km/h</span>
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Status</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
              <span className="text-xs font-bold text-white">Safe Journey</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom Footer Info */}
    <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white sm:bottom-6 sm:left-6 sm:right-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">Mwendo Salama</p>
        <p className="mt-0.5 text-sm font-semibold text-white/95">Protecting every kilometer across Kenya.</p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
        <span className="material-symbols-outlined text-sm text-emerald-300">location_on</span>
        <span className="hidden sm:inline">GPS & Sensor Verified</span>
      </div>
    </div>
  </div>
);

export const WelcomeScreenV2: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mode, toggleDarkMode } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-on-surface">
      <header className="sticky top-0 z-50 border-b border-outline-variant/20 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Mwendo Salama home"><HorizontalLogo className="h-8 sm:h-9" /></button>
          <nav className="hidden items-center gap-7 md:flex">
            <button onClick={() => scrollTo('how-it-works')} className="text-xs font-bold text-on-surface-variant transition hover:text-primary">{t('welcome.nav.howItWorks')}</button>
            <button onClick={() => scrollTo('safety')} className="text-xs font-bold text-on-surface-variant transition hover:text-primary">{t('welcome.nav.passengerSafety')}</button>
            <button onClick={() => scrollTo('saccos')} className="text-xs font-bold text-on-surface-variant transition hover:text-primary">{t('welcome.nav.forSaccos')}</button>
            <button onClick={() => scrollTo('about')} className="text-xs font-bold text-on-surface-variant transition hover:text-primary">{t('welcome.nav.about')}</button>
          </nav>
          <div className="hidden items-center gap-2 md:flex"><LanguageToggle /><button onClick={toggleDarkMode} aria-label="Toggle theme" className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface-variant transition hover:bg-surface-container"><span className="material-symbols-outlined text-lg">{mode === 'dark' ? 'light_mode' : 'dark_mode'}</span></button><Button variant="outline" size="sm" onClick={() => navigate('/auth/login')}>{t('welcome.nav.logIn')}</Button><Button variant="primary" size="sm" onClick={() => navigate('/location-permission')}>{t('welcome.nav.getStarted')}</Button></div>
          <div className="flex items-center gap-2 md:hidden"><LanguageToggle /><button onClick={toggleDarkMode} aria-label="Toggle theme" className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/40"><span className="material-symbols-outlined text-lg">{mode === 'dark' ? 'light_mode' : 'dark_mode'}</span></button><button onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation" className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant/40"><span className="material-symbols-outlined text-xl">{menuOpen ? 'close' : 'menu'}</span></button></div>
        </div>
        {menuOpen && <div className="border-t border-outline-variant/20 bg-surface px-4 py-4 md:hidden"><div className="mx-auto max-w-7xl space-y-1"><button onClick={() => scrollTo('how-it-works')} className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-surface-container">{t('welcome.nav.howItWorks')}</button><button onClick={() => scrollTo('safety')} className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-surface-container">{t('welcome.nav.passengerSafety')}</button><button onClick={() => scrollTo('saccos')} className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-surface-container">{t('welcome.nav.forSaccos')}</button><button onClick={() => scrollTo('about')} className="w-full rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-surface-container">{t('welcome.nav.about')}</button><div className="grid grid-cols-2 gap-2 border-t border-outline-variant/20 pt-3"><Button variant="outline" className="w-full" onClick={() => navigate('/auth/login')}>{t('welcome.nav.logIn')}</Button><Button variant="primary" className="w-full" onClick={() => navigate('/location-permission')}>{t('welcome.nav.startSafeTrip')}</Button></div></div></div>}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-outline-variant/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(26,92,46,.13),transparent_30%),linear-gradient(to_bottom,var(--color-surface),var(--color-surface-container-lowest))]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="max-w-2xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><span className="material-symbols-outlined text-base">shield</span>{t('welcome.hero.badge')}</div><h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-.035em] sm:text-5xl lg:text-6xl">{t('welcome.hero.title')} <span className="text-primary">Mwendo Salama</span>.</h1><p className="mt-6 max-w-xl text-base leading-7 text-on-surface-variant sm:text-lg">{t('welcome.hero.description')}</p><div className="mt-8 flex flex-wrap gap-3"><Button variant="primary" size="lg" onClick={() => navigate('/location-permission')} className="rounded-2xl px-6 shadow-lg shadow-primary/15"><span>{t('welcome.hero.startSafeTrip')}</span><span className="material-symbols-outlined ml-1 text-lg">arrow_forward</span></Button><Button variant="outline" size="lg" onClick={() => navigate('/safety-map')} className="rounded-2xl px-6"><span className="material-symbols-outlined mr-1 text-lg text-primary">map</span>{t('welcome.hero.exploreSafetyMap')}</Button></div><div className="mt-9 grid max-w-xl grid-cols-1 gap-3 border-t border-outline-variant/25 pt-6 sm:grid-cols-3">{trustItems.map(([icon, key]) => <div key={key} className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant"><span className="material-symbols-outlined text-base text-primary">{icon}</span>{t(key)}</div>)}</div></div>
            <HeroPhotoShowcase />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-b border-outline-variant/20 bg-surface-container-lowest py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">{t('welcome.howItWorks.tag')}</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{t('welcome.howItWorks.title')}</h2><p className="mt-4 text-sm leading-6 text-on-surface-variant sm:text-base">{t('welcome.howItWorks.subtitle')}</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{howItWorksItems.map(([number, icon, title, desc]) => <article key={number} className="group rounded-[28px] border border-outline-variant/25 bg-surface p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-xl"><div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[.18em] text-primary">{number}</span><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105"><span className="material-symbols-outlined text-2xl">{icon}</span></span></div><h3 className="mt-8 text-lg font-bold">{t(title)}</h3><p className="mt-3 text-sm leading-6 text-on-surface-variant">{t(desc)}</p></article>)}</div></div></section>

        <section id="safety" className="scroll-mt-20 border-b border-outline-variant/20 bg-surface py-20 sm:py-24"><div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8"><div className="relative overflow-hidden rounded-[32px] bg-surface-container-low p-7 sm:p-10"><div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" /><div className="relative"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Passenger safety</p><h3 className="mt-2 text-2xl font-extrabold">See the journey as it happens.</h3></div><ShieldSpeedometerMark className="h-12 w-12" /></div><div className="mt-8 rounded-3xl border border-outline-variant/25 bg-surface p-5 shadow-lg"><div className="flex items-center justify-between text-xs font-bold"><span className="text-on-surface-variant">Live speed</span><span className="text-primary">Within limit</span></div><div className="mt-5 flex items-end justify-between"><div><span className="text-5xl font-extrabold tracking-tight">72</span><span className="ml-2 text-xs text-on-surface-variant">km/h</span></div><div className="text-right text-[10px] text-on-surface-variant">SPEED LIMIT<br/><strong className="text-on-surface">80 km/h</strong></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full w-[85%] rounded-full bg-primary" /></div><div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-500/10 p-3.5"><span className="material-symbols-outlined text-amber-600">warning</span><div><p className="text-xs font-bold">Road alert nearby</p><p className="mt-1 text-[11px] text-on-surface-variant">Stay aware and review reported hazards ahead.</p></div></div></div></div></div><div className="max-w-xl"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Safety, not noise</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Know what is happening on the road.</h2><p className="mt-5 text-sm leading-7 text-on-surface-variant sm:text-base">Mwendo Salama turns a normal PSV trip into a clearer safety experience—with live speed awareness, road-risk visibility, hazard reporting and emergency support.</p><div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-outline-variant/20 p-4"><span className="material-symbols-outlined text-primary">speed</span><p className="mt-3 text-sm font-bold">Live speed awareness</p></div><div className="rounded-2xl border border-outline-variant/20 p-4"><span className="material-symbols-outlined text-primary">warning</span><p className="mt-3 text-sm font-bold">Community hazard reports</p></div><div className="rounded-2xl border border-outline-variant/20 p-4"><span className="material-symbols-outlined text-primary">emergency</span><p className="mt-3 text-sm font-bold">Emergency support</p></div><div className="rounded-2xl border border-outline-variant/20 p-4"><span className="material-symbols-outlined text-primary">analytics</span><p className="mt-3 text-sm font-bold">Trip safety insights</p></div></div></div></div></section>

        <section id="saccos" className="scroll-mt-20 border-b border-outline-variant/20 bg-surface-container-lowest py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="rounded-[36px] bg-primary p-7 text-on-primary shadow-2xl sm:p-10 lg:p-14"><div className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-on-primary/60">For SACCOs & safety teams</p><h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Turn passenger journeys into actionable safety intelligence.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-on-primary/70">Give fleet teams a clearer view of trips, violations, hazards and safety trends—without losing sight of the people travelling in those vehicles.</p><div className="mt-7"><Button variant="outline" onClick={() => navigate('/auth/login')} className="border-white/25 bg-white/10 text-white hover:bg-white/15">{t('welcome.nav.logIn')} <span className="material-symbols-outlined ml-1">arrow_forward</span></Button></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-3xl border border-white/10 bg-white/10 p-5"><span className="text-3xl font-extrabold">Live</span><p className="mt-2 text-xs text-on-primary/65">trip visibility</p></div><div className="rounded-3xl border border-white/10 bg-white/10 p-5"><span className="text-3xl font-extrabold">Risk</span><p className="mt-2 text-xs text-on-primary/65">trend awareness</p></div><div className="rounded-3xl border border-white/10 bg-white/10 p-5"><span className="text-3xl font-extrabold">Data</span><p className="mt-2 text-xs text-on-primary/65">ground truth</p></div><div className="rounded-3xl border border-white/10 bg-white/10 p-5"><span className="text-3xl font-extrabold">Kenya</span><p className="mt-2 text-xs text-on-primary/65">built for local roads</p></div></div></div></div></div></section>

        <section id="about" className="scroll-mt-20 py-20 sm:py-24"><div className="mx-auto max-w-3xl px-4 text-center sm:px-6"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Mwendo Salama</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Safer journeys start with better visibility.</h2><p className="mt-5 text-sm leading-7 text-on-surface-variant sm:text-base">Built around Kenya's public transport reality, Mwendo Salama connects passengers, SACCOs and safety authorities around a shared picture of road risk.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button variant="primary" size="lg" onClick={() => navigate('/location-permission')} className="rounded-2xl">{t('welcome.hero.startSafeTrip')} <span className="material-symbols-outlined ml-1">arrow_forward</span></Button><Button variant="outline" size="lg" onClick={() => navigate('/safety-map')} className="rounded-2xl">{t('welcome.hero.exploreSafetyMap')}</Button></div></div></section>
      </main>

      <footer className="border-t border-outline-variant/20 bg-surface-container-lowest"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-on-surface-variant sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8"><HorizontalLogo className="h-7" /><p>© {new Date().getFullYear()} Mwendo Salama · Safer public transport across Kenya.</p><div className="flex gap-4"><button onClick={() => navigate('/auth/login')} className="font-bold hover:text-primary">{t('welcome.nav.logIn')}</button><button onClick={() => navigate('/location-permission')} className="font-bold hover:text-primary">{t('welcome.nav.getStarted')}</button></div></div></footer>
    </div>
  );
};
