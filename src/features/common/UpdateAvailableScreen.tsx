import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { usePwaStore } from '../../store/usePwaStore';

export const UpdateAvailableScreen: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const navigate = useNavigate();
  const applyUpdate = usePwaStore((s) => s.applyUpdate);
  const setUpdateAvailable = usePwaStore((s) => s.setUpdateAvailable);

  const handleUpdate = () => {
    applyUpdate();
  };

  const handleLater = () => {
    setUpdateAvailable(false);
    if (onDismiss) {
      onDismiss();
    } else {
      navigate('/passenger');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-background/40 backdrop-blur-xs p-margin-mobile">
      <div className="bg-surface-bright w-full max-w-sm rounded-2xl p-lg text-center shadow-2xl space-y-md border border-outline-variant/30">
        <img src={BRAND_ASSETS.appIcon} alt="App Icon" className="w-12 h-12 rounded-xl mx-auto shadow-sm" />
        <div className="w-16 h-16 rounded-full bg-secondary-container/30 mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-secondary">rocket_launch</span>
        </div>
        <h2 className="font-headline-lg-mobile text-primary">A safer ride is ready</h2>
        <p className="font-body-md text-on-surface-variant leading-relaxed">
          We've improved GPS accuracy and added new black-spot alerts to keep your journey secure.
        </p>

        <div className="space-y-2 pt-2">
          <Button variant="primary" className="w-full" onClick={handleUpdate}>
            Update Now
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleLater}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
};
