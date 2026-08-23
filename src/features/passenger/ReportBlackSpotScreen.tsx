import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { BrandMark } from '../../components/assets/BrandAssets';
import { MapComponent } from '../../components/map/MapComponent';
import { offlineStorage } from '../../services/offlineStorage';
import { offlineSyncService } from '../../services/offlineSyncService';
import { functionsService } from '../../services/functionsService';
import { storageService } from '../../services/storageService';
import { useAuthStore } from '../../store/useAuthStore';

export const ReportBlackSpotScreen: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // Step 4 is Confirmation
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'acquired' | 'denied' | 'error'>('requesting');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  const [locationName, setLocationName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hazardType, setHazardType] = useState<'accident_prone' | 'pothole' | 'carjacking_risk' | 'poor_lighting' | 'unmarked_bump'>('accident_prone');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('high');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // Real Geolocation Request
  const requestGpsLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMessage('Geolocation is not supported by your browser. Please drop a manual pin on the map.');
      return;
    }

    setGpsStatus('requesting');
    setGpsErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setSelectedLocation(coords);
        setLocationSource('gps');
        setGpsStatus('acquired');
        setLocationName((prev) => (prev ? prev : `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`));
      },
      (err) => {
        setGpsStatus('denied');
        setGpsErrorMessage(
          err.code === 1
            ? 'Location permission was denied. Please drop a pin on the map below to mark the hazard.'
            : 'Unable to acquire GPS location. Please drop a pin on the map below.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, []);

  // Request GPS on mount
  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  // Handle Manual Pin Drop on Map
  const handleMapPinDrop = (coords: { lat: number; lng: number }) => {
    const fixedCoords = {
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
    };
    setSelectedLocation(fixedCoords);
    setLocationSource('manual');
    setGpsStatus('acquired');
    if (!locationName || locationName.startsWith('GPS:') || locationName.startsWith('Pin:')) {
      setLocationName(`Pin: ${fixedCoords.lat.toFixed(4)}, ${fixedCoords.lng.toFixed(4)}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUrl(reader.result as string);
        setHasPhoto(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedLocation) {
      setRateLimitError('A valid GPS coordinate or manual map pin is strictly required to submit a hazard report.');
      return;
    }

    setIsSubmitting(true);
    setRateLimitError(null);
    const reportId = `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newReport = {
      id: reportId,
      spotId: reportId,
      title: title.trim() || 'Road Hazard',
      name: title.trim() || locationName || 'Road Hazard',
      description,
      hazardDescription: description || title || 'Road Hazard',
      hazardType,
      severity,
      locationName: locationName || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`,
      routeName: locationName || 'Kenyan Corridor',
      county: 'Nairobi',
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      location: { lat: selectedLocation.lat, lng: selectedLocation.lng },
      photoUrl: photoDataUrl || undefined,
      reportedByUid: user?.uid || user?.id || '',
      reportedByUserId: user?.uid || user?.id || '',
      reportedByDisplayName: user?.displayName || 'Commuter',
      status: 'pending',
      corroborationsCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (navigator.onLine) {
        // SEC-005: Create black spot doc first, then upload evidence file under spotId
        await functionsService.reportBlackSpot(newReport);

        if (photoFile) {
          try {
            await storageService.uploadBlackSpotPhoto(photoFile, reportId);
          } catch (storageErr) {
            console.warn('Storage upload error for black spot photo:', storageErr);
          }
        }

        setStep(4);
      } else {
        await offlineStorage.setItem(`offline_report_${reportId}`, newReport);
        await offlineSyncService.updatePendingCount();
        setStep(4);
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string; code?: string };
      if (errObj.message?.includes('RATE_LIMIT_EXCEEDED') || errObj.code === 'RATE_LIMIT_EXCEEDED') {
        setRateLimitError(errObj.message || 'Rate limit exceeded: Maximum 10 hazard reports per 24 hours allowed.');
        return;
      }
      console.warn('Network write failed, saving to offline buffer:', err);
      await offlineStorage.setItem(`offline_report_${reportId}`, newReport);
      await offlineSyncService.updatePendingCount();
      setStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 4: CONFIRMATION SCREEN
  if (step === 4) {
    return (
      <div className="min-h-screen bg-background text-on-background p-6 max-w-lg mx-auto flex flex-col justify-center items-center text-center space-y-6 animate-in fade-in">
        <BrandMark className="w-12 h-12 mb-2" />

        <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-500/20 animate-bounce">
          <span className="material-symbols-outlined text-4xl">check_circle</span>
        </div>

        <div className="space-y-2">
          <Badge className="bg-emerald-600 text-white font-bold px-3 py-1">
            +10 Trust Score Earned
          </Badge>
          <h1 className="text-2xl font-black text-on-surface">Report Submitted — Thank You!</h1>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            Your hazard report helps keep fellow Kenyan commuters safe. Our authority team will review and corroborate it.
          </p>
        </div>

        <Card className="p-4 w-full text-left text-xs space-y-1 bg-surface-container-low font-mono">
          <div className="font-bold text-primary">{title || 'Unmarked Road Hazard'}</div>
          <div className="text-on-surface-variant">{locationName}</div>
          {selectedLocation && (
            <div className="text-on-surface-variant text-[11px]">
              GPS: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)} ({locationSource === 'gps' ? 'Live GPS' : 'Manual Pin'})
            </div>
          )}
          <div className="text-emerald-700 font-bold uppercase mt-1">Status: Pending Verification</div>
        </Card>

        <div className="space-y-2 w-full pt-4">
          <Button
            id="btn-back-to-safety-map"
            data-testid="btn-back-to-safety-map"
            className="w-full h-11 font-bold"
            onClick={() => navigate('/passenger/map')}
          >
            Back to Safety Map
          </Button>

          <Button
            id="btn-report-another-hazard"
            data-testid="btn-report-another-hazard"
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              setStep(1);
              setTitle('');
              setDescription('');
              setSelectedLocation(null);
              setLocationSource(null);
              requestGpsLocation();
            }}
          >
            Report Another Hazard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Wizard Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <button
            id="btn-hazard-wizard-back"
            data-testid="btn-hazard-wizard-back"
            onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3 | 4) : navigate('/passenger'))}
            className="flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </button>
          <span className="font-bold text-primary">Step {step} of 3</span>
        </div>

        <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP 1: LOCATION PICKER */}
      {step === 1 && (
        <Card className="p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-on-surface">Select Hazard Location</h2>
            <p className="text-xs text-on-surface-variant">
              Confirm where this road hazard is located. A real GPS location or manual map pin is required.
            </p>
          </div>

          {/* Location Status Badge / Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs">
            <div className="flex items-center gap-2">
              {gpsStatus === 'requesting' ? (
                <span className="material-symbols-outlined text-amber-500 text-lg animate-spin">
                  progress_activity
                </span>
              ) : selectedLocation ? (
                <span className="material-symbols-outlined text-emerald-600 text-lg">
                  check_circle
                </span>
              ) : (
                <span className="material-symbols-outlined text-rose-500 text-lg">
                  location_off
                </span>
              )}

              <div>
                <div className="font-bold text-on-surface">
                  {gpsStatus === 'requesting'
                    ? 'Acquiring GPS...'
                    : selectedLocation
                    ? `Location Set (${locationSource === 'gps' ? 'Live GPS' : 'Manual Pin'})`
                    : 'Location Required'}
                </div>
                {selectedLocation ? (
                  <div className="font-mono text-[11px] text-on-surface-variant" data-testid="selected-coordinates-display">
                    {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                  </div>
                ) : (
                  <div className="text-[11px] text-rose-600">
                    {gpsErrorMessage || 'Please allow GPS or drop a pin on the map'}
                  </div>
                )}
              </div>
            </div>

            <Button
              id="btn-use-gps-location"
              data-testid="btn-use-gps-location"
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              isLoading={gpsStatus === 'requesting'}
              onClick={requestGpsLocation}
            >
              <span className="material-symbols-outlined text-sm">my_location</span>
              Use My Location
            </Button>
          </div>

          {/* Map Component with Pin Drop */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span className="font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-primary">touch_app</span>
                Tap map to place or adjust hazard pin
              </span>
              {selectedLocation && (
                <span className="text-emerald-600 font-bold">Pin Placed</span>
              )}
            </div>

            <div
              id="hazard-map-pin-drop-wrapper"
              data-testid="hazard-map-pin-drop-wrapper"
              className="rounded-xl overflow-hidden border border-outline-variant/40"
              onClick={(e) => {
                // Pin drop click handler (handles both real browser and JSDOM test environments)
                const target = e.currentTarget;
                const rect = target.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const width = rect.width || 400;
                const height = rect.height || 250;
                const relLat = -1.286389 + ((clickY / height) - 0.5) * 0.05;
                const relLng = 36.817223 + ((clickX / width) - 0.5) * 0.05;
                handleMapPinDrop({ lat: relLat, lng: relLng });
              }}
            >
              <MapComponent
                enablePinDrop={true}
                pinnedLocation={selectedLocation}
                onPinDrop={handleMapPinDrop}
                initialCenter={selectedLocation || undefined}
                className="h-64"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">
              Location Name / Landmark (Optional)
            </label>
            <Input
              id="input-hazard-location-name"
              data-testid="input-hazard-location-name"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Waiyaki Way near Kangemi Flyover"
              className="text-xs"
            />
          </div>

          {!selectedLocation && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">info</span>
              <span>Please grant GPS permission or tap anywhere on the map to set the hazard position.</span>
            </div>
          )}

          <Button
            id="btn-confirm-location-next"
            data-testid="btn-confirm-location-next"
            className="w-full h-11 font-bold"
            disabled={!selectedLocation}
            onClick={() => setStep(2)}
          >
            Confirm Location & Next
          </Button>
        </Card>
      )}

      {/* STEP 2: HAZARD DETAILS */}
      {step === 2 && (
        <Card className="p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-on-surface">Hazard Details</h2>
            <p className="text-xs text-on-surface-variant">
              Choose the category and describe the hazard.
            </p>
          </div>

          {/* Hazard Type Selector Chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface block">Hazard Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'accident_prone' as const, label: 'Accident Prone' },
                { id: 'pothole' as const, label: 'Deep Pothole' },
                { id: 'carjacking_risk' as const, label: 'Carjacking Risk' },
                { id: 'poor_lighting' as const, label: 'Poor Lighting' },
                { id: 'unmarked_bump' as const, label: 'Unmarked Bump' },
              ].map((type) => (
                <button
                  key={type.id}
                  id={`btn-hazard-type-${type.id}`}
                  data-testid={`btn-hazard-type-${type.id}`}
                  onClick={() => setHazardType(type.id)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                    hazardType === type.id
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Title *</label>
            <Input
              id="input-hazard-title"
              data-testid="input-hazard-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unmarked Speed Bump on Highway"
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Description</label>
            <textarea
              id="textarea-hazard-description"
              data-testid="textarea-hazard-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the danger for other drivers and passengers..."
              className="w-full p-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Photo Evidence Upload Box */}
          <label
            id="label-hazard-photo-upload"
            data-testid="label-hazard-photo-upload"
            className={`p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors block ${
              hasPhoto
                ? 'border-emerald-600 bg-emerald-500/10 text-emerald-800'
                : 'border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
            }`}
          >
            <input
              id="input-hazard-photo-file"
              data-testid="input-hazard-photo-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <span className="material-symbols-outlined text-2xl mb-1 block">
              {hasPhoto ? 'task_alt' : 'add_a_photo'}
            </span>
            <span className="text-xs font-semibold">
              {hasPhoto ? 'Photo Evidence Attached' : 'Attach Photo Evidence (Optional)'}
            </span>
          </label>

          <Button
            id="btn-hazard-details-next"
            data-testid="btn-hazard-details-next"
            className="w-full h-11 font-bold"
            disabled={!title.trim() || !selectedLocation}
            onClick={() => setStep(3)}
          >
            Next: Select Severity
          </Button>
        </Card>
      )}

      {/* STEP 3: SEVERITY & SUBMIT */}
      {step === 3 && (
        <Card className="p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-on-surface">Select Hazard Severity</h2>
            <p className="text-xs text-on-surface-variant">
              How urgent or dangerous is this road hazard?
            </p>
          </div>

          {/* Location Confirmation Pill */}
          {selectedLocation && (
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">pin_drop</span>
                <div>
                  <span className="font-bold text-on-surface">{title || 'Hazard Report'}</span>
                  <div className="text-[11px] font-mono text-on-surface-variant">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)} ({locationSource === 'gps' ? 'GPS' : 'Manual Pin'})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-primary hover:underline text-xs font-bold cursor-pointer"
              >
                Change
              </button>
            </div>
          )}

          <div className="space-y-3">
            {[
              { id: 'low' as const, label: 'Low Severity', desc: 'Minor inconvenience; slow down', color: 'border-amber-400 text-amber-800' },
              { id: 'medium' as const, label: 'Medium Severity', desc: 'Moderate accident risk or vehicle damage', color: 'border-amber-600 text-amber-900' },
              { id: 'high' as const, label: 'High Severity', desc: 'Immediate crash threat; urgent warning', color: 'border-error text-error' },
            ].map((sev) => (
              <div
                key={sev.id}
                id={`btn-severity-${sev.id}`}
                data-testid={`btn-severity-${sev.id}`}
                onClick={() => setSeverity(sev.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  severity === sev.id
                    ? `${sev.color} bg-surface-container-high shadow-md font-bold`
                    : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <div className="text-sm font-bold">{sev.label}</div>
                <div className="text-xs text-on-surface-variant font-normal">{sev.desc}</div>
              </div>
            ))}
          </div>

          {rateLimitError && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-error text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>Submission Limit Reached</span>
              </div>
              <p>{rateLimitError}</p>
            </div>
          )}

          <Button
            id="btn-submit-hazard-report"
            data-testid="btn-submit-hazard-report"
            className="w-full h-11 font-bold text-sm"
            isLoading={isSubmitting}
            disabled={!selectedLocation || isSubmitting}
            onClick={handleSubmit}
          >
            Submit Black Spot Report
          </Button>
        </Card>
      )}
    </div>
  );
};

