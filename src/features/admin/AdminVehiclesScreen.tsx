import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { vehicleRepository, auditLogRepository } from '../../repositories';
import { Vehicle } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminVehiclesScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    setIsLoading(true);
    try {
      const fetched = await vehicleRepository.getAll();
      setVehicles(fetched);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleVehicleStatus(v: Vehicle) {
    const newStatus = v.status === 'active' ? 'suspended' : 'active';
    try {
      await vehicleRepository.update(v.id, { status: newStatus });
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: v.saccoId,
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: `CHANGE_VEHICLE_STATUS (${newStatus.toUpperCase()})`,
        target: `Vehicle Plate: ${v.regNumber}`,
        timestamp: new Date().toISOString(),
      });

      setVehicles((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error('Failed to change vehicle status:', err);
    }
  }

  const filtered = vehicles.filter((v) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      v.regNumber.toLowerCase().includes(q) ||
      v.saccoName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Vehicle & Fleet Explorer
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Cross-SACCO vehicle registry, speed governor compliance, and impound status.
          </p>
        </div>

        <Badge variant="info">{filtered.length} Vehicles Listed</Badge>
      </div>

      {/* Filter Row */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex flex-col md:flex-row gap-md items-center justify-between">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Plate Number or SACCO..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
        >
          <option value="all">All Vehicle Statuses</option>
          <option value="active">Active Only</option>
          <option value="maintenance">In Maintenance</option>
          <option value="suspended">Suspended / Impounded</option>
        </select>
      </div>

      {/* Vehicle Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md">Reg Plate Number</th>
                <th className="p-md">Assigned SACCO</th>
                <th className="p-md">Capacity</th>
                <th className="p-md">Insurance Expiry</th>
                <th className="p-md">Inspection Expiry</th>
                <th className="p-md">Status</th>
                <th className="p-md text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-surface-container/50">
                  <td className="p-md font-label-mono font-bold text-sm text-primary">
                    {v.regNumber}
                  </td>
                  <td className="p-md font-bold text-on-surface">{v.saccoName}</td>
                  <td className="p-md font-label-mono text-xs">{v.capacity} Passengers</td>
                  <td className="p-md font-label-mono text-[10px] text-outline">
                    {v.insuranceExpiry}
                  </td>
                  <td className="p-md font-label-mono text-[10px] text-outline">
                    {v.inspectionExpiry}
                  </td>
                  <td className="p-md">
                    {v.status === 'active' && <Badge variant="success">Active</Badge>}
                    {v.status === 'maintenance' && <Badge variant="warning">Maintenance</Badge>}
                    {v.status === 'suspended' && <Badge variant="danger">Suspended</Badge>}
                  </td>
                  <td className="p-md text-right">
                    <Button
                      size="sm"
                      variant={v.status === 'active' ? 'secondary' : 'primary'}
                      onClick={() => handleToggleVehicleStatus(v)}
                    >
                      {v.status === 'active' ? 'Suspend Vehicle' : 'Reactivate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
