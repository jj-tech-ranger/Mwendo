import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS, PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';

type PermissionStep = 'location' | 'notification' | 'sms' | 'camera' | 'storage';

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
      body: 'Buffers telemetry, offline trip logs, and black-spot reports locally in IndexedDB so the app functions seamlessly in low-signal areas.',
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
        <div className="w-56 h-56 bg-white/40 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary/20 shadow-inner">
          <span className="material-symbols-outlined text-7xl text-primary animate-pulse">
            {current.icon}
          </span>
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
