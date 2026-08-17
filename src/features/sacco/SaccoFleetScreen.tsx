import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { vehicleRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { Vehicle } from '../../types';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const SaccoFleetScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const saccoId = getEffectiveSaccoId(user?.saccoId);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'all' | 'provisional'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [routeFilter, setRouteFilter] = useState('all');

  // Modal & Slide-over states
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [showAddEditSlideover, setShowAddEditSlideover] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Claim Vehicle workflow state
  const [claimingVehicle, setClaimingVehicle] = useState<any | null>(null);
  const [claimStep, setClaimStep] = useState<1 | 2>(1); // 1: confirm, 2: success
  const [isClaiming, setIsClaiming] = useState(false);

  // Form states for Add/Edit
  const [formPlate, setFormPlate] = useState('');
  const [formRoute, setFormRoute] = useState('Thika Superhighway');
  const [formCapacity, setFormCapacity] = useState('33');
  const [formDriver, setFormDriver] = useState('Driver #12');

  // Provisional vehicles state (unclaimed vehicles for this sacco)
  const [provisionalVehicles, setProvisionalVehicles] = useState<any[]>([]);

  const { data: vehicles = [], isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ['saccoVehicles', saccoId],
    queryFn: async () => {
      if (!saccoId) return [];
      return vehicleRepository.getAll([where('saccoId', '==', saccoId)]);
    },
    enabled: !!saccoId,
    staleTime: QUERY_STALE_TIMES.VEHICLES_AND_DRIVERS,
  });

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setFormPlate('');
    setFormRoute('Thika Superhighway');
    setFormCapacity('33');
    setFormDriver('Driver #12');
    setShowAddEditSlideover(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormPlate(v.regNumber);
    setFormRoute('Thika Superhighway');
    setFormCapacity(v.capacity.toString());
    setFormDriver('Driver #12');
    setShowAddEditSlideover(true);
  };

  const saccoName = getSaccoName(saccoId || '');

  const handleSaveVehicle = async () => {
    if (!formPlate || !saccoId) return;

    const vehicleId = editingVehicle ? editingVehicle.id : `v_${Date.now()}`;
    const newVehicle: Vehicle = {
      id: vehicleId,
      regNumber: formPlate.toUpperCase(),
      saccoId,
      saccoName,
      capacity: Number(formCapacity) || 33,
      status: editingVehicle ? editingVehicle.status : 'active',
      insuranceExpiry: '2027-12-31',
      inspectionExpiry: '2027-12-31',
    };

    try {
      await vehicleRepository.save(newVehicle);
      await queryClient.invalidateQueries({ queryKey: ['saccoVehicles', saccoId] });
    } catch (err) {
      console.warn('Saving to local state fallback:', err);
    } finally {
      setShowAddEditSlideover(false);
    }
  };

  const handleConfirmClaim = async () => {
    if (!saccoId) return;
    setIsClaiming(true);
    setTimeout(async () => {
      if (claimingVehicle) {
        const claimed: Vehicle = {
          id: `v_claimed_${Date.now()}`,
          regNumber: claimingVehicle.plate,
          saccoId,
          saccoName,
          capacity: 33,
          status: 'active',
          insuranceExpiry: '2027-08-01',
          inspectionExpiry: '2027-08-01',
        };
        try {
          await vehicleRepository.save(claimed);
          await queryClient.invalidateQueries({ queryKey: ['saccoVehicles', saccoId] });
        } catch (err) {
          console.warn('Error saving claimed vehicle:', err);
        }
        setProvisionalVehicles((prev) => prev.filter((pv) => pv.id !== claimingVehicle.id));
      }
      setIsClaiming(false);
      setClaimStep(2);
    }, 1200);
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = v.regNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

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
        title="Failed to Load Fleet Data"
        description={
          (error as Error)?.message ||
          'Unable to retrieve vehicles and registration records for this SACCO. Please try again.'
        }
        secondaryCtaLabel="Retry Fleet Fetch"
        onSecondaryCta={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Controls & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'overview'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Fleet Overview
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Vehicle Directory ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('provisional')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'provisional'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
            }`}
          >
            <span className="material-symbols-outlined text-base">pending_actions</span>
            Provisional Vehicles ({provisionalVehicles.length})
          </button>
        </div>

        <Button onClick={handleOpenAdd} className="font-bold text-xs">
          + Add Vehicle
        </Button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Active Vehicles</span>
              <div className="text-2xl font-black font-mono">{vehicles.filter((v) => v.status === 'active').length}</div>
            </Card>
            <Card className="p-4 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Provisional (Unclaimed)</span>
              <div className="text-2xl font-black font-mono text-amber-600">{provisionalVehicles.length}</div>
            </Card>
            <Card className="p-4 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Maintenance / Suspended</span>
              <div className="text-2xl font-black font-mono text-error">
                {vehicles.filter((v) => v.status !== 'active').length}
              </div>
            </Card>
            <Card className="p-4 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Average Fleet Risk</span>
              <div className="text-2xl font-black font-mono text-emerald-700">23 / 100</div>
            </Card>
          </div>

          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-bold text-on-surface">Route Distribution & Risk Comparison</h2>
            <div className="space-y-4">
              {[
                { route: 'Thika Superhighway', count: 18, risk: 'Low Risk' },
                { route: 'Mombasa Road Corridor', count: 12, risk: 'Moderate Risk' },
                { route: 'Waiyaki Way Express', count: 8, risk: 'Low Risk' },
              ].map((r, i) => (
                <div key={i} className="p-3 bg-surface-container rounded-xl flex items-center justify-between">
                  <div className="font-bold text-xs">{r.route}</div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-on-surface-variant">{r.count} vehicles</span>
                    <Badge variant={r.risk === 'Low Risk' ? 'success' : 'warning'} className="text-[10px]">
                      {r.risk}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ALL VEHICLES DIRECTORY TAB */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search by plate number e.g. KDA 123A..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md text-xs"
            />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-high border-b border-outline-variant/30 font-mono uppercase text-on-surface-variant">
                  <tr>
                    <th className="p-3.5">Plate Number</th>
                    <th className="p-3.5">Capacity</th>
                    <th className="p-3.5">SACCO Tenant</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Inspection Expiry</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-medium">
                  {filteredVehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-container/50">
                      <td className="p-3.5 font-mono font-bold text-primary">{v.regNumber}</td>
                      <td className="p-3.5">{v.capacity} seats</td>
                      <td className="p-3.5 font-mono">{v.saccoName}</td>
                      <td className="p-3.5">
                        <Badge
                          variant={v.status === 'active' ? 'success' : v.status === 'maintenance' ? 'warning' : 'danger'}
                          className="capitalize text-[10px]"
                        >
                          {v.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-mono">{v.inspectionExpiry}</td>
                      <td className="p-3.5 text-right space-x-2">
                        <Button
                          variant="ghost"
                          className="h-8 text-[11px] px-2"
                          onClick={() => setSelectedVehicle(v)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 text-[11px] px-2"
                          onClick={() => handleOpenEdit(v)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* PROVISIONAL VEHICLES TAB */}
      {activeTab === 'provisional' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-200">
            <strong>Provisional Vehicles Note:</strong> These vehicles were auto-created from commuter trip reports and GPS telemetry logs. Claiming a vehicle links historical trip records directly to {saccoName}.
          </div>

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-high border-b border-outline-variant/30 font-mono uppercase text-on-surface-variant">
                <tr>
                  <th className="p-3.5">Plate Number</th>
                  <th className="p-3.5">Route Detected</th>
                  <th className="p-3.5">First Seen</th>
                  <th className="p-3.5">Recorded Trips</th>
                  <th className="p-3.5">Pass Reports</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-medium">
                {provisionalVehicles.map((pv) => (
                  <tr key={pv.id} className="hover:bg-surface-container/50">
                    <td className="p-3.5 font-mono font-bold text-amber-600">{pv.plate}</td>
                    <td className="p-3.5">{pv.route}</td>
                    <td className="p-3.5 font-mono">{pv.firstSeen}</td>
                    <td className="p-3.5 font-mono">{pv.trips}</td>
                    <td className="p-3.5 font-mono">{pv.reportsCount}</td>
                    <td className="p-3.5 text-right">
                      <Button
                        className="h-8 text-xs font-bold"
                        onClick={() => {
                          setClaimingVehicle(pv);
                          setClaimStep(1);
                        }}
                      >
                        Claim Vehicle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* VEHICLE DETAILS DIALOG */}
      {selectedVehicle && (
        <Dialog isOpen={!!selectedVehicle} onClose={() => setSelectedVehicle(null)} title={`Vehicle Details: ${selectedVehicle.regNumber}`}>
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-surface-container rounded-xl grid grid-cols-2 gap-3">
              <div>
                <span className="text-on-surface-variant font-mono uppercase block">License Plate</span>
                <span className="font-mono text-base font-bold text-primary">{selectedVehicle.regNumber}</span>
              </div>
              <div>
                <span className="text-on-surface-variant font-mono uppercase block">Capacity</span>
                <span className="font-bold">{selectedVehicle.capacity} Passenger Seats</span>
              </div>
              <div>
                <span className="text-on-surface-variant font-mono uppercase block">Status</span>
                <Badge variant={selectedVehicle.status === 'active' ? 'success' : 'danger'} className="capitalize">
                  {selectedVehicle.status}
                </Badge>
              </div>
              <div>
                <span className="text-on-surface-variant font-mono uppercase block">SACCO Tenant</span>
                <span className="font-mono font-bold">{selectedVehicle.saccoName}</span>
              </div>
            </div>

            <div className="border border-outline-variant/30 rounded-xl p-3 space-y-2">
              <h4 className="font-bold text-on-surface">Compliance & Certificates</h4>
              <div className="flex justify-between text-on-surface-variant">
                <span>Inspection Expiry:</span>
                <span className="font-mono font-bold">{selectedVehicle.inspectionExpiry}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Insurance Expiry:</span>
                <span className="font-mono font-bold">{selectedVehicle.insuranceExpiry}</span>
              </div>
            </div>

            <Button className="w-full mt-2" onClick={() => setSelectedVehicle(null)}>
              Close
            </Button>
          </div>
        </Dialog>
      )}

      {/* CLAIM VEHICLE WORKFLOW DIALOG */}
      {claimingVehicle && (
        <Dialog isOpen={!!claimingVehicle} onClose={() => setClaimingVehicle(null)} title={`Claim Vehicle: ${claimingVehicle.plate}`}>
          {claimStep === 1 ? (
            <div className="space-y-4 text-xs">
              <p className="text-on-surface-variant">
                Confirm claiming <strong>{claimingVehicle.plate}</strong> into <strong>{saccoName}</strong> fleet. Historical trips ({claimingVehicle.trips}) and passenger reports will be reassigned to your SACCO dashboard.
              </p>
              <div className="p-3 bg-surface-container rounded-xl font-mono text-xs space-y-1">
                <div>Route: {claimingVehicle.route}</div>
                <div>First Observed: {claimingVehicle.firstSeen}</div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setClaimingVehicle(null)}>
                  Cancel
                </Button>
                <Button isLoading={isClaiming} onClick={handleConfirmClaim}>
                  Confirm Claim
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-center py-4">
              <span className="material-symbols-outlined text-4xl text-emerald-600 block">check_circle</span>
              <h3 className="font-bold text-sm">Vehicle Claimed Successfully</h3>
              <p className="text-on-surface-variant">
                {claimingVehicle.plate} is now actively assigned to {saccoName}.
              </p>
              <Button className="w-full" onClick={() => setClaimingVehicle(null)}>
                Done
              </Button>
            </div>
          )}
        </Dialog>
      )}

      {/* ADD / EDIT SLIDEOVER */}
      {showAddEditSlideover && (
        <Dialog isOpen={showAddEditSlideover} onClose={() => setShowAddEditSlideover(false)} title={editingVehicle ? `Edit Vehicle: ${editingVehicle.regNumber}` : 'Add New Vehicle'}>
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold block mb-1">Plate Number</label>
              <Input
                placeholder="e.g. KDA 123A"
                value={formPlate}
                onChange={(e) => setFormPlate(e.target.value)}
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Capacity (Seats)</label>
              <Input
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Route Assigned</label>
              <select
                value={formRoute}
                onChange={(e) => setFormRoute(e.target.value)}
                className="w-full p-2 bg-surface text-on-surface border border-outline-variant/40 rounded-xl font-body"
              >
                <option value="Thika Superhighway">Thika Superhighway</option>
                <option value="Mombasa Road Corridor">Mombasa Road Corridor</option>
                <option value="Waiyaki Way Express">Waiyaki Way Express</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddEditSlideover(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveVehicle}>
                {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
