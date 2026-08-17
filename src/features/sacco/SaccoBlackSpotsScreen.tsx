import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { blackSpotRepository } from '../../repositories';
import { BlackSpot } from '../../types';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const SaccoBlackSpotsScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const saccoId = getEffectiveSaccoId(user?.saccoId);
  const queryClient = useQueryClient();

  const [selectedSpot, setSelectedSpot] = useState<BlackSpot | null>(null);

  const { data: spots = [], isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ['blackSpots'],
    queryFn: async () => {
      return blackSpotRepository.getAll();
    },
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  const handleUpdateStatus = async (id: string, newStatus: 'published' | 'rejected') => {
    try {
      await blackSpotRepository.update(id, { status: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['blackSpots'] });
    } catch (err) {
      console.warn('Update spot status fallback:', err);
    }
    setSelectedSpot(null);
  };

  if (!saccoId) {
    return (
      <EmptyState
        icon="error"
        title="Account Not Fully Provisioned"
        description="Your account is missing a SACCO assignment. Contact your administrator."
      />
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="error"
        title="Failed to Load Hazard Reports"
        description={
          (error as Error)?.message ||
          'Unable to retrieve black spot and commuter hazard submissions from the database. Please try again.'
        }
        secondaryCtaLabel="Retry Sync"
        onSecondaryCta={() => refetch()}
      />
    );
  }

  const saccoName = getSaccoName(saccoId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Black Spot Moderation Queue</h1>
          <p className="text-xs text-on-surface-variant">Review passenger commuter safety hazard reports on {saccoName} transit corridors</p>
        </div>

        <Badge variant="neutral" className="font-mono text-xs">
          Moderator: {user?.displayName || 'SACCO Official'}
        </Badge>
      </div>

      {spots.length === 0 ? (
        <EmptyState
          icon="check_circle"
          title="No Hazard Reports Pending"
          description="There are currently no commuter hazard submissions or black spots awaiting moderation on your routes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spots.map((spot) => (
            <Card key={spot.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <Badge
                    variant={spot.severity === 'critical' ? 'danger' : spot.severity === 'high' ? 'warning' : 'neutral'}
                    className="uppercase text-[10px] mb-1"
                  >
                    {spot.hazardType || 'Hazard'}
                  </Badge>
                  <h3 className="font-bold text-sm text-on-surface">{spot.name}</h3>
                  <span className="text-xs font-mono text-on-surface-variant">{spot.routeName}</span>
                </div>
                <Badge variant={spot.status === 'published' ? 'success' : spot.status === 'rejected' ? 'danger' : 'warning'}>
                  {(spot.status || 'pending').toUpperCase()}
                </Badge>
              </div>

              <p className="text-xs text-on-surface-variant line-clamp-2">{spot.hazardDescription}</p>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-outline-variant/20 font-mono">
                <span>{spot.corroborationCount || 1} Corroborations</span>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedSpot(spot)}>
                  Review Hazard
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedSpot && (
        <Dialog isOpen={!!selectedSpot} onClose={() => setSelectedSpot(null)} title="Hazard Moderation Review">
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-surface-container rounded-xl space-y-2">
              <Badge variant="danger" className="uppercase font-mono text-[10px]">
                {selectedSpot.hazardType || 'Hazard'}
              </Badge>
              <h3 className="font-bold text-sm">{selectedSpot.name}</h3>
              <p className="text-on-surface-variant">{selectedSpot.hazardDescription}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] p-3 border border-outline-variant/30 rounded-xl">
              <div>Route: {selectedSpot.routeName}</div>
              <div>Corroborations: {selectedSpot.corroborationCount}</div>
              <div>Lat: {selectedSpot.latitude}</div>
              <div>Lng: {selectedSpot.longitude}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="border-error text-error hover:bg-error/10" onClick={() => handleUpdateStatus(selectedSpot.id, 'rejected')}>
                Reject Report
              </Button>
              <Button onClick={() => handleUpdateStatus(selectedSpot.id, 'published')}>
                Publish to Safety Map
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
