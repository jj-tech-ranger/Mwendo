import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS, PrimaryLogo } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';

export const LocationPermissionPromptScreen: React.FC = () => {
  const navigate = useNavigate();

  const handleAllow = async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      try {
        await authService.signInGuest();
      } catch (e) {
        console.warn('Guest signin error:', e);
      }
    }
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => navigate('/passenger'),
        () => navigate('/passenger')
      );
    } else {
      navigate('/passenger');
    }
  };

  const handleNotNow = async () => {
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
    <div className="h-screen w-screen bg-background text-on-background flex flex-col font-body-md overflow-hidden">
      {/* Upper 60% */}
      <section className="h-[60%] bg-sage-light dot-grid relative flex flex-col items-center justify-center p-md overflow-hidden">
        <div className="absolute top-4 left-4">
          <PrimaryLogo className="h-8 w-auto" />
        </div>
        <div className="w-64 h-64 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary/10">
          <span className="material-symbols-outlined text-6xl text-primary">location_on</span>
        </div>
      </section>

      {/* Lower 40% */}
      <section className="h-[40%] bg-surface rounded-t-[32px] -mt-8 z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] flex flex-col px-margin-mobile pt-lg pb-margin-mobile text-center justify-between">
        <div className="space-y-2">
          <h1 className="font-headline-lg-mobile sm:font-headline-lg text-on-surface">
            Mwendo Salama needs your location
          </h1>
          <p className="font-body-md text-on-surface-variant leading-relaxed">
            This powers live speed tracking and black-spot alerts on your journey. We never share your location publicly—it’s strictly to keep you and your fellow passengers safe.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <Button variant="primary" className="w-full" onClick={handleAllow}>
            <span className="material-symbols-outlined text-lg mr-2">location_on</span>
            Allow Location Access
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleNotNow}>
            Not Now
          </Button>
        </div>

        <div className="border-t border-outline-variant/30 pt-2 flex items-center justify-center gap-1.5 text-[10px] font-label-mono text-outline uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          <span>Encrypted & Private</span>
        </div>
      </section>
    </div>
  );
};
