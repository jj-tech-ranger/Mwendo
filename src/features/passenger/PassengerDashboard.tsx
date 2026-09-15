import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { normalizePlate } from '../../lib/plate';
import { vehicleRepository, vehiclePublicSummaryRepository } from '../../repositories';
import { Vehicle, VehiclePublicSummary } from '../../types';
import { BrandMark } from '../../components/assets/BrandAssets';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { SosButton } from '../../components/ui/SosButton';
import { useAuthStore } from '../../store/useAuthStore';
import { useTripStore } from '../../store/useTripStore';
import { useMotionPresets } from '../../lib/motion';

const DEFAULT_SACCOS = [
  { id: 'sacco_metrolink', name: 'MetroLink SACCO' },
  { id: 'sacco_greenline', name: 'GreenLine SACCO' },
  { id: 'sacco_transitstar', name: 'TransitStar SACCO' },
  { id: 'sacco_cityride', name: 'CityRide SACCO' },
  { id: 'sacco_metro', name: 'Super Metro SACCO' },
  { id: 'sacco_2nk', name: '2NK Sacco' },
];

export const PassengerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const startTrip = useTripStore((s) => s.startTrip);
  const activeTrip = useTripStore((s) => s.activeTrip);
  const { variants } = useMotionPresets();

  const isGuestMode = !!user?.isAnonymous;
  const [plateNumber, setPlateNumber] = useState('');
  const [sacco, setSacco] = useState('');
  const [saccoId, setSaccoId] = useState('');
  const [route, setRoute] = useState('');

  // Lookup & autocomplete state
  const [isSearching, setIsSearching] = useState(false);
  const [matchedVehicle, setMatchedVehicle] = useState<Vehicle | null>(null);
  const [suggestions, setSuggestions] = useState<Vehicle[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteContainerRef.current &&
        !autocompleteContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced lookup against /vehicles
  useEffect(() => {
    const normalized = normalizePlate(plateNumber);
    if (!normalized || normalized.length < 2) {
      setMatchedVehicle(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setLookupDone(false);
      setIsSearching(false);
      return;
    }

    let isCurrent = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // 1. Check vehicle_public_summary (safe for signed-in passengers)
        let summary = await vehiclePublicSummaryRepository.findByNormalizedPlate(normalized);

        // 2. Fallback to vehicleRepository if accessible (e.g. admins or sacco managers)
        if (!summary) {
          try {
            const v = await vehicleRepository.findByNormalizedPlate(normalized);
            if (v) {
              summary = {
                id: v.id,
                vehicleId: v.id,
                regNumber: v.regNumber,
                saccoId: v.saccoId,
                saccoName: v.saccoName,
                riskTier: v.riskTier,
                riskScore: v.riskScore,
                isProvisional: v.isProvisional,
                status: v.status,
              };
            }
          } catch {
            // Expected permission denied for passengers reading /vehicles directly
          }
        }

        if (!isCurrent) return;

        if (summary) {
          const vData = {
            id: summary.id,
            regNumber: summary.regNumber,
            saccoId: summary.saccoId,
            saccoName: summary.saccoName,
            capacity: summary.capacity ?? 14,
            status: summary.status ?? 'active',
            insuranceExpiry: '',
            inspectionExpiry: '',
            riskScore: summary.riskScore,
            riskTier: summary.riskTier,
            isProvisional: summary.isProvisional,
          } as Vehicle;

          setMatchedVehicle(vData);
          setSacco(vData.saccoName || vData.saccoId);
          setSaccoId(vData.saccoId);
          setSuggestions([]);
          setShowSuggestions(false);
          setLookupDone(true);
          setIsSearching(false);
          return;
        }

        // 3. Search vehicles in public summary collection for prefix autocomplete
        let results: Array<VehiclePublicSummary | Vehicle> = await vehiclePublicSummaryRepository.searchVehicles(normalized, 5);
        if (results.length === 0) {
          try {
            results = await vehicleRepository.searchVehicles(normalized, 5);
          } catch {
            // ignore
          }
        }
        if (!isCurrent) return;

        const exactMatch = results.find(
          (v) => normalizePlate(v.regNumber) === normalized || normalizePlate(v.id) === normalized
        );

        if (exactMatch) {
          const vData = {
            id: exactMatch.id,
            regNumber: exactMatch.regNumber,
            saccoId: exactMatch.saccoId,
            saccoName: exactMatch.saccoName,
            capacity: 14,
            status: 'active',
            insuranceExpiry: '',
            inspectionExpiry: '',
            riskScore: exactMatch.riskScore,
            riskTier: exactMatch.riskTier,
            isProvisional: exactMatch.isProvisional,
          } as Vehicle;

          setMatchedVehicle(vData);
          setSacco(vData.saccoName || vData.saccoId);
          setSaccoId(vData.saccoId);
          setSuggestions([]);
          setShowSuggestions(false);
        } else {
          setMatchedVehicle(null);
          const mappedSuggestions: Vehicle[] = results.map((r) => ({
            id: r.id,
            regNumber: r.regNumber,
            saccoId: r.saccoId,
            saccoName: r.saccoName,
            capacity: 14,
            status: 'active',
            insuranceExpiry: '',
            inspectionExpiry: '',
            riskScore: r.riskScore,
            riskTier: r.riskTier,
            isProvisional: r.isProvisional,
          }));
          setSuggestions(mappedSuggestions);
          setShowSuggestions(mappedSuggestions.length > 0);
        }
        setLookupDone(true);
      } catch (err) {
        console.warn('[PassengerDashboard] Vehicle lookup failed, falling back to manual entry:', err);
        if (isCurrent) {
          setMatchedVehicle(null);
          setSuggestions([]);
          setLookupDone(true);
        }
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [plateNumber]);

  const handleSelectVehicle = (v: Vehicle) => {
    setPlateNumber(v.regNumber || v.id);
    setMatchedVehicle(v);
    setSacco(v.saccoName || v.saccoId);
    setSaccoId(v.saccoId);
    setSuggestions([]);
    setShowSuggestions(false);
    setLookupDone(true);
  };

  const handleClearMatchedVehicle = () => {
    setMatchedVehicle(null);
    setSacco('');
    setSaccoId('');
  };

  const handleStartTrip = async () => {
    const cleanPlate = normalizePlate(plateNumber);
    if (!cleanPlate) return;

    if (matchedVehicle) {
      startTrip({
        vehicleId: matchedVehicle.id,
        plateNumber: matchedVehicle.regNumber || cleanPlate,
        saccoId: matchedVehicle.saccoId,
        saccoName: matchedVehicle.saccoName || sacco || matchedVehicle.saccoId,
        routeName: route || 'Standard Route',
        isProvisional: !!matchedVehicle.isProvisional,
      });
    } else {
      // Unregistered / provisional trip: do NOT attach a bogus vehicleId!
      const effectiveSaccoId =
        saccoId ||
        DEFAULT_SACCOS.find((s) => s.name === sacco)?.id ||
        (sacco ? sacco.toLowerCase().replace(/\s+/g, '_') : 'sacco_metrolink');

      startTrip({
        plateNumber: cleanPlate,
        saccoId: effectiveSaccoId,
        saccoName: sacco || 'Independent / Unassigned',
        routeName: route || 'Standard Route',
        isProvisional: true,
      });
    }

    navigate('/passenger/start-trip');
  };

  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24"
    >
      <motion.div variants={variants.staggerItem} className="flex items-center justify-between pt-1">
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
      </motion.div>

      {isGuestMode && (
        <motion.div variants={variants.staggerItem}>
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
        </motion.div>
      )}

      <motion.div variants={variants.staggerItem}>
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-primary/10 via-surface-container-high/40 to-primary/5 border border-primary/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">shield</span>
              <h2 className="text-sm font-bold text-on-surface">Check Vehicle Before Boarding</h2>
              <Badge variant="primary" className="text-[10px] uppercase font-mono">Differentiator</Badge>
            </div>
            <p className="text-xs text-on-surface-variant max-w-md leading-relaxed">
              Look up any matatu's safety rating, SACCO standing, and risk tier before getting on board.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/passenger/lookup')}
            className="font-bold text-xs shrink-0 w-full sm:w-auto"
            id="btn-nav-vehicle-lookup"
          >
            Check Vehicle Standing →
          </Button>
        </Card>
      </motion.div>

      <motion.div variants={variants.staggerItem}>
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
            <div ref={autocompleteContainerRef} className="relative">
              <label htmlFor="psv-plate-input" className="text-xs font-bold text-on-surface mb-1 flex items-center justify-between">
                <span>{t('passenger.dashboard.enterPsvPlate')}</span>
                {isSearching && (
                  <span className="text-[10px] font-mono text-primary flex items-center gap-1">
                    <span className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Searching registry...
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  id="psv-plate-input"
                  value={plateNumber}
                  onChange={(e) => {
                    setPlateNumber(e.target.value.toUpperCase());
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0 && !matchedVehicle) setShowSuggestions(true);
                  }}
                  placeholder={t('passenger.dashboard.platePlaceholder')}
                  className="font-mono text-base font-bold uppercase tracking-wider pr-10"
                />
                {matchedVehicle ? (
                  <button
                    type="button"
                    onClick={handleClearMatchedVehicle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    title="Clear matched vehicle"
                    aria-label="Clear matched vehicle"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                ) : null}
              </div>

              {/* Autocomplete dropdown suggestions */}
              {showSuggestions && suggestions.length > 0 && !matchedVehicle && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline-variant/50 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-outline-variant/20">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant bg-surface-container font-semibold">
                    Matching Registered Vehicles
                  </div>
                  {suggestions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVehicle(v)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 flex items-center justify-between transition-colors group"
                    >
                      <div>
                        <div className="font-mono font-bold text-on-surface group-hover:text-primary">
                          {v.regNumber || v.id}
                        </div>
                        <div className="text-[11px] text-on-surface-variant">{v.saccoName || v.saccoId}</div>
                      </div>
                      <Badge variant={v.isProvisional ? 'warning' : 'success'} className="text-[9px]">
                        {v.isProvisional ? 'Provisional' : 'Verified'}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* Status Banner: Matched Registered Vehicle */}
              {matchedVehicle && (
                <div className="mt-2 flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-lg">verified</span>
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>Registered Vehicle Verified</span>
                        <Badge variant={matchedVehicle.isProvisional ? 'warning' : 'success'} className="text-[9px]">
                          {matchedVehicle.isProvisional ? 'Provisional' : 'Active'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Plate: <span className="font-mono font-bold text-on-surface">{matchedVehicle.regNumber}</span> · SACCO: <span className="font-semibold text-on-surface">{matchedVehicle.saccoName}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/passenger/lookup?plate=${normalizePlate(matchedVehicle.regNumber)}`)}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 ml-2 shrink-0"
                  >
                    Safety Standing →
                  </button>
                </div>
              )}

              {/* Status Banner: Unregistered / Provisional Vehicle */}
              {!matchedVehicle && lookupDone && normalizePlate(plateNumber).length >= 3 && !isSearching && (
                <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs">
                  <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">info</span>
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Unregistered / Provisional Vehicle</span>
                      <Badge variant="warning" className="text-[9px]">Provisional</Badge>
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                      Plate <span className="font-mono font-bold">{normalizePlate(plateNumber)}</span> is not yet registered. You can still start tracking — select your SACCO manually below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="sacco-org-select" className="text-xs font-medium text-on-surface-variant mb-1 flex items-center justify-between">
                  <span>{t('passenger.dashboard.saccoOrg')}</span>
                  {matchedVehicle && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">lock</span>
                      Locked to vehicle
                    </span>
                  )}
                </label>
                <select
                  id="sacco-org-select"
                  value={sacco}
                  disabled={!!matchedVehicle}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const found = DEFAULT_SACCOS.find((s) => s.name === selectedName);
                    setSacco(selectedName);
                    setSaccoId(found?.id || (selectedName ? selectedName.toLowerCase().replace(/\s+/g, '_') : ''));
                  }}
                  className={`w-full h-10 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-xs focus:ring-2 focus:ring-primary focus:outline-none ${
                    matchedVehicle ? 'opacity-80 cursor-not-allowed bg-surface-container-low font-semibold' : ''
                  }`}
                >
                  <option value="">{t('passenger.dashboard.selectSacco')}</option>
                  {DEFAULT_SACCOS.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {matchedVehicle && !DEFAULT_SACCOS.some((s) => s.name === (matchedVehicle.saccoName || matchedVehicle.saccoId)) && (
                    <option value={matchedVehicle.saccoName || matchedVehicle.saccoId}>
                      {matchedVehicle.saccoName || matchedVehicle.saccoId}
                    </option>
                  )}
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
      </motion.div>

      <motion.div variants={variants.staggerItem} className="grid grid-cols-2 gap-3">
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
      </motion.div>

      <motion.div variants={variants.staggerItem} className="space-y-2">
        <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider">
          {t('passenger.dashboard.quickTools')}
        </h2>
        <div className="space-y-2 text-xs font-medium">
          <SosButton
            onClick={() => navigate('/passenger/sos')}
            label={t('passenger.dashboard.emergencySos')}
            variant="row"
          />
          <button
            onClick={() => navigate('/passenger/trips')}
            className="w-full flex items-center gap-2 p-3 rounded-xl bg-surface-container border border-outline-variant/30 hover:bg-surface-container-high transition-colors text-left"
          >
            <span className="material-symbols-outlined text-lg">history</span>
            {t('passenger.dashboard.tripLogs')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
