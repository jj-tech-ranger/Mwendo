import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { saccoRepository, auditLogRepository } from '../../repositories';
import { SACCO } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminSaccosScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [saccos, setSaccos] = useState<SACCO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [saccoToSuspend, setSaccoToDelete] = useState<SACCO | null>(null);
  const [saccoToVerify, setSaccoToVerify] = useState<SACCO | null>(null);

  // Form State
  const [newSacco, setNewSacco] = useState({
    name: '',
    registrationCode: '',
    fleetCount: 15,
    contactPhone: '+254',
    contactEmail: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSaccos();
  }, []);

  async function loadSaccos() {
    setIsLoading(true);
    try {
      const fetched = await saccoRepository.getAll();
      setSaccos(fetched);
    } catch (err) {
      console.error('Failed to load SACCOs:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle Register New SACCO
  async function handleRegisterSacco(e: React.FormEvent) {
    e.preventDefault();
    if (!newSacco.name || !newSacco.registrationCode) return;
    setIsSubmitting(true);

    const created: SACCO = {
      id: `sacco-${Date.now()}`,
      name: newSacco.name,
      registrationCode: newSacco.registrationCode,
      fleetCount: Number(newSacco.fleetCount),
      safetyScore: 85, // initial default
      contactPhone: newSacco.contactPhone,
      contactEmail: newSacco.contactEmail,
      status: 'active',
    };

    try {
      await saccoRepository.save(created);
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: created.id,
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: 'REGISTER_NEW_SACCO',
        target: `${created.name} (${created.registrationCode})`,
        timestamp: new Date().toISOString(),
      });

      setSaccos((prev) => [created, ...prev]);
      setShowRegisterModal(false);
      setToastMsg(`Successfully registered ${created.name}.`);
    } catch (err) {
      console.error('Failed to register SACCO:', err);
      alert('Error registering SACCO.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle Verify SACCO
  async function handleVerifySacco(sacco: SACCO) {
    setIsSubmitting(true);
    try {
      await saccoRepository.update(sacco.id, { status: 'active' });
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: sacco.id,
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: 'APPROVE_SACCO_VERIFICATION',
        target: `${sacco.name}`,
        timestamp: new Date().toISOString(),
      });

      setSaccos((prev) =>
        prev.map((s) => (s.id === sacco.id ? { ...s, status: 'active' } : s))
      );
      setToastMsg(`${sacco.name} verified and activated.`);
      setSaccoToVerify(null);
    } catch (err) {
      console.error('Failed to verify SACCO:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = saccos.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.registrationCode.toLowerCase().includes(q) ||
      s.contactEmail.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingSaccos = saccos.filter((s) => s.status === 'under_review');

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Public Transport SACCO Registry
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            NTSA-compliant SACCO licensing, fleet verification, and status monitoring.
          </p>
        </div>

        <Button variant="primary" className="gap-2" onClick={() => setShowRegisterModal(true)}>
          <span className="material-symbols-outlined text-lg">domain_add</span>
          Register New SACCO
        </Button>
      </div>

      {toastMsg && (
        <div className="p-md rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-body-sm text-xs flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-outline">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Pending Verification Callout */}
      {pendingSaccos.length > 0 && (
        <div className="p-md rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
              <span className="material-symbols-outlined text-base">pending_actions</span>
              <span>Pending Compliance Verification Queue ({pendingSaccos.length})</span>
            </div>
          </div>
          {pendingSaccos.map((s) => (
            <div key={s.id} className="p-2 rounded-xl bg-surface-container-lowest border border-amber-500/30 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-on-surface">{s.name}</span>
                <span className="font-label-mono text-[10px] text-outline ml-2">{s.registrationCode}</span>
              </div>
              <Button size="sm" variant="primary" onClick={() => handleVerifySacco(s)}>
                Approve Verification
              </Button>
            </div>
          ))}
        </div>
      )}

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
            placeholder="Search SACCO name or Reg code..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
        >
          <option value="all">All SACCO Statuses</option>
          <option value="active">Active Only</option>
          <option value="under_review">Under Review</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md">SACCO Entity</th>
                <th className="p-md">Reg Code</th>
                <th className="p-md">Fleet Size</th>
                <th className="p-md">Safety Rating</th>
                <th className="p-md">Contact Info</th>
                <th className="p-md">Status</th>
                <th className="p-md text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container/50">
                  <td className="p-md font-bold text-on-surface">{s.name}</td>
                  <td className="p-md font-label-mono text-[10px] text-outline">{s.registrationCode}</td>
                  <td className="p-md font-label-mono font-bold text-xs">{s.fleetCount} Matatus</td>
                  <td className="p-md">
                    <span className={`font-label-mono font-bold ${s.safetyScore >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {s.safetyScore} / 100
                    </span>
                  </td>
                  <td className="p-md text-on-surface-variant">
                    <p>{s.contactEmail}</p>
                    <p className="font-label-mono text-[10px] text-outline">{s.contactPhone}</p>
                  </td>
                  <td className="p-md">
                    {s.status === 'active' && <Badge variant="success">Active</Badge>}
                    {s.status === 'under_review' && <Badge variant="warning">Under Review</Badge>}
                    {s.status === 'suspended' && <Badge variant="danger">Suspended</Badge>}
                  </td>
                  <td className="p-md text-right space-x-1">
                    {s.status === 'under_review' && (
                      <Button size="sm" variant="primary" onClick={() => handleVerifySacco(s)}>
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register SACCO Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <form
            onSubmit={handleRegisterSacco}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg max-w-md w-full space-y-md shadow-2xl"
          >
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">domain_add</span>
              Register New Transport SACCO
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  SACCO Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kenya Bus Service"
                  value={newSacco.name}
                  onChange={(e) => setNewSacco({ ...newSacco, name: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface"
                />
              </div>

              <div>
                <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  NTSA Registration Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NTSA/SACCO/2026/101"
                  value={newSacco.registrationCode}
                  onChange={(e) => setNewSacco({ ...newSacco, registrationCode: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono"
                />
              </div>

              <div>
                <label className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Official Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="info@sacco.co.ke"
                  value={newSacco.contactEmail}
                  onChange={(e) => setNewSacco({ ...newSacco, contactEmail: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <Button variant="outline" onClick={() => setShowRegisterModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register SACCO'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
