import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { userRepository, auditLogRepository } from '../../repositories';
import { UserProfile } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminAuthoritiesScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [inspectors, setInspectors] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Inspector Form State
  const [newInspector, setNewInspector] = useState({
    displayName: '',
    email: '',
    badgeNumber: '',
    authorityScope: 'county' as 'national' | 'county',
    county: 'Nairobi',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadInspectors();
  }, []);

  async function loadInspectors() {
    setIsLoading(true);
    try {
      const allUsers = await userRepository.getAll();
      const authorityUsers = allUsers.filter((u) => u.role === 'authority');
      setInspectors(authorityUsers);
    } catch (err) {
      console.error('Failed to load inspectors:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddInspector(e: React.FormEvent) {
    e.preventDefault();
    if (!newInspector.displayName || !newInspector.email) return;
    setIsSubmitting(true);

    const created: UserProfile = {
      id: `auth-${Date.now()}`,
      uid: `uid-${Date.now()}`,
      email: newInspector.email,
      displayName: newInspector.displayName,
      role: 'authority',
      activeRole: 'authority',
      authorityScope: newInspector.authorityScope,
      county: newInspector.authorityScope === 'county' ? newInspector.county : undefined,
      badgeNumber: newInspector.badgeNumber || `NTSA-INS-${Math.floor(1000 + Math.random() * 9000)}`,
      isVerified: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await userRepository.save(created);
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: 'NTSA_AUTHORITY',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: 'PROVISION_AUTHORITY_ACCOUNT',
        target: `${created.displayName} (${created.badgeNumber}) - Scope: ${created.authorityScope}`,
        timestamp: new Date().toISOString(),
      });

      setInspectors((prev) => [created, ...prev]);
      setShowAddModal(false);
      setToastMsg(`Provisioned Authority Inspector account for ${created.displayName}.`);
    } catch (err) {
      console.error('Failed to add inspector:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filtered = inspectors.filter((i) => {
    if (scopeFilter === 'all') return true;
    return i.authorityScope === scopeFilter;
  });

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            NTSA & County Enforcement Authority Directory
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Provisioning & governance over national and county traffic safety inspectors.
          </p>
        </div>

        <Button variant="primary" className="gap-2" onClick={() => setShowAddModal(true)}>
          <span className="material-symbols-outlined text-lg">person_add</span>
          Provision Authority Account
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

      {/* Scope Filter */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex items-center justify-between">
        <label htmlFor="admin-authorities-scope-filter" className="font-label-mono text-xs text-on-surface-variant uppercase font-bold">
          Filter Jurisdiction Scope:
        </label>
        <select
          id="admin-authorities-scope-filter"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
        >
          <option value="all">All Jurisdictions</option>
          <option value="national">National Scope (NTSA HQ)</option>
          <option value="county">County Specific Enforcement</option>
        </select>
      </div>

      {/* Inspectors Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md">Inspector Name</th>
                <th className="p-md">Badge Number</th>
                <th className="p-md">Jurisdiction Scope</th>
                <th className="p-md">Assigned County</th>
                <th className="p-md">MFA Security</th>
                <th className="p-md">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((i) => (
                <tr key={i.id} className="hover:bg-surface-container/50">
                  <td className="p-md font-bold text-on-surface">
                    <p>{i.displayName}</p>
                    <p className="font-label-mono text-[10px] text-outline">{i.email}</p>
                  </td>

                  <td className="p-md font-label-mono text-xs font-bold text-primary">
                    {i.badgeNumber}
                  </td>

                  <td className="p-md">
                    <Badge variant={i.authorityScope === 'national' ? 'info' : 'warning'}>
                      {i.authorityScope === 'national' ? 'National HQ' : 'County Unit'}
                    </Badge>
                  </td>

                  <td className="p-md font-label-mono text-xs font-bold text-on-surface">
                    {i.county || 'All 47 Counties'}
                  </td>

                  <td className="p-md">
                    {i.isMfaEnrolled ? (
                      <span className="inline-flex items-center gap-1 font-label-mono text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="material-symbols-outlined text-xs">verified_user</span>
                        MFA: Configured (TOTP)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-label-mono text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <span className="material-symbols-outlined text-xs">gpp_maybe</span>
                        MFA: Mandatory (Pending)
                      </span>
                    )}
                  </td>

                  <td className="p-md">
                    <Badge variant="success">Active</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <form
            onSubmit={handleAddInspector}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg max-w-md w-full space-y-md shadow-2xl"
          >
            <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">policy</span>
              Provision Authority Inspector Account
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="inspector-name-input" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Inspector Name
                </label>
                <input
                  id="inspector-name-input"
                  type="text"
                  required
                  placeholder="e.g. Inspector John Kamau"
                  value={newInspector.displayName}
                  onChange={(e) => setNewInspector({ ...newInspector, displayName: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface"
                />
              </div>

              <div>
                <label htmlFor="inspector-email-input" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Official Email
                </label>
                <input
                  id="inspector-email-input"
                  type="email"
                  required
                  placeholder="inspector@ntsa.go.ke"
                  value={newInspector.email}
                  onChange={(e) => setNewInspector({ ...newInspector, email: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface"
                />
              </div>

              <div>
                <label htmlFor="inspector-badge-input" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Badge ID Number
                </label>
                <input
                  id="inspector-badge-input"
                  type="text"
                  placeholder="NTSA-INS-9901"
                  value={newInspector.badgeNumber}
                  onChange={(e) => setNewInspector({ ...newInspector, badgeNumber: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono"
                />
              </div>

              <div>
                <label htmlFor="inspector-scope-select" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                  Authority Jurisdiction Scope
                </label>
                <select
                  id="inspector-scope-select"
                  value={newInspector.authorityScope}
                  onChange={(e) =>
                    setNewInspector({
                      ...newInspector,
                      authorityScope: e.target.value as 'national' | 'county',
                    })
                  }
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono"
                >
                  <option value="county">County-Scoped Jurisdiction</option>
                  <option value="national">National Unrestricted Scope</option>
                </select>
              </div>

              {newInspector.authorityScope === 'county' && (
                <div>
                  <label htmlFor="inspector-county-select" className="font-label-mono text-[10px] uppercase font-bold text-on-surface-variant">
                    Assigned Kenya County
                  </label>
                  <select
                    id="inspector-county-select"
                    value={newInspector.county}
                    onChange={(e) => setNewInspector({ ...newInspector, county: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-label-mono"
                  >
                    <option value="Nairobi">Nairobi</option>
                    <option value="Nakuru">Nakuru</option>
                    <option value="Mombasa">Mombasa</option>
                    <option value="Kiambu">Kiambu</option>
                    <option value="Machakos">Machakos</option>
                    <option value="Kisumu">Kisumu</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Provisioning...' : 'Provision Account'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
