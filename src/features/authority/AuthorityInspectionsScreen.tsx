import React, { useState, useEffect, useMemo } from 'react';
import { inspectionReportRepository, vehicleRepository, auditLogRepository } from '../../repositories';
import { InspectionReport, Vehicle } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';

export const AuthorityInspectionsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State for New Vehicle Inspection
  const [showModal, setShowModal] = useState(false);
  const [plate, setPlate] = useState('');
  const [saccoName, setSaccoName] = useState('MetroLink Express');
  const [county, setCounty] = useState(user?.county || 'Nairobi');
  const [speedGovernor, setSpeedGovernor] = useState<'valid' | 'tampered' | 'expired' | 'missing'>('valid');
  const [brakeStatus, setBrakeStatus] = useState<'pass' | 'fail'>('pass');
  const [tireStatus, setTireStatus] = useState<'pass' | 'fail'>('pass');
  const [overallResult, setOverallResult] = useState<'passed' | 'failed' | 'impounded' | 'suspended'>('passed');
  const [notes, setNotes] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inspections' | 'impounded'>('inspections');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [fetchedReports, fetchedVehicles] = await Promise.all([
          inspectionReportRepository.getAll(),
          vehicleRepository.getAll(),
        ]);
        if (isMounted) {
          setReports(fetchedReports);
          setVehicles(fetchedVehicles);
        }
      } catch (err) {
        console.error('Failed to load inspection data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((r) =>
      r.vehicleRegNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.saccoName && r.saccoName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.county.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reports, searchQuery]);

  const impoundedVehicles = useMemo(() => {
    return reports.filter((r) => r.overallResult === 'impounded' || r.overallResult === 'suspended');
  }, [reports]);

  // Handle Form Submit
  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate) {
      alert('Vehicle registration plate is required.');
      return;
    }

    const certNum = overallResult === 'passed' ? `NTSA-CERT-${Math.floor(100000 + Math.random() * 900000)}` : undefined;
    const expDate = overallResult === 'passed' ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0] : undefined;

    const newReport: InspectionReport = {
      id: `insp-${Date.now()}`,
      vehicleRegNumber: plate.toUpperCase(),
      saccoId: saccoName,
      saccoName: saccoName,
      inspectorId: user?.uid || 'inspector-01',
      inspectorName: user?.displayName || 'Inspector ' + (user?.badgeNumber || 'NTSA-882'),
      county: county,
      inspectionDate: new Date().toISOString(),
      speedGovernorStatus: speedGovernor,
      brakeStatus: brakeStatus,
      tireStatus: tireStatus,
      overallResult: overallResult,
      certificateNumber: certNum,
      expiryDate: expDate,
      notes: notes,
      createdAt: new Date().toISOString(),
    };

    try {
      await inspectionReportRepository.save(newReport);
      setReports((prev) => [newReport, ...prev]);

      // Write Audit Log
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: saccoName,
        actorName: user?.displayName || 'Inspector',
        actorRole: 'NTSA Inspector',
        action: `Logged Roadworthiness Inspection (${overallResult.toUpperCase()}) for ${plate.toUpperCase()}`,
        target: `Vehicle ${plate.toUpperCase()}`,
        timestamp: new Date().toISOString(),
      });

      setShowModal(false);
      setPlate('');
      setNotes('');
      setSuccessMsg(`Inspection recorded for ${newReport.vehicleRegNumber}. Result: ${overallResult.toUpperCase()}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to save inspection report:', err);
      alert('Error saving inspection report.');
    }
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md sm:p-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface">
            NTSA PSV Inspection & Roadworthiness Center
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Speed governor compliance audits, mechanical safety certificates, and impound registers
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setShowModal(true)} className="gap-2">
          <span className="material-symbols-outlined text-base">post_add</span>
          Log New Inspection
        </Button>
      </div>

      {successMsg && (
        <div className="p-md rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-label-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">fact_check</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm space-y-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/20 pb-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('inspections')}
              className={`px-4 py-2 rounded-xl font-label-bold text-xs transition-colors flex items-center gap-2 ${
                activeTab === 'inspections'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">fact_check</span>
              Inspection Register ({filteredReports.length})
            </button>
            <button
              onClick={() => setActiveTab('impounded')}
              className={`px-4 py-2 rounded-xl font-label-bold text-xs transition-colors flex items-center gap-2 ${
                activeTab === 'impounded'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">car_tag</span>
              Impounded & Suspended ({impoundedVehicles.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vehicle plate, SACCO..."
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface focus:outline-none"
            />
          </div>
        </div>

        {/* Tab 1: Inspection Register */}
        {activeTab === 'inspections' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant font-label-mono uppercase">
                  <th className="py-2.5 px-3">Plate Number</th>
                  <th className="py-2.5 px-3">SACCO Name</th>
                  <th className="py-2.5 px-3">County</th>
                  <th className="py-2.5 px-3">Speed Governor</th>
                  <th className="py-2.5 px-3">Brakes & Tires</th>
                  <th className="py-2.5 px-3">Overall Result</th>
                  <th className="py-2.5 px-3">Cert / Expiry</th>
                  <th className="py-2.5 px-3">Inspector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {filteredReports.length > 0 ? (
                  filteredReports.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low/50">
                      <td className="py-3 px-3 font-bold text-on-surface">{r.vehicleRegNumber}</td>
                      <td className="py-3 px-3 text-on-surface-variant">{r.saccoName || r.saccoId}</td>
                      <td className="py-3 px-3 font-label-mono">{r.county}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            r.speedGovernorStatus === 'valid'
                              ? 'success'
                              : r.speedGovernorStatus === 'tampered'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {r.speedGovernorStatus.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-label-mono text-[11px]">
                        Brakes: {r.brakeStatus.toUpperCase()} | Tires: {r.tireStatus.toUpperCase()}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            r.overallResult === 'passed'
                              ? 'success'
                              : r.overallResult === 'impounded' || r.overallResult === 'suspended'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {r.overallResult.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-label-mono text-outline">
                        {r.certificateNumber ? (
                          <div>
                            <div className="text-primary font-bold">{r.certificateNumber}</div>
                            <div className="text-[10px]">Exp: {r.expiryDate}</div>
                          </div>
                        ) : (
                          'No Certificate Issued'
                        )}
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant text-[11px]">
                        {r.inspectorName}
                      </td>
                    </tr>
                  ))
                ) : (
                  [
                    {
                      id: 'insp-1',
                      vehicleRegNumber: 'KCG 482B',
                      saccoName: 'MetroLink Express',
                      county: 'Nairobi',
                      speedGovernorStatus: 'valid' as const,
                      brakeStatus: 'pass' as const,
                      tireStatus: 'pass' as const,
                      overallResult: 'passed' as const,
                      certificateNumber: 'NTSA-CERT-884912',
                      expiryDate: '2027-08-08',
                      inspectorName: 'Inspector Omondi (NTSA-882)',
                    },
                    {
                      id: 'insp-2',
                      vehicleRegNumber: 'KDA 912Z',
                      saccoName: '2NK Sacco',
                      county: 'Kiambu',
                      speedGovernorStatus: 'tampered' as const,
                      brakeStatus: 'fail' as const,
                      tireStatus: 'pass' as const,
                      overallResult: 'impounded' as const,
                      inspectorName: 'Inspector Kamau (NTSA-410)',
                    },
                  ].map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low/50">
                      <td className="py-3 px-3 font-bold text-on-surface">{r.vehicleRegNumber}</td>
                      <td className="py-3 px-3 text-on-surface-variant">{r.saccoName}</td>
                      <td className="py-3 px-3 font-label-mono">{r.county}</td>
                      <td className="py-3 px-3">
                        <Badge variant={r.speedGovernorStatus === 'valid' ? 'success' : 'danger'}>
                          {r.speedGovernorStatus.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-label-mono text-[11px]">
                        Brakes: {r.brakeStatus.toUpperCase()} | Tires: {r.tireStatus.toUpperCase()}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={r.overallResult === 'passed' ? 'success' : 'danger'}>
                          {r.overallResult.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-label-mono text-outline">
                        {r.certificateNumber ? (
                          <div>
                            <div className="text-primary font-bold">{r.certificateNumber}</div>
                            <div className="text-[10px]">Exp: {r.expiryDate}</div>
                          </div>
                        ) : (
                          'No Certificate Issued'
                        )}
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant text-[11px]">
                        {r.inspectorName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Impounded Vehicles */}
        {activeTab === 'impounded' && (
          <div className="space-y-sm">
            {impoundedVehicles.length > 0 ? (
              impoundedVehicles.map((r) => (
                <div
                  key={r.id}
                  className="p-md rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-on-surface">{r.vehicleRegNumber}</span>
                      <Badge variant="danger">{r.overallResult.toUpperCase()}</Badge>
                    </div>
                    <p className="font-body-sm text-[11px] text-on-surface-variant">
                      SACCO: {r.saccoName} • County: {r.county} • Inspector Notes: {r.notes || 'Speed governor tampered during highway inspection'}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs">
                    Re-Inspect Vehicle
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-xl text-center text-on-surface-variant space-y-2">
                <span className="material-symbols-outlined text-3xl text-primary">verified</span>
                <p className="font-label-bold text-xs">No active impounded or suspended PSVs in this scope.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Inspection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-md">
          <form
            onSubmit={handleSaveInspection}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-lg w-full p-lg shadow-2xl space-y-md animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">post_add</span>
                <h3 className="font-headline-lg-mobile text-base text-on-surface">
                  Log NTSA Vehicle Inspection Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-sm text-xs font-body-sm">
              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label className="font-label-bold text-on-surface">Vehicle Registration Plate</label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="e.g. KCG 482B"
                    required
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono uppercase"
                  />
                </div>

                <div>
                  <label className="font-label-bold text-on-surface">SACCO / Operator</label>
                  <input
                    type="text"
                    value={saccoName}
                    onChange={(e) => setSaccoName(e.target.value)}
                    required
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label className="font-label-bold text-on-surface">Inspection County</label>
                  <select
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  >
                    <option value="Nairobi">Nairobi</option>
                    <option value="Kiambu">Kiambu</option>
                    <option value="Machakos">Machakos</option>
                    <option value="Nakuru">Nakuru</option>
                    <option value="Mombasa">Mombasa</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-bold text-on-surface">Speed Governor Unit</label>
                  <select
                    value={speedGovernor}
                    onChange={(e) => setSpeedGovernor(e.target.value as any)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
                  >
                    <option value="valid">Valid & Sealed</option>
                    <option value="tampered">Tampered / Bypass Detected</option>
                    <option value="expired">Calibration Expired</option>
                    <option value="missing">Missing / Not Installed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label className="font-label-bold text-on-surface">Braking System Check</label>
                  <select
                    value={brakeStatus}
                    onChange={(e) => setBrakeStatus(e.target.value as any)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none font-label-mono"
                  >
                    <option value="pass">Pass (Certified)</option>
                    <option value="fail">Fail (Defective)</option>
                  </select>
                </div>

                <div>
                  <label className="font-label-bold text-on-surface">Tire Tread Depth Check</label>
                  <select
                    value={tireStatus}
                    onChange={(e) => setTireStatus(e.target.value as any)}
                    className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none font-label-mono"
                  >
                    <option value="pass">Pass (&gt;1.6mm)</option>
                    <option value="fail">Fail (Worn)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-label-bold text-on-surface">Overall Inspection Finding</label>
                <select
                  value={overallResult}
                  onChange={(e) => setOverallResult(e.target.value as any)}
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface font-label-bold focus:outline-none"
                >
                  <option value="passed">PASSED (Issue Certificate)</option>
                  <option value="failed">FAILED (Repair Notice)</option>
                  <option value="impounded">IMPOUNDED (Immediate Road Removal)</option>
                  <option value="suspended">SUSPENDED (Route License Suspended)</option>
                </select>
              </div>

              <div>
                <label className="font-label-bold text-on-surface">Inspector Observations & Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mechanical findings, speed governor serial number, depot location..."
                  className="w-full mt-1 bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-on-surface focus:outline-none h-16"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-sm border-t border-outline-variant/20">
              <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Inspection Record
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
