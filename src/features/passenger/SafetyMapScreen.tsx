import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { publicPinRepository } from '../../repositories';
import { useToast } from '../../components/ui/Toast';

interface HazardPin {
  id: string;
  title: string;
  type: 'blackspot' | 'hotspot' | 'danger_zone' | 'police' | 'hospital';
  severity: 'high' | 'medium' | 'low';
  locationName: string;
  corroborationCount: number;
  description: string;
  distanceKm: number;
}

export const SafetyMapScreen: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [hazards, setHazards] = useState<HazardPin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHazard, setSelectedHazard] = useState<HazardPin | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'hazards' | 'emergency'>('all');

  useEffect(() => {
    async function loadHazards() {
      setIsLoading(true);
      try {
        const pins = await publicPinRepository.getAll();
        const mapped: HazardPin[] = pins.map((p: any) => ({
          id: p.id,
          title: p.title || p.name || 'Hazardous Location',
          type: (p.type === 'hospital' || p.type === 'police' || p.type === 'hotspot' || p.type === 'danger_zone')
            ? p.type
            : (p.hazardType === 'accident_prone' ? 'blackspot' : 'blackspot'),
          severity: p.severity === 'critical' ? 'high' : (p.severity || 'high'),
          locationName: p.routeName || p.locationName || 'Corridor',
          corroborationCount: p.corroborationCount || p.corroborationsCount || 0,
          description: p.description || 'Verified public safety hazard location.',
          distanceKm: 1.0,
        }));

        if (mapped.length === 0) {
          // Default public pins for unpopulated state
          setHazards([
            {
              id: 'pin_default_1',
              title: 'Kinungi Blackspot (A104)',
              type: 'blackspot',
              severity: 'high',
              locationName: 'Naivasha - Nakuru Highway',
              corroborationCount: 14,
              description: 'High frequency collision area near Kinungi flyover.',
              distanceKm: 2.5,
            },
            {
              id: 'pin_default_2',
              title: 'Salgaa Deceleration Hill',
              type: 'blackspot',
              severity: 'high',
              locationName: 'Nakuru - Eldoret Highway',
              corroborationCount: 22,
              description: 'Steep incline with runaway truck ramp.',
              distanceKm: 12.0,
            },
          ]);
        } else {
          setHazards(mapped);
        }
      } catch (err) {
        console.error('Failed to load public pin safety hazards:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadHazards();
  }, []);

  const filteredHazards = hazards.filter((h) => {
    if (activeCategory === 'hazards' && (h.type === 'hospital' || h.type === 'police')) return false;
    if (activeCategory === 'emergency' && h.type !== 'hospital' && h.type !== 'police') return false;
    if (searchQuery) {
      return (
        h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.locationName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Search Header Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-on-surface">{t('passenger.map.title')}</h1>
          <Button
            size="sm"
            onClick={() => navigate('/passenger/report-blackspot')}
            className="text-xs font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">add_location_alt</span>
            {t('passenger.map.reportHazard')}
          </Button>
        </div>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('passenger.map.searchPlaceholder')}
          className="text-xs bg-surface shadow-sm"
        />
      </div>

      {/* Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            activeCategory === 'all'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t('passenger.map.catAll')}
        </button>
        <button
          onClick={() => setActiveCategory('hazards')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            activeCategory === 'hazards'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t('passenger.map.catHazards')}
        </button>
        <button
          onClick={() => setActiveCategory('emergency')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            activeCategory === 'emergency'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {t('passenger.map.catEmergency')}
        </button>
      </div>

      {/* Interactive Map Visual Simulation Tile */}
      <Card className="relative h-64 w-full rounded-2xl overflow-hidden border border-outline-variant/30 shadow-sm flex flex-col justify-between p-4 bg-gradient-to-br from-emerald-950 via-[#0d2818] to-teal-950 text-white">
        {/* Map Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1b4d2e_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

        {/* Floating Controls */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono">
          <Badge className="bg-emerald-900/80 text-emerald-200 border-emerald-700">
            GPS Corridor: Active
          </Badge>
          <span className="text-[10px] text-emerald-300">Live Traffic Feed</span>
        </div>

        {/* Map Pins Simulation */}
        <div className="relative z-10 my-auto flex items-center justify-around">
          {filteredHazards.map((hazard) => (
            <button
              key={hazard.id}
              onClick={() => setSelectedHazard(hazard)}
              className={`p-2.5 rounded-full shadow-lg transform transition-all hover:scale-110 active:scale-95 flex items-center justify-center ${
                hazard.type === 'hospital'
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                  : hazard.type === 'police'
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
                  : hazard.severity === 'high'
                  ? 'bg-error text-on-error ring-2 ring-red-300 animate-pulse'
                  : 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {hazard.type === 'hospital'
                  ? 'local_hospital'
                  : hazard.type === 'police'
                  ? 'local_police'
                  : 'warning'}
              </span>
            </button>
          ))}
        </div>

        <div className="relative z-10 text-center text-[11px] text-emerald-300/80 font-mono">
          Tap any map pin above to inspect hazard or emergency details
        </div>
      </Card>

      {/* Hazards & Services List */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-on-surface-variant">
          Nearby Road Hazards & Services
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
            {t('passenger.map.loading')}
          </div>
        ) : filteredHazards.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
            {t('passenger.map.noHazardsFound')}
          </div>
        ) : (
          filteredHazards.map((item) => (
            <Card
              key={item.id}
              onClick={() => setSelectedHazard(item)}
              className="p-4 cursor-pointer hover:bg-surface-container-high/50 transition-colors space-y-2 border border-outline-variant/30"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span
                      className={`p-1 rounded-md text-white text-xs ${
                        item.type === 'hospital'
                          ? 'bg-blue-600'
                          : item.type === 'police'
                          ? 'bg-indigo-600'
                          : item.severity === 'high'
                          ? 'bg-error'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm block">
                        {item.type === 'hospital'
                          ? 'local_hospital'
                          : item.type === 'police'
                          ? 'local_police'
                          : 'warning'}
                      </span>
                    </span>
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">{item.locationName}</p>
                </div>

                <Badge
                  variant={
                    item.type === 'hospital' || item.type === 'police'
                      ? 'neutral'
                      : item.severity === 'high'
                      ? 'danger'
                      : 'warning'
                  }
                  className="text-[10px] font-bold"
                >
                  {t('passenger.map.distanceAway', { distance: item.distanceKm })}
                </Badge>
              </div>

              <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
            </Card>
          ))
        )}
      </div>

      {/* Hazard / Service Inspector Dialog */}
      <Dialog
        isOpen={!!selectedHazard}
        onClose={() => setSelectedHazard(null)}
        title={selectedHazard?.title || 'Location Info'}
      >
        {selectedHazard && (
          <div className="space-y-4 text-xs text-on-surface">
            <div className="bg-surface-container p-3 rounded-xl space-y-1">
              <div className="font-bold text-sm text-primary">{selectedHazard.locationName}</div>
              <div className="text-on-surface-variant text-[11px]">
                {t('passenger.map.distanceAway', { distance: selectedHazard.distanceKm })}
              </div>
            </div>

            <p className="text-on-surface-variant leading-relaxed">{selectedHazard.description}</p>

            {selectedHazard.corroborationCount > 0 && (
              <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg text-emerald-800 font-medium">
                <span className="material-symbols-outlined text-base">verified</span>
                {t('passenger.map.corroborations')}: {selectedHazard.corroborationCount}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setSelectedHazard(null)}
              >
                {t('passenger.map.close')}
              </Button>
              <Button
                className="flex-1 text-xs font-bold"
                onClick={() => {
                  showToast('info', 'Route Guidance', `Navigating to ${selectedHazard.title}`);
                  setSelectedHazard(null);
                }}
              >
                {t('passenger.map.routeGuidance')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
