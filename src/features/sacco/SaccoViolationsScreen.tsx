import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { violationRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { Violation } from '../../types';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const SaccoViolationsScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const saccoId = getEffectiveSaccoId(user?.saccoId);

  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: violations = [], isLoading: loading } = useQuery({
    queryKey: ['saccoViolations', saccoId],
    queryFn: async () => {
      if (!saccoId) return [];
      return violationRepository.getAll([where('saccoId', '==', saccoId)]);
    },
    enabled: !!saccoId,
    staleTime: QUERY_STALE_TIMES.SAFETY_ALERTS,
  });

  const filtered = violations.filter(
    (v) =>
      v.vehicleRegNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.violationId && v.violationId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!saccoId) {
    return (
      <EmptyState
        icon="error"
        title="Account Not Fully Provisioned"
        description="Your account is missing a SACCO assignment. Contact your administrator."
      />
    );
  }

  const saccoName = getSaccoName(saccoId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Violation Management — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">Automatic GPS speed telemetry and passenger corroboration logs</p>
        </div>

        <Badge variant="neutral" className="font-mono text-xs">
          Tenant: {saccoId}
        </Badge>
      </div>

      <Input
        placeholder="Filter by plate number or violation ID..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-md text-xs"
      />

      {/* Table of Violations */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-container-high border-b border-outline-variant/30 font-mono uppercase text-on-surface-variant">
            <tr>
              <th className="p-3.5">Violation ID</th>
              <th className="p-3.5">Plate Number</th>
              <th className="p-3.5">Speed / Limit</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5">Severity</th>
              <th className="p-3.5">Corroborated</th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20 font-medium">
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-surface-container/50">
                <td className="p-3.5 font-mono text-primary font-bold">{v.violationId || v.id}</td>
                <td className="p-3.5 font-mono font-bold">{v.vehicleRegNumber}</td>
                <td className="p-3.5 font-mono text-error font-bold">
                  {v.recordedSpeedKmH} km/h <span className="text-on-surface-variant font-normal">/ {v.speedLimitKmH} limit</span>
                </td>
                <td className="p-3.5">{v.locationName || v.routeName}</td>
                <td className="p-3.5">
                  <Badge variant={v.severity === 'high' ? 'danger' : 'warning'} className="uppercase text-[10px]">
                    {v.severity}
                  </Badge>
                </td>
                <td className="p-3.5 font-mono">
                  {v.isCorroborated ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span> Yes
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">No</span>
                  )}
                </td>
                <td className="p-3.5 text-right">
                  <Button variant="ghost" className="h-8 text-[11px]" onClick={() => setSelectedViolation(v)}>
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* VIOLATION DETAILS MODAL */}
      <Dialog
        isOpen={!!selectedViolation}
        onClose={() => setSelectedViolation(null)}
        title={selectedViolation ? `Violation Report: ${selectedViolation.violationId || selectedViolation.id}` : 'Violation Report'}
      >
        {selectedViolation ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-surface-container rounded-xl grid grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-on-surface-variant uppercase text-[10px] block">Vehicle</span>
                <span className="font-bold text-primary text-sm">{selectedViolation.vehicleRegNumber}</span>
              </div>
              <div>
                <span className="text-on-surface-variant uppercase text-[10px] block">Driver</span>
                <span className="font-bold text-on-surface">{selectedViolation.driverName}</span>
              </div>
              <div>
                <span className="text-on-surface-variant uppercase text-[10px] block">Recorded Speed</span>
                <span className="font-bold text-error text-base">{selectedViolation.recordedSpeedKmH} km/h</span>
              </div>
              <div>
                <span className="text-on-surface-variant uppercase text-[10px] block">Allowed Limit</span>
                <span className="font-bold text-on-surface text-base">{selectedViolation.speedLimitKmH} km/h</span>
              </div>
            </div>

            <div className="p-3 border border-outline-variant/30 rounded-xl space-y-1">
              <span className="font-bold block">GPS Location Pin</span>
              <p className="text-on-surface-variant">{selectedViolation.locationName}</p>
              <div className="text-[10px] font-mono text-primary font-bold pt-1 flex items-center justify-between">
                <span>Verification Confidence: {Math.round((typeof selectedViolation.confidenceScore === 'number' ? selectedViolation.confidenceScore : 0.95) * 100)}%</span>
                <span className="text-on-surface-variant text-[9px] font-normal">
                  (Risk Weight: {(typeof selectedViolation.confidenceScore === 'number' ? selectedViolation.confidenceScore : 0.95).toFixed(2)}x)
                </span>
              </div>
            </div>

            <Button className="w-full mt-2" onClick={() => setSelectedViolation(null)}>
              Close
            </Button>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};
