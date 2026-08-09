import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { driverRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { Driver } from '../../types';

export const SaccoDriversScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Driver Form state
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [assignedVehicleReg, setAssignedVehicleReg] = useState('');

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const docs = await driverRepository.getAll([where('saccoId', '==', saccoId)]);
      if (docs.length > 0) {
        setDrivers(docs);
      } else {
        const defaults: Driver[] = saccoId === 'sacco_greenline' ? [
          { id: 'd_gl_1', name: 'Driver #201', licenseNumber: 'DL-GL8812', saccoId: 'sacco_greenline', assignedVehicleReg: 'KDC 101G', routeName: 'Waiyaki Way', status: 'active', safetyScore: 94, totalTrips: 120, totalViolations: 1 },
          { id: 'd_gl_2', name: 'Driver #202', licenseNumber: 'DL-GL9931', saccoId: 'sacco_greenline', assignedVehicleReg: 'KDC 202G', routeName: 'Thika Road', status: 'active', safetyScore: 89, totalTrips: 98, totalViolations: 2 },
        ] : [
          { id: 'd_ml_1', name: 'Driver #22', licenseNumber: 'DL-ML1234', saccoId: 'sacco_metrolink', assignedVehicleReg: 'KDA 123A', routeName: 'Thika Superhighway', status: 'active', safetyScore: 92, totalTrips: 340, totalViolations: 3 },
          { id: 'd_ml_2', name: 'Driver #45', licenseNumber: 'DL-ML5678', saccoId: 'sacco_metrolink', assignedVehicleReg: 'KCB 450Z', routeName: 'Mombasa Road', status: 'active', safetyScore: 88, totalTrips: 210, totalViolations: 5 },
          { id: 'd_ml_3', name: 'Driver #10', licenseNumber: 'DL-ML9012', saccoId: 'sacco_metrolink', assignedVehicleReg: 'KCC 789X', routeName: 'Ngong Road', status: 'suspended', safetyScore: 61, totalTrips: 150, totalViolations: 14 },
        ];
        setDrivers(defaults);
      }
    } catch (err) {
      console.warn('Error loading drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, [saccoId]);

  const handleAddDriver = async () => {
    if (!name || !licenseNumber) return;
    const newDriver: Driver = {
      id: `d_${Date.now()}`,
      name,
      licenseNumber,
      saccoId,
      phone: phone || '+254 700 000 000',
      assignedVehicleReg: assignedVehicleReg || 'Unassigned',
      routeName: 'Thika Road',
      status: 'active',
      safetyScore: 100,
      totalTrips: 0,
      totalViolations: 0,
    };

    try {
      await driverRepository.save(newDriver);
      await loadDrivers();
    } catch (err) {
      setDrivers([...drivers, newDriver]);
    } finally {
      setShowAddModal(false);
      setName('');
      setLicenseNumber('');
      setPhone('');
      setAssignedVehicleReg('');
    }
  };

  const filtered = drivers.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Driver Directory — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">NTSA certified drivers registered under {saccoName}</p>
        </div>

        <Button onClick={() => setShowAddModal(true)} className="font-bold text-xs">
          + Add Driver
        </Button>
      </div>

      <Input
        placeholder="Search driver name, license number..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-md text-xs"
      />

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <Card
            key={d.id}
            className="p-5 space-y-4 hover:border-primary/50 transition-all cursor-pointer"
            onClick={() => setSelectedDriver(d)}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center font-bold text-base">
                {d.name.replace(/[^0-9]/g, '') || d.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-sm text-on-surface">{d.name}</h3>
                <span className="font-mono text-xs text-on-surface-variant block">{d.licenseNumber}</span>
              </div>
              <Badge
                variant={d.status === 'active' ? 'success' : 'danger'}
                className="ml-auto text-[10px] capitalize"
              >
                {d.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-outline-variant/20">
              <div>
                <span className="text-on-surface-variant text-[10px] uppercase font-mono block">Vehicle</span>
                <span className="font-mono font-bold">{d.assignedVehicleReg || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant text-[10px] uppercase font-mono block">Safety Score</span>
                <span
                  className={`font-mono font-bold ${
                    d.safetyScore > 80 ? 'text-emerald-700' : 'text-error'
                  }`}
                >
                  {d.safetyScore} / 100
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* DRIVER PROFILE MODAL */}
      {selectedDriver && (
        <Dialog isOpen={!!selectedDriver} onClose={() => setSelectedDriver(null)} title={`Driver Profile: ${selectedDriver.name}`}>
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
              <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-black text-xl">
                {selectedDriver.name.replace(/[^0-9]/g, '') || 'D'}
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-base">{selectedDriver.name}</h3>
                <p className="font-mono text-on-surface-variant">{selectedDriver.licenseNumber}</p>
                <Badge variant={selectedDriver.status === 'active' ? 'success' : 'danger'}>
                  {selectedDriver.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-surface-container rounded-xl">
                <span className="text-[10px] font-mono text-on-surface-variant uppercase block">Total Trips</span>
                <span className="font-mono text-lg font-bold">{selectedDriver.totalTrips || 0}</span>
              </div>
              <div className="p-3 bg-surface-container rounded-xl">
                <span className="text-[10px] font-mono text-on-surface-variant uppercase block">Violations</span>
                <span className="font-mono text-lg font-bold text-amber-600">{selectedDriver.totalViolations || 0}</span>
              </div>
              <div className="p-3 bg-surface-container rounded-xl">
                <span className="text-[10px] font-mono text-on-surface-variant uppercase block">Safety Score</span>
                <span className="font-mono text-lg font-bold text-emerald-700">{selectedDriver.safetyScore}/100</span>
              </div>
            </div>

            <Button className="w-full mt-2" onClick={() => setSelectedDriver(null)}>
              Close Profile
            </Button>
          </div>
        </Dialog>
      )}

      {/* ADD DRIVER DIALOG */}
      {showAddModal && (
        <Dialog isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register New SACCO Driver">
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold block mb-1">Driver Name / Identifier</label>
              <Input placeholder="e.g. Driver #88 or John Kamau" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="font-bold block mb-1">DL Number (NTSA)</label>
              <Input placeholder="e.g. DL-1029384" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
            </div>
            <div>
              <label className="font-bold block mb-1">Phone Number</label>
              <Input placeholder="+254 7..." value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="font-bold block mb-1">Assigned Vehicle Reg</label>
              <Input placeholder="e.g. KDA 123A" value={assignedVehicleReg} onChange={(e) => setAssignedVehicleReg(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleAddDriver}>Save Driver</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
