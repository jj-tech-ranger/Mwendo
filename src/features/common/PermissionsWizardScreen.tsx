import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS, PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';

type PermissionStep = 'location' | 'notification' | 'sms' | 'camera' | 'storage';

// Permission Steps Vector Illustrations
const LocationIllustration: React.FC = () => (
  <svg viewBox="0 0 320 240" className="w-full h-full max-h-56 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="160" cy="120" r="100" stroke="#1b4d2e" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-30" />
    <circle cx="160" cy="120" r="70" stroke="#1b4d2e" strokeWidth="2" className="opacity-40" />
    <circle cx="160" cy="120" r="40" fill="#1b4d2e" fillOpacity="0.08" stroke="#1b4d2e" strokeWidth="2" className="animate-pulse" />
    
    {/* Grid / Corridor Line */}
    <path d="M 40 180 Q 120 160 160 120 T 280 60" stroke="#1b4d2e" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 6" />
    <path d="M 40 180 Q 120 160 160 120 T 280 60" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

    {/* Vehicle Beacon at Center */}
    <g transform="translate(160, 120)">
      <circle cx="0" cy="0" r="22" fill="#1b4d2e" />
      <circle cx="0" cy="0" r="28" stroke="#10b981" strokeWidth="2" className="animate-ping opacity-75" />
      <path d="M -8 -8 L 8 0 L -8 8 L -4 0 Z" fill="#ffffff" transform="rotate(-35)" />
    </g>

    {/* HUD Stats Overlay */}
    <g transform="translate(30, 30)">
      <rect width="105" height="34" rx="8" fill="#ffffff" fillOpacity="0.9" stroke="#1b4d2e" strokeWidth="1" />
      <circle cx="14" cy="17" r="4" fill="#10b981" />
      <text x="24" y="16" fontFamily="monospace" fontSize="9" fontWeight="bold" fill="#1b4d2e">GPS: LOCK</text>
      <text x="24" y="27" fontFamily="monospace" fontSize="9" fill="#555555">ACC: &lt; 5m</text>
    </g>
    <g transform="translate(195, 175)">
      <rect width="95" height="34" rx="8" fill="#ffffff" fillOpacity="0.9" stroke="#1b4d2e" strokeWidth="1" />
      <text x="12" y="16" fontFamily="monospace" fontSize="9" fontWeight="bold" fill="#1b4d2e">SPEED: 74 KM/H</text>
      <text x="12" y="27" fontFamily="monospace" fontSize="9" fill="#10b981">SAFE CORRIDOR</text>
    </g>
  </svg>
);

const NotificationIllustration: React.FC = () => (
  <svg viewBox="0 0 320 240" className="w-full h-full max-h-56 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Sound Waves */}
    <circle cx="160" cy="115" r="85" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 5" className="opacity-40 animate-pulse" />
    <circle cx="160" cy="115" r="60" stroke="#f59e0b" strokeWidth="2" className="opacity-60" />

    {/* Speed Sign Backdrop */}
    <g transform="translate(160, 115)">
      <circle cx="0" cy="0" r="44" fill="#ffffff" stroke="#dc2626" strokeWidth="8" />
      <text x="0" y="12" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="34" fill="#111827">80</text>
      <text x="0" y="24" textAnchor="middle" fontFamily="monospace" fontSize="8" fontWeight="bold" fill="#6b7280">KM/H</text>
    </g>

    {/* Floating Notification Cards */}
    <g transform="translate(35, 160)">
      <rect width="250" height="42" rx="10" fill="#ffffff" fillOpacity="0.95" stroke="#1b4d2e" strokeWidth="1.5" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))" />
      <circle cx="22" cy="21" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
      <path d="M 22 15 L 22 21 M 22 24 L 22.01 24" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
      <text x="40" y="18" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="bold" fill="#1f2937">Overspeed Warning</text>
      <text x="40" y="32" fontFamily="system-ui, sans-serif" fontSize="9" fill="#6b7280">Matatu exceeding 80 km/h limit on corridor</text>
    </g>
  </svg>
);

const SmsIllustration: React.FC = () => (
  <svg viewBox="0 0 320 240" className="w-full h-full max-h-56 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Broadcast Radio Waves */}
    <path d="M 120 70 A 60 60 0 0 1 200 70" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" className="opacity-70 animate-pulse" />
    <path d="M 100 50 A 85 85 0 0 1 220 50" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" className="opacity-40 animate-ping" />

    {/* SOS Tower / Shield */}
    <g transform="translate(160, 110)">
      <path d="M 0 -35 L 32 -18 L 32 20 C 32 38 0 52 0 52 C 0 52 -32 38 -32 20 L -32 -18 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
      <text x="0" y="14" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="18" fill="#ffffff">SOS</text>
    </g>

    {/* Dispatch Details Badge */}
    <g transform="translate(45, 175)">
      <rect width="230" height="38" rx="8" fill="#ffffff" fillOpacity="0.95" stroke="#dc2626" strokeWidth="1" />
      <text x="14" y="16" fontFamily="monospace" fontSize="10" fontWeight="bold" fill="#dc2626">DISPATCH: 112 / 999 READY</text>
      <text x="14" y="28" fontFamily="monospace" fontSize="8.5" fill="#4b5563">Live GPS coordinates appended to SMS</text>
    </g>
  </svg>
);

