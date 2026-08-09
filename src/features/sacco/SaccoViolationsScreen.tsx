import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { violationRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { Violation } from '../../types';

export const SaccoViolationsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadViolations = async () => {
    setLoading(true);
    try {
      const docs = await violationRepository.getAll([where('saccoId', '==', saccoId)]);
      if (docs.length > 0) {
        setViolations(docs);
      } else {
        const defaults: Violation[] = saccoId === 'sacco_greenline' ? [
          {
            id: 'v_gl_1',
            violationId: 'VIO-9911',
            saccoId: 'sacco_greenline',
            vehicleRegNumber: 'KDC 202G',
            driverName: 'Driver #202',
            routeName: 'Mombasa Road',
            recordedSpeedKmH: 89,
            speedLimitKmH: 80,
            severity: 'high',
            confidenceScore: 0.96,
            isCorroborated: true,
            timestamp: new Date().toISOString(),
            status: 'pending',
            locationName: 'Mombasa Road near Cabanas',
          },
        ] : [
          {
            id: 'v_ml_1',
            violationId: 'VIO-8821',
            saccoId: 'sacco_metrolink',
            vehicleRegNumber: 'KCB 450Z',
            driverName: 'Driver #45',
            routeName: 'Thika Superhighway',
            recordedSpeedKmH: 94,
            speedLimitKmH: 80,
            severity: 'high',
            confidenceScore: 0.98,
            isCorroborated: true,
            timestamp: new Date().toISOString(),
            status: 'pending',
            locationName: 'Thika Road near Kasarani Stadium',
          },
          {
            id: 'v_ml_2',
            violationId: 'VIO-8822',
            saccoId: 'sacco_metrolink',
            vehicleRegNumber: 'KCC 789X',
            driverName: 'Driver #10',
            routeName: 'Ngong Road',
            recordedSpeedKmH: 72,
            speedLimitKmH: 50,
            severity: 'medium',
            confidenceScore: 0.92,
            isCorroborated: false,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            status: 'reviewed',
            locationName: 'Ngong Road near City Mortuary',
          },
        ];
        setViolations(defaults);
      }
    } catch (err) {
      console.warn('Error loading violations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadViolations();
  }, [saccoId]);

  const filtered = violations.filter(
    (v) =>
      v.vehicleRegNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.violationId && v.violationId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      {selectedViolation && (
        <Dialog isOpen={!!selectedViolation} onClose={() => setSelectedViolation(null)} title={`Violation Report: ${selectedViolation.violationId || selectedViolation.id}`}>
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
              <div className="text-[10px] font-mono text-primary font-bold pt-1">
                Telemetry Confidence: {Math.round((selectedViolation.confidenceScore || 0.95) * 100)}%
              </div>
            </div>

            <Button className="w-full mt-2" onClick={() => setSelectedViolation(null)}>
              Close
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
