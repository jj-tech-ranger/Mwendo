import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Search,
  ArrowLeft,
  CheckCircle2,
  X,
  History,
  Info,
  Car,
  Building2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { normalizePlate, isValidPlateFormat } from '../../lib/plate';
import {
  vehiclePublicSummaryRepository,
  saccoRepository,
  vehicleRepository,
} from '../../repositories';
import { VehiclePublicSummary, SACCO } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useTripStore } from '../../store/useTripStore';
import { useMotionPresets } from '../../lib/motion';

const RECENT_LOOKUPS_STORAGE_KEY = 'mwendo_recent_vehicle_lookups';

export const VehicleLookupScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlate = searchParams.get('plate') || '';

  const [inputPlate, setInputPlate] = useState(initialPlate);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<VehiclePublicSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePublicSummary | null>(null);
  const [saccoDetails, setSaccoDetails] = useState<SACCO | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentLookups, setRecentLookups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_LOOKUPS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const autocompleteRef = useRef<HTMLDivElement>(null);
  const startTrip = useTripStore((s) => s.startTrip);
  const { variants } = useMotionPresets();

  const saveRecentLookup = (plate: string) => {
    const norm = normalizePlate(plate);
    if (!norm) return;
    setRecentLookups((prev) => {
      const updated = [norm, ...prev.filter((p) => p !== norm)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_LOOKUPS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage full or unavailable
      }
      return updated;
    });
  };

  const performLookup = async (plateQuery: string) => {
    const normalized = normalizePlate(plateQuery);
    if (!normalized) return;

    setIsSearching(true);
    setHasSearched(true);
    setShowSuggestions(false);
    setSelectedVehicle(null);
    setSaccoDetails(null);

    try {
      // 1. Check public-safe summary collection first (accessible to all signed-in passengers)
      let summary = await vehiclePublicSummaryRepository.findByNormalizedPlate(normalized);

      // 2. Fallback to vehicleRepository if accessible (e.g. SACCO managers or admins)
      if (!summary) {
        try {
          const fullVehicle = await vehicleRepository.findByNormalizedPlate(normalized);
          if (fullVehicle) {
            summary = {
              id: fullVehicle.id,
              vehicleId: fullVehicle.id,
              regNumber: fullVehicle.regNumber,
              saccoId: fullVehicle.saccoId,
              saccoName: fullVehicle.saccoName,
              riskTier: fullVehicle.riskTier,
              riskScore: fullVehicle.riskScore,
              isProvisional: fullVehicle.isProvisional,
              status: fullVehicle.status,
            };
          }
        } catch {
          // Expected permission-denied for passengers reading /vehicles
        }
      }

      if (summary) {
        setSelectedVehicle(summary);
        saveRecentLookup(summary.regNumber);

        // Fetch SACCO details if available
        if (summary.saccoId && summary.saccoId !== 'unassigned') {
          try {
            const sacco = await saccoRepository.getById(summary.saccoId);
            if (sacco) setSaccoDetails(sacco);
          } catch {
            // Sacco read error
          }
        }
      } else {
        // Not found in fleet database - provisional state
        setSelectedVehicle({
          id: normalized,
          vehicleId: normalized,
          regNumber: normalized,
          saccoId: 'unassigned',
          saccoName: 'Independent / Unregistered PSV',
          isProvisional: true,
        });
        saveRecentLookup(normalized);
      }
    } catch (err) {
      console.warn('[VehicleLookup] Lookup failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Autocomplete suggestion debouncing
  useEffect(() => {
    const normalized = normalizePlate(inputPlate);
    if (!normalized || normalized.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const results = await vehiclePublicSummaryRepository.searchVehicles(normalized, 5);
        if (isCurrent) {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch {
        if (isCurrent) setSuggestions([]);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [inputPlate]);

  // Trigger initial search if plate query param provided
  useEffect(() => {
    if (initialPlate && isValidPlateFormat(initialPlate)) {
      performLookup(initialPlate);
    }
  }, [initialPlate]);

  // Click-outside listener for autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (vehicle: VehiclePublicSummary) => {
    setInputPlate(vehicle.regNumber);
    setSelectedVehicle(vehicle);
    setShowSuggestions(false);
    setHasSearched(true);
    saveRecentLookup(vehicle.regNumber);

    if (vehicle.saccoId && vehicle.saccoId !== 'unassigned') {
      saccoRepository.getById(vehicle.saccoId).then((sacco) => {
        if (sacco) setSaccoDetails(sacco);
      }).catch(() => {});
    }
  };

  const handleBoardVehicle = () => {
    if (!selectedVehicle) return;

    const norm = normalizePlate(selectedVehicle.regNumber || inputPlate);
    startTrip({
      vehicleId: selectedVehicle.isProvisional ? undefined : selectedVehicle.id,
      plateNumber: selectedVehicle.regNumber || norm,
      saccoId: selectedVehicle.saccoId || 'unassigned',
      saccoName: selectedVehicle.saccoName || 'Independent / Unassigned',
      routeName: 'Standard Route',
      isProvisional: !!selectedVehicle.isProvisional,
    });

    navigate('/passenger/start-trip');
  };

  const getRiskBadge = (tier?: string) => {
    switch (tier) {
      case 'low':
        return {
          label: 'Low Risk',
          icon: ShieldCheck,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          guidance: 'This vehicle maintains an excellent safety record with compliant speed telemetry. Board with confidence.',
          accentColor: 'border-emerald-500',
        };
      case 'medium':
        return {
          label: 'Moderate Risk',
          icon: AlertTriangle,
          color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          guidance: 'Occasional speed or harsh braking alerts recorded. Standard safety monitoring will remain active during your journey.',
          accentColor: 'border-amber-500',
        };
      case 'high':
        return {
          label: 'Elevated Risk',
          icon: AlertOctagon,
          color: 'text-orange-700 bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
          guidance: 'Multiple speed violations detected within the past 30 days. Consider alternative transport if readily available.',
          accentColor: 'border-orange-500',
        };
      case 'critical':
        return {
          label: 'Critical Risk',
          icon: AlertOctagon,
          color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
          guidance: 'Frequent high-speed infractions and unresolved safety flags. NTSA advisory active. Avoid boarding if possible.',
          accentColor: 'border-rose-500',
        };
      default:
        return {
          label: 'Unrated / Provisional',
          icon: Info,
          color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          guidance: 'No historical risk data on record. Real-time GPS speed tracking will actively monitor your trip when you board.',
          accentColor: 'border-blue-500',
        };
    }
  };

  const riskInfo = getRiskBadge(selectedVehicle?.riskTier);
  const RiskIcon = riskInfo.icon;

  return (
    <motion.div
      variants={variants.staggerContainer}
      initial="hidden"
      animate="visible"
      className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24"
      id="vehicle-lookup-screen"
    >
      {/* Top Header */}
      <motion.div variants={variants.staggerItem} className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-surface-container-high transition-colors text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Go back"
          id="btn-back-lookup"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight text-on-surface flex items-center gap-2">
            <span>Check Before You Board</span>
            <Sparkles className="w-4 h-4 text-primary" />
          </h1>
          <p className="text-xs text-on-surface-variant font-medium">
            Verify PSV safety rating, SACCO standing & risk tier
          </p>
        </div>
      </motion.div>

      {/* Search Input Card */}
      <motion.div variants={variants.staggerItem}>
        <Card className="p-5 space-y-4 shadow-sm border border-outline-variant/30" id="lookup-search-card">
          <div className="space-y-1">
            <label
              htmlFor="lookup-plate-input"
              className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center justify-between"
            >
              <span>Matatu Registration Number</span>
              {isSearching && (
                <span className="text-[11px] font-normal text-primary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  Verifying...
                </span>
              )}
            </label>
            <p className="text-[11px] text-on-surface-variant">
              Enter plate (e.g. KDA 123A, KBZ 999Z)
            </p>
          </div>

          <div ref={autocompleteRef} className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="lookup-plate-input"
                  type="text"
                  value={inputPlate}
                  onChange={(e) => {
                    setInputPlate(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      performLookup(inputPlate);
                    }
                  }}
                  placeholder="e.g. KDA 123A"
                  maxLength={12}
                  className="w-full h-12 px-4 font-mono font-bold text-base uppercase rounded-xl border border-outline-variant/50 bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-label="Vehicle plate number search"
                />
                {inputPlate && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputPlate('');
                      setSelectedVehicle(null);
                      setHasSearched(false);
                      setSuggestions([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-full"
                    aria-label="Clear input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Button
                id="btn-search-plate"
                onClick={() => performLookup(inputPlate)}
                disabled={!normalizePlate(inputPlate) || isSearching}
                className="h-12 px-5 font-bold"
              >
                <Search className="w-4 h-4 mr-1.5" />
                Check
              </Button>
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-xl overflow-hidden divide-y divide-outline-variant/10"
                >
                  <div className="px-3 py-1.5 bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Matching Registered Vehicles
                  </div>
                  {suggestions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(v)}
                      className="w-full px-4 py-2.5 text-left hover:bg-surface-container-high transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-on-surface group-hover:text-primary">
                          {v.regNumber}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {v.saccoName || v.saccoId}
                        </span>
                      </div>
                      <Badge
                        variant={v.riskTier === 'low' ? 'success' : v.riskTier === 'medium' ? 'warning' : 'danger'}
                        className="text-[10px] capitalize"
                      >
                        {v.riskTier || 'verified'}
                      </Badge>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Recent Lookups */}
          {recentLookups.length > 0 && !selectedVehicle && (
            <div className="pt-2 border-t border-outline-variant/15 space-y-2">
              <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Recent Checks
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentLookups.map((plate) => (
                  <button
                    key={plate}
                    type="button"
                    onClick={() => {
                      setInputPlate(plate);
                      performLookup(plate);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-surface-container text-xs font-mono font-semibold text-on-surface hover:bg-surface-container-high border border-outline-variant/20 transition-all"
                  >
                    {plate}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Lookup Result Card */}
      <AnimatePresence mode="wait">
        {selectedVehicle && (
          <motion.div
            key={selectedVehicle.id}
            variants={variants.staggerItem}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
            id="lookup-result-section"
          >
            {/* Primary Safety Standing Card */}
            <Card
              className={`p-5 space-y-5 border-2 shadow-md ${riskInfo.accentColor}`}
              id="vehicle-standing-card"
            >
              {/* Kenyan License Plate Visual Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-outline-variant/20">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                    Verified Vehicle Registration
                  </div>
                  {/* KenPlate Visual */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-yellow-300 border-2 border-black rounded-lg shadow-sm">
                    <span className="text-base font-mono font-black tracking-widest text-black">
                      {selectedVehicle.regNumber}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-tighter px-1 py-0.5 bg-black text-yellow-300 rounded">
                      KE
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${riskInfo.color}`}>
                    <RiskIcon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">{riskInfo.label}</span>
                  </div>
                </div>
              </div>

              {/* Standing Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fleet / SACCO Affiliation */}
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                  <div className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1.5 uppercase">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    SACCO Affiliation
                  </div>
                  <div className="text-sm font-bold text-on-surface">
                    {selectedVehicle.saccoName || 'Independent Operator'}
                  </div>
                  {saccoDetails?.safetyScore && (
                    <div className="text-[11px] text-on-surface-variant">
                      SACCO Safety Score: <span className="font-bold text-emerald-700 dark:text-emerald-400">{saccoDetails.safetyScore}/100</span>
                    </div>
                  )}
                </div>

                {/* Fleet Verification Status */}
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1">
                  <div className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1.5 uppercase">
                    <Car className="w-3.5 h-3.5 text-primary" />
                    Fleet Status
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedVehicle.isProvisional ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Provisional / Unregistered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accredited SACCO Fleet
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {selectedVehicle.isProvisional
                      ? 'No formal SACCO record filed'
                      : 'Verified PSV operator license'}
                  </div>
                </div>
              </div>

              {/* Commuter Safety Guidance */}
              <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 space-y-1.5">
                <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-primary" />
                  Commuter Safety Guidance
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {riskInfo.guidance}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  id="btn-board-vehicle"
                  onClick={handleBoardVehicle}
                  className="flex-1 h-12 font-bold text-sm shadow-md"
                >
                  <Car className="w-4 h-4 mr-2" />
                  Board This Vehicle & Track Trip
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/passenger/report-blackspot')}
                  className="h-12 px-4 text-xs font-bold"
                  id="btn-report-hazard-lookup"
                >
                  Report Route Hazard
                </Button>
              </div>
            </Card>

            {/* Explanatory Note on Privacy & Public Transparency */}
            <div className="p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant/15 text-[11px] text-on-surface-variant space-y-1">
              <span className="font-bold text-on-surface flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Mwendo Salama Public Safety Registry
              </span>
              <p>
                Safety standing projections are updated in real time from aggregated telemetry and authority reports. SACCO internal operational data and driver private records are protected under national data protection regulations.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Educational Card when no search performed yet */}
      {!selectedVehicle && !hasSearched && (
        <motion.div variants={variants.staggerItem}>
          <Card className="p-5 space-y-3 bg-surface-container-low/50 border border-outline-variant/20">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Why check before boarding?
            </h3>
            <ul className="text-xs text-on-surface-variant space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>
                  <strong>Identify high-risk vehicles:</strong> Matatus with frequent overspeeding violations or reckless driving alerts are flagged before you get on board.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>
                  <strong>Confirm SACCO accreditation:</strong> Ensure the vehicle belongs to an accredited SACCO with active safety compliance monitoring.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>
                  <strong>Immediate 1-tap trip protection:</strong> Once checked, start tracking your journey with automatic GPS speed warnings and emergency SOS.
                </span>
              </li>
            </ul>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};
