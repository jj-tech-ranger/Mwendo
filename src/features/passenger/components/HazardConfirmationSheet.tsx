import React, { useState, useEffect } from 'react';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { functionsService } from '../../../services/functionsService';
import { pointsService } from '../../../services/pointsService';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  CheckCircle2,
  ThumbsUp,
  ShieldCheck,
  Check,
  MapPin,
  RefreshCw,
} from 'lucide-react';

export interface HazardConfirmationSheetProps {
  hazardId: string;
  hazardTitle: string;
  locationName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  distanceKm?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const HazardConfirmationSheet: React.FC<HazardConfirmationSheetProps> = ({
  hazardId,
  hazardTitle,
  locationName,
  severity,
  description,
  distanceKm,
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<{
    total: number;
    stillThere: number;
    resolved: number;
    lastConfirmedAt?: string | undefined;
    userConfirmation?: 'still_there' | 'resolved' | null | undefined;
    userCanConfirm: boolean;
  }>({
    total: 0,
    stillThere: 0,
    resolved: 0,
    userCanConfirm: true,
  });
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadStats = async () => {
    if (!hazardId) return;
    setIsLoadingStats(true);
    try {
      const data = await functionsService.getBlackSpotConfirmations(hazardId);
      setStats(data);
    } catch (err) {
      console.warn('[HazardConfirmationSheet] Failed to load confirmation stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen && hazardId) {
      loadStats();
    }
  }, [isOpen, hazardId]);

  const handleConfirm = async (type: 'still_there' | 'resolved') => {
    if (!stats.userCanConfirm && stats.userConfirmation) {
      showToast('warning', 'Already Submitted', 'You have already confirmed this hazard in the last 24 hours.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await functionsService.confirmBlackSpot(hazardId, type);
      if (result.success) {
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.uid) {
          void pointsService.awardPoints(currentUser.uid, 'report_confirmed');
        }
        showToast(
          'success',
          type === 'still_there' ? 'Hazard Confirmed (+10 Pts)' : 'Reported Resolved (+10 Pts)',
          result.message
        );
        // Refresh live stats
        await loadStats();
      } else {
        showToast('warning', 'Notice', result.message);
      }
    } catch (err: unknown) {
      console.error('[HazardConfirmationSheet] Error submitting confirmation:', err);
      showToast('error', 'Error', 'Failed to submit confirmation. Please check network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityBadgeClass =
    severity === 'critical' || severity === 'high'
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : severity === 'medium'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={hazardTitle || 'Road Hazard Report'}>
      <div id="hazard-confirmation-sheet" className="space-y-4 text-xs text-slate-800">
        {/* Header Summary */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-sm">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="truncate">{locationName}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${severityBadgeClass}`}>
              {severity} Risk
            </span>
          </div>
          {typeof distanceKm === 'number' && (
            <p className="text-slate-500 text-[11px]">
              Approx. <span className="font-mono font-medium">{distanceKm.toFixed(1)} km</span> away from current position
            </p>
          )}
        </div>

        {/* Hazard Description */}
        <div className="p-3 bg-white rounded-xl border border-slate-100 text-slate-600 text-xs leading-relaxed">
          {description || 'Community reported road safety hazard. Exercise caution along this transit corridor.'}
        </div>

        {/* Crowdsourced Confirmation Banner (Waze style) */}
        <div id="waze-crowdsource-counter" className="p-3 bg-gradient-to-r from-emerald-50/90 to-teal-50/90 border border-emerald-200/70 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-600 text-white">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold text-emerald-950 text-xs">Community Corroboration</span>
            </div>
            {isLoadingStats ? (
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
            ) : (
              <span className="text-[11px] font-semibold text-emerald-800">
                {stats.stillThere} confirmed still there
              </span>
            )}
          </div>

          <p className="text-emerald-900/90 text-xs font-medium">
            {stats.stillThere > 0
              ? `${stats.stillThere} driver${stats.stillThere === 1 ? '' : 's'} / commuter${stats.stillThere === 1 ? '' : 's'} confirmed this hazard recently.`
              : 'Be the first to confirm whether this road hazard is currently present.'}
            {stats.resolved > 0 && ` (${stats.resolved} reported as resolved)`}
          </p>

          {stats.userConfirmation && !stats.userCanConfirm && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>
                You reported this as <strong className="font-semibold">{stats.userConfirmation === 'still_there' ? 'Still there' : 'Resolved'}</strong> today.
              </span>
            </div>
          )}
        </div>

        {/* Waze-style Confirm / Dismiss Actions */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Is this hazard still on the road?
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="confirm-still-there-btn"
              type="button"
              disabled={isSubmitting || (!stats.userCanConfirm && stats.userConfirmation === 'still_there')}
              onClick={() => handleConfirm('still_there')}
              className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border shadow-sm ${
                stats.userConfirmation === 'still_there'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300 active:scale-[0.98]'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <ThumbsUp className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>{isSubmitting ? 'Submitting...' : 'Still there'}</span>
            </button>

            <button
              id="confirm-resolved-btn"
              type="button"
              disabled={isSubmitting || (!stats.userCanConfirm && stats.userConfirmation === 'resolved')}
              onClick={() => handleConfirm('resolved')}
              className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border shadow-sm ${
                stats.userConfirmation === 'resolved'
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300 active:scale-[0.98]'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>{isSubmitting ? 'Submitting...' : 'No longer an issue'}</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            Crowdsourced reports automatically decay and resolve as road conditions improve.
          </p>
        </div>

        {/* Footer Close */}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Button variant="outline" className="w-full text-xs font-semibold" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default HazardConfirmationSheet;