const CameraIllustration: React.FC = () => (
  <svg viewBox="0 0 320 240" className="w-full h-full max-h-56 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Viewfinder Reticle */}
    <rect x="50" y="30" width="220" height="150" rx="14" fill="#1b4d2e" fillOpacity="0.05" stroke="#1b4d2e" strokeWidth="2" strokeDasharray="8 6" />
    
    {/* Corner Brackets */}
    <path d="M 40 50 L 40 30 L 60 30" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
    <path d="M 280 50 L 280 30 L 260 30" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
    <path d="M 40 160 L 40 180 L 60 180" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
    <path d="M 280 160 L 280 180 L 260 180" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

    {/* Camera Lens */}
    <circle cx="160" cy="105" r="42" fill="#ffffff" stroke="#1b4d2e" strokeWidth="3" />
    <circle cx="160" cy="105" r="28" fill="#1b4d2e" fillOpacity="0.1" stroke="#10b981" strokeWidth="2" />
    <circle cx="160" cy="105" r="14" fill="#1b4d2e" />
    <circle cx="154" cy="99" r="4" fill="#ffffff" />

    {/* Evidence Tag */}
    <g transform="translate(60, 192)">
      <rect width="200" height="28" rx="6" fill="#1b4d2e" />
      <text x="100" y="18" textAnchor="middle" fontFamily="monospace" fontSize="9.5" fontWeight="bold" fill="#ffffff">EVIDENCE PHOTO VERIFIED</text>
    </g>
  </svg>
);

const StorageIllustration: React.FC = () => (
  <svg viewBox="0 0 320 240" className="w-full h-full max-h-56 select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Storage Disk Rings */}
    <ellipse cx="160" cy="70" rx="70" ry="22" fill="#e2e8f0" stroke="#1b4d2e" strokeWidth="2.5" />
    <path d="M 90 70 V 100 C 90 112 121 122 160 122 C 199 122 230 112 230 100 V 70" fill="#f1f5f9" stroke="#1b4d2e" strokeWidth="2.5" />
    <path d="M 90 100 V 130 C 90 142 121 152 160 152 C 199 152 230 142 230 130 V 100" fill="#ffffff" stroke="#1b4d2e" strokeWidth="2.5" />

    {/* Synced Check Icon */}
    <g transform="translate(160, 130)">
      <circle cx="0" cy="0" r="20" fill="#10b981" stroke="#ffffff" strokeWidth="3" />
      <path d="M -7 0 L -2 5 L 8 -5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    {/* Offline Cache Status */}
    <g transform="translate(55, 175)">
      <rect width="210" height="34" rx="8" fill="#ffffff" stroke="#1b4d2e" strokeWidth="1" />
      <circle cx="16" cy="17" r="4" fill="#10b981" />
      <text x="28" y="16" fontFamily="monospace" fontSize="9.5" fontWeight="bold" fill="#1b4d2e">OFFLINE LOCAL VAULT</text>
      <text x="28" y="27" fontFamily="monospace" fontSize="8.5" fill="#6b7280">Trips cached when signal drops</text>
    </g>
  </svg>
);

