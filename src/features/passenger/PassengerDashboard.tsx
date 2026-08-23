import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BrandMark } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { useTripStore } from '../../store/useTripStore';

export const PassengerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const startTrip = useTripStore((s) => s.startTrip);
  const activeTrip = useTripStore((s) => s.activeTrip);

  const isGuestMode = !!user?.isAnonymous;
  const [plateNumber, setPlateNumber] = useState('');
  const [sacco, setSacco] = useState('');
  const [route, setRoute] = useState('');

  const handleStartTrip = async () => {
    if (!plateNumber.trim()) return;
    const cleanPlate = plateNumber.trim().toUpperCase();
    const vehicleDocId = cleanPlate.replace(/\s+/g, '_');

    let resolvedSaccoId = 'unassigned';
    let resolvedSaccoName = sacco || 'Independent / Unassigned';

    try {
      const vehicleDoc = await getDoc(doc(db, 'vehicles', vehicleDocId));
      if (vehicleDoc.exists()) {
        const vData = vehicleDoc.data();
        if (vData.saccoId) resolvedSaccoId = vData.saccoId;
        if (vData.saccoName) resolvedSaccoName = vData.saccoName;
      }
    } catch (err) {
      console.warn('[PassengerDashboard] Vehicle lookup failed or restricted, falling back to provisional:', err);
    }

    startTrip({
      plateNumber: cleanPlate,
      saccoId: resolvedSaccoId,
      saccoName: resolvedSaccoName,
      routeName: route || 'Standard Route',
    });
    navigate('/passenger/start-trip');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <BrandMark className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-on-surface">
              {isGuestMode
                ? t('passenger.dashboard.welcomeGuest')
                : t('passenger.dashboard.welcomePassenger', { name: user?.displayName || 'Passenger' })}
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">
              {isGuestMode
                ? t('passenger.dashboard.civicMonitor')
                : t('passenger.dashboard.passengerApp')}
            </p>
          </div>
        </div>

        {isGuestMode ? (
          <Button size="sm" variant="outline" onClick={() => navigate('/auth/register')}>
            {t('passenger.dashboard.signUp')}
          </Button>
        ) : (
          <button
            onClick={() => navigate('/passenger/alerts')}
            className="relative p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-2xl">notifications</span>
          </button>
        )}
      </div>

      {/* Guest Mode Banner */}
      {isGuestMode && (
        <Card className="bg-gradient-to-r from-emerald-900/10 to-teal-900/10 border border-emerald-500/20 p-4 space-y-2">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-700 text-2xl">info</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-on-surface">
                {t('passenger.dashboard.createFreeAccount')}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {t('passenger.dashboard.guestBannerDesc')}
              </p>
              <Button size="sm" className="mt-2 text-xs" onClick={() => navigate('/auth/register')}>
                {t('passenger.dashboard.signUpNow')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search & Start Trip Card */}
      <Card className="p-5 space-y-4 shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
            {t('passenger.dashboard.quickTripSetup')}
          </span>
          <Badge variant="neutral" className="text-[10px]">
            {t('passenger.dashboard.liveGpsReady')}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="psv-plate-input" className="text-xs font-bold text-on-surface mb-1 block">
              {t('passenger.dashboard.enterPsvPlate')}
            </label>
            <Input
              id="psv-plate-input"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder={t('passenger.dashboard.platePlaceholder')}
              className="font-mono text-base font-bold uppercase tracking-wider"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sacco-org-select" className="text-xs font-medium text-on-surface-variant mb-1 block">
                {t('passenger.dashboard.saccoOrg')}
              </label>
              <select
                id="sacco-org-select"
                value={sacco}
                onChange={(e) => setSacco(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">{t('passenger.dashboard.selectSacco')}</option>
                <option value="MetroLink SACCO">MetroLink SACCO</option>
                <option value="GreenLine SACCO">GreenLine SACCO</option>
                <option value="TransitStar SACCO">TransitStar SACCO</option>
                <option value="CityRide SACCO">CityRide SACCO</option>
              </select>
            </div>

            <div>
              <label htmlFor="route-corridor-select" className="text-xs font-medium text-on-surface-variant mb-1 block">
                {t('passenger.dashboard.routeCorridor')}
              </label>
              <select
                id="route-corridor-select"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-xs focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">{t('passenger.dashboard.selectRoute')}</option>
                <option value="Thika Road – Nairobi CBD">Thika Road – Nairobi CBD</option>
                <option value="Waiyaki Way – Westlands">Waiyaki Way – Westlands</option>
                <option value="Mombasa Road – Syokimau">Mombasa Road – Syokimau</option>
                <option value="Ngong Road – Karen">Ngong Road – Karen</option>
              </select>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            onClick={handleStartTrip}
            disabled={!plateNumber.trim()}
            className="w-full h-11 text-sm font-bold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">speed</span>
            {t('passenger.dashboard.startTrip')}
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/passenger/report-blackspot')}
            className="w-full h-11 text-sm font-bold flex items-center justify-center gap-2 border-warning text-warning hover:bg-warning/10"
          >
            <span className="material-symbols-outlined text-lg">warning</span>
            {t('passenger.dashboard.reportBlackSpot')}
          </Button>
        </div>

        <Button
          variant="secondary"
          onClick={() => navigate('/passenger/map')}
          className="w-full h-10 text-xs font-semibold flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">map</span>
          {t('passenger.dashboard.viewLiveMap')}
        </Button>
      </Card>

      {/* 2x2 Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Stat 1: Trips Completed */}
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">{t('passenger.dashboard.tripsTracked')}</span>
            <span className="material-symbols-outlined text-primary text-xl">directions_bus</span>
          </div>
          <div className="text-2xl font-black font-mono text-on-surface">{activeTrip ? 1 : 0}</div>
          <p className="text-[11px] text-on-surface-variant font-medium">
            {activeTrip ? t('passenger.dashboard.activeTrip') : t('passenger.dashboard.noTripsLogged')}
          </p>
        </Card>

        {/* Stat 2: Recent Alerts */}
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">{t('passenger.dashboard.recentAlerts')}</span>
            <span className="material-symbols-outlined text-warning text-xl">notifications_active</span>
          </div>
          <div className="text-2xl font-black font-mono text-on-surface">0</div>
          <p className="text-[11px] text-on-surface-variant font-medium">
            {t('passenger.dashboard.noAlerts')}
          </p>
        </Card>

        {/* Stat 3: Safety Score */}
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">{t('passenger.dashboard.safetyScore')}</span>
            <span className="material-symbols-outlined text-emerald-600 text-xl">verified_user</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-emerald-800">--</span>
            <span className="text-xs text-on-surface-variant font-mono">/100</span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium">
            {t('passenger.dashboard.noSafetyData')}
          </p>
        </Card>

        {/* Stat 4: Nearby Danger Zones */}
        <Card className="p-4 space-y-1 border-outline-variant/30 bg-surface-container-low">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-medium">{t('passenger.dashboard.dangerZones')}</span>
            <span className="material-symbols-outlined text-outline text-xl">report</span>
          </div>
          <div className="text-2xl font-black font-mono text-on-surface">0</div>
          <p className="text-[11px] text-on-surface-variant font-medium">
            {t('passenger.dashboard.noReportedSpots')}
          </p>
        </Card>
      </div>

      {/* Quick Access List */}
      <div className="space-y-2">
        <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">
          {t('passenger.dashboard.quickTools')}
        </h2>
        <div className="grid grid-cols-2 gap-2 text-xs font-medium">
          <button
            onClick={() => navigate('/passenger/sos')}
            className="flex items-center gap-2 p-3 rounded-xl bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors text-left font-bold"
          >
            <span className="material-symbols-outlined text-lg">sos</span>
            {t('passenger.dashboard.emergencySos')}
          </button>
          <button
            onClick={() => navigate('/passenger/trips')}
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-container border border-outline-variant/30 hover:bg-surface-container-high transition-colors text-left"
          >
            <span className="material-symbols-outlined text-lg">history</span>
            {t('passenger.dashboard.tripLogs')}
          </button>
        </div>
      </div>
    </div>
  );
};
