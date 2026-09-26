import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { riskTierToBadgeVariant } from '../../../lib/severity';
import { useToast } from '../../../components/ui/Toast';
import { pointsService } from '../../../services/pointsService';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  CheckCircle2,
  ThumbsUp,
  ShieldCheck,
  Check,
  MapPin,
  RefreshCw,
  Lock,
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
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Firestore security rule: isRegisteredUser() = signed in and not anonymous provider
  const isRegisteredUser = Boolean(
    isAuthenticated &&
    user &&
    user.uid &&
    user.uid !== 'anonymous' &&
    user.role
  );

  const [stats, setStats] = useState<{
    total: number;
    stillThere: number;
    resolved: number;
    lastConfirmedAt?: string | undefined;
    userConfirmation?: 'still_there' | 'resolved' | null | undefined;
    userCanConfirm: boolean;
    cooldownHoursRemaining?: number;
  }>({
    total: 0,
    stillThere: 0,
    resolved: 0,
    userCanConfirm: true,
  });

  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadStats = useCallback(async () => {
    if (!hazardId) return;
    setIsLoadingStats(true);
    try {
      const confCol = collection(db, 'black_spots', hazardId, 'confirmations');
      const snap = await getDocs(confCol);
      let stillThere = 0;
      let resolved = 0;
      let latestMs = 0;
      let userConf: 'still_there' | 'resolved' | null = null;
      let userCanConfirm = true;
      let cooldownHoursRemaining = 0;

      snap.forEach((d) => {
        const data = d.data();
        if (data.type === 'still_there') stillThere++;
        else if (data.type === 'resolved') resolved++;

        const ms = data.timestamp?.toDate
          ? data.timestamp.toDate().getTime()
          : data.timestamp
          ? new Date(data.timestamp).getTime()
          : 0;
        if (ms > latestMs) latestMs = ms;

        if (user && d.id === user.uid) {
          userConf = data.type as 'still_there' | 'resolved';
          const hoursAgo = (Date.now() - ms) / (1000 * 60 * 60);
          if (hoursAgo < 24) {
            userCanConfirm = false;
            cooldownHoursRemaining = Math.max(1, Math.ceil(24 - hoursAgo));
          }
        }
      });

      setStats({
        total: snap.size,
        stillThere,
        resolved,
        lastConfirmedAt: latestMs > 0 ? new Date(latestMs).toISOString() : undefined,
        userConfirmation: userConf,
        userCanConfirm,
        cooldownHoursRemaining,
      });
    } catch (err) {
      console.warn('[HazardConfirmationSheet] Failed to load confirmation stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [hazardId, user]);

  useEffect(() => {
    if (isOpen && hazardId) {
      loadStats();
    }
  }, [isOpen, hazardId, loadStats]);

  const handleConfirm = async (type: 'still_there' | 'resolved') => {
    if (!user?.uid || !isRegisteredUser) {
      showToast('warning', 'Sign In Required', 'Please sign in with a registered account to confirm road hazards.');
      return;
    }

    if (!stats.userCanConfirm) {
      const hours = stats.cooldownHoursRemaining || 24;
      showToast(
        'warning',
        'Cooldown Active',
        `You have already confirmed this hazard today. Next update available in ${hours} hour${hours === 1 ? '' : 's'}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Direct Firestore write strictly matching firestore.rules:
      // match /confirmations/{confirmationId} { allow write: if confirmationId == request.auth.uid && request.resource.data.userId == request.auth.uid ... }
      const confRef = doc(db, 'black_spots', hazardId, 'confirmations', user.uid);
      await setDoc(confRef, {
        userId: user.uid,
        type,
        timestamp: serverTimestamp(),
      });

      void pointsService.awardPoints(user.uid, 'report_confirmed');

      showToast(
        'success',
        type === 'still_there' ? 'Hazard Confirmed (+10 Pts)' : 'Reported Resolved (+10 Pts)',
        type === 'still_there'
          ? 'Thank you! Corroboration recorded for fellow commuters.'
          : 'Thank you! Reported as resolved. Corroborations will decay accordingly.'
      );

      // Refresh live aggregate counts & cooldown
      await loadStats();
    } catch (err: unknown) {
      console.error('[HazardConfirmationSheet] Error submitting confirmation:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('permission-denied') || errMsg.includes('PERMISSION_DENIED')) {
        showToast('warning', '24-Hour Cooldown', 'You can only update your confirmation once every 24 hours.');
      } else {
        showToast('error', 'Error', 'Failed to submit confirmation. Please check network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Badge variant={riskTierToBadgeVariant(severity)} className="uppercase text-[10px] tracking-wider">
              {severity} Risk
            </Badge>
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
              <div className="flex items-center gap-2">
                <span data-testid="aggregate-still-there-count" className="text-[11px] font-semibold text-emerald-800">
                  {stats.stillThere} confirmed still there
                </span>
                {stats.resolved > 0 && (
                  <span data-testid="aggregate-resolved-count" className="text-[11px] font-medium text-emerald-700">
                    • {stats.resolved} resolved
                  </span>
                )}
              </div>
            )}
          </div>

          <p className="text-emerald-900/90 text-xs font-medium">
            {stats.stillThere > 0
              ? `${stats.stillThere} commuter${stats.stillThere === 1 ? '' : 's'}/driver${stats.stillThere === 1 ? '' : 's'} confirmed this hazard recently.`
              : 'Be the first to confirm whether this road hazard is currently present.'}
            {stats.resolved > 0 && ` (${stats.resolved} reported as resolved)`}
          </p>

          {stats.userConfirmation && !stats.userCanConfirm && (
            <div
              data-testid="confirmation-cooldown-badge"
              className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-100/80 px-2.5 py-1.5 rounded-lg border border-emerald-200"
            >
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>
                  You confirmed as <strong className="font-semibold">{stats.userConfirmation === 'still_there' ? 'Still there' : 'Resolved'}</strong>
                </span>
              </div>
              <span className="text-[10px] text-emerald-700 font-mono">
                Cooldown: {stats.cooldownHoursRemaining ?? 24}h left
              </span>
            </div>
          )}
        </div>

        {/* Confirmation Actions — visible only to registered users */}
        {isRegisteredUser ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Is this hazard still on the road?
              </span>
              {!stats.userCanConfirm && (
                <span className="text-[10px] text-amber-600 font-medium">
                  24h cooldown active
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                id="confirm-still-there-btn"
                data-testid="confirm-still-there-btn"
                type="button"
                disabled={isSubmitting || !stats.userCanConfirm}
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
                data-testid="confirm-resolved-btn"
                type="button"
                disabled={isSubmitting || !stats.userCanConfirm}
                onClick={() => handleConfirm('resolved')}
                className={`py-2.5 px-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border shadow-sm ${
                  stats.userConfirmation === 'resolved'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300 active:scale-[0.98]'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>{isSubmitting ? 'Submitting...' : 'Resolved'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Confirmations update crowdsourced safety maps and decay stale hazards automatically.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 font-medium text-slate-700 text-xs">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Sign In Required to Corroborate
            </div>
            <p className="text-[11px] text-slate-500">
              Only registered passengers and SACCO operators can confirm or report road hazards resolved.
            </p>
          </div>
        )}

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