export const PermissionsWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [grantedStatus, setGrantedStatus] = useState<Record<PermissionStep, boolean>>({
    location: false,
    notification: false,
    sms: false,
    camera: false,
    storage: false,
  });

  const steps: Array<{
    id: PermissionStep;
    icon: string;
    title: string;
    body: string;
    primaryCta: string;
    requestFn: () => Promise<boolean>;
  }> = [
    {
      id: 'location',
      icon: 'my_location',
      title: 'Mwendo Salama needs your location',
      body: 'Powers live speed tracking, GPS smoothing, and black-spot warnings on your corridor. We never share your location publicly.',
      primaryCta: 'Allow Location Access',
      requestFn: () =>
        new Promise((resolve) => {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              () => resolve(true),
              () => resolve(false)
            );
          } else {
            resolve(false);
          }
        }),
    },
    {
      id: 'notification',
      icon: 'notifications_active',
      title: 'Stay alert on the road',
      body: 'Receive overspeed warnings when your matatu exceeds speed limits, nearby danger-zone alerts, and weekly safety digests.',
      primaryCta: 'Enable Notifications',
      requestFn: async () => {
        if ('Notification' in window) {
          const perm = await Notification.requestPermission();
          return perm === 'granted';
        }
        return false;
      },
    },
    {
      id: 'sms',
      icon: 'sms',
      title: 'Enable Emergency SMS',
      body: 'Lets Mwendo Salama send an instant SOS text with your live GPS location to emergency contacts if you trigger a safety alert.',
      primaryCta: 'Allow Emergency SMS Access',
      requestFn: async () => true, // Browser fallback handles sms: deep link
    },
    {
      id: 'camera',
      icon: 'photo_camera',
      title: 'Add photo evidence to reports',
      body: 'Allows taking or uploading photos when reporting black spots or road hazards to help transport authorities verify incidents quickly.',
      primaryCta: 'Allow Camera Access',
      requestFn: async () => {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach((track) => track.stop());
            return true;
          }
        } catch {
          return false;
        }
        return false;
      },
    },
    {
      id: 'storage',
      icon: 'folder_zip',
      title: 'Save trips for offline access',
      body: 'Saves your journey history and safety reports locally on your device so the app functions seamlessly in low-signal areas.',
      primaryCta: 'Allow Storage Access',
      requestFn: async () => {
        try {
          localStorage.setItem('storage_perm_test', 'ok');
          localStorage.removeItem('storage_perm_test');
          return true;
        } catch {
          return false;
        }
      },
    },
  ];

  const current = steps[activeStepIndex]!;

  const handleNext = async () => {
    try {
      const isGranted = await current.requestFn();
      setGrantedStatus((prev) => ({ ...prev, [current.id]: isGranted }));
    } catch (err) {
      console.warn('Permission request error:', err);
    }

    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex((i) => i + 1);
    } else {
      if (!useAuthStore.getState().isAuthenticated) {
        try {
          await authService.signInGuest();
        } catch (e) {
          console.warn('Guest signin error:', e);
        }
      }
      navigate('/passenger');
    }
  };

  const handleSkip = async () => {
    if (activeStepIndex < steps.length - 1) {
      setActiveStepIndex((i) => i + 1);
    } else {
      if (!useAuthStore.getState().isAuthenticated) {
        try {
          await authService.signInGuest();
        } catch (e) {
          console.warn('Guest signin error:', e);
        }
      }
      navigate('/passenger');
    }
  };

  const handleSkipAll = async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      try {
        await authService.signInGuest();
      } catch (e) {
        console.warn('Guest signin error:', e);
      }
    }
    navigate('/passenger');
  };

  return (
    <div className="h-screen w-screen bg-surface text-on-surface flex flex-col font-body-md overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-margin-mobile py-4 bg-transparent">
        <PrimaryLogo className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <span className="font-label-mono text-xs text-on-surface-variant uppercase">
            Step {activeStepIndex + 1} of 5
          </span>
          <button
            onClick={handleSkipAll}
            className="text-xs font-bold text-primary hover:underline px-2 py-1 cursor-pointer"
          >
            Skip All
          </button>
        </div>
      </header>

      {/* Top 60% Illustration */}
      <section className="h-[60%] bg-sage-light dot-grid relative flex flex-col items-center justify-center p-md overflow-hidden">
        <div className="w-full max-w-sm h-64 bg-white/70 rounded-3xl flex items-center justify-center backdrop-blur-md border border-primary/20 shadow-sm p-4 transition-all duration-300">
          {current.id === 'location' && <LocationIllustration />}
          {current.id === 'notification' && <NotificationIllustration />}
          {current.id === 'sms' && <SmsIllustration />}
          {current.id === 'camera' && <CameraIllustration />}
          {current.id === 'storage' && <StorageIllustration />}
        </div>
      </section>

      {/* Bottom 40% Sheet */}
      <section className="h-[40%] bg-surface rounded-t-[32px] -mt-8 z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] flex flex-col px-margin-mobile pt-lg pb-margin-mobile text-center justify-between">
        <div className="space-y-2">
          <h1 className="font-headline-lg-mobile sm:font-headline-lg text-on-surface">
            {current.title}
          </h1>
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            {current.body}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <Button variant="primary" className="w-full" onClick={handleNext}>
            <span className="material-symbols-outlined text-lg mr-2">{current.icon}</span>
            {current.primaryCta}
          </Button>
          <Button variant="ghost" className="w-full text-xs text-on-surface-variant" onClick={handleSkip}>
            Skip for Now
          </Button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center items-center gap-1.5 pt-1">
          {steps.map((s, idx) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === activeStepIndex
                  ? 'w-6 bg-primary'
                  : grantedStatus[s.id]
                  ? 'w-2 bg-emerald-500'
                  : 'w-2 bg-outline-variant'
              }`}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
