import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { BrandMark } from '../../components/assets/BrandAssets';
import { blackSpotRepository } from '../../repositories';
import { offlineStorage } from '../../services/offlineStorage';
import { offlineSyncService } from '../../services/offlineSyncService';
import { useAuthStore } from '../../store/useAuthStore';

export const ReportBlackSpotScreen: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // Step 4 is Confirmation
  const [locationName, setLocationName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hazardType, setHazardType] = useState<'accident_prone' | 'pothole' | 'carjacking_risk' | 'poor_lighting' | 'unmarked_bump'>('accident_prone');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('high');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUrl(reader.result as string);
        setHasPhoto(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const reportId = `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newReport = {
      id: reportId,
      title: title || 'Road Hazard',
      description,
      hazardType,
      severity,
      locationName,
      location: { lat: -1.221, lng: 36.882 },
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
        await blackSpotRepository.save(newReport as any);
      } else {
        await offlineStorage.setItem(`offline_report_${reportId}`, newReport);
        await offlineSyncService.updatePendingCount();
      }
    } catch (err) {
      console.warn('Network write failed, saving to offline buffer:', err);
      await offlineStorage.setItem(`offline_report_${reportId}`, newReport);
      await offlineSyncService.updatePendingCount();
    } finally {
      setIsSubmitting(false);
      setStep(4);
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
          <div className="text-emerald-700 font-bold uppercase mt-1">Status: Pending Verification</div>
        </Card>

        <div className="space-y-2 w-full pt-4">
          <Button
            className="w-full h-11 font-bold"
            onClick={() => navigate('/passenger/map')}
          >
            Back to Safety Map
          </Button>

          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              setStep(1);
              setTitle('');
              setDescription('');
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
            onClick={() => (step > 1 ? setStep((step - 1) as any) : navigate('/passenger'))}
            className="flex items-center text-on-surface-variant hover:text-on-surface"
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
              Confirm where this road hazard or black spot is located.
            </p>
          </div>

          <div className="h-44 bg-surface-container-high rounded-xl flex items-center justify-center relative overflow-hidden border border-outline-variant/30">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/10 to-teal-900/10" />
            <div className="text-center z-10 space-y-2 p-4">
              <span className="material-symbols-outlined text-primary text-3xl animate-bounce">
                location_on
              </span>
              <div className="font-mono text-xs font-bold text-on-surface">
                {locationName}
              </div>
            </div>
          </div>

          <Input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Waiyaki Way near Kangemi Flyover"
            className="text-xs"
          />

          <Button
            className="w-full h-11 font-bold"
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
                { id: 'accident_prone', label: 'Accident Prone' },
                { id: 'pothole', label: 'Deep Pothole' },
                { id: 'carjacking_risk', label: 'Carjacking Risk' },
                { id: 'poor_lighting', label: 'Poor Lighting' },
                { id: 'unmarked_bump', label: 'Unmarked Bump' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setHazardType(type.id as any)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-all ${
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
            <label className="text-xs font-bold text-on-surface mb-1 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unmarked Speed Bump on Highway"
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the danger for other drivers and passengers..."
              className="w-full p-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface text-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Photo Evidence Upload Box */}
          <label
            className={`p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors block ${
              hasPhoto
                ? 'border-emerald-600 bg-emerald-500/10 text-emerald-800'
                : 'border-outline-variant/50 hover:bg-surface-container text-on-surface-variant'
            }`}
          >
            <input
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
            className="w-full h-11 font-bold"
            disabled={!title.trim()}
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

          <div className="space-y-3">
            {[
              { id: 'low', label: 'Low Severity', desc: 'Minor inconvenience; slow down', color: 'border-amber-400 text-amber-800' },
              { id: 'medium', label: 'Medium Severity', desc: 'Moderate accident risk or vehicle damage', color: 'border-amber-600 text-amber-900' },
              { id: 'high', label: 'High Severity', desc: 'Immediate crash threat; urgent warning', color: 'border-error text-error' },
            ].map((sev) => (
              <div
                key={sev.id}
                onClick={() => setSeverity(sev.id as any)}
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

          <Button
            className="w-full h-11 font-bold text-sm"
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            Submit Black Spot Report
          </Button>
        </Card>
      )}
    </div>
  );
};
