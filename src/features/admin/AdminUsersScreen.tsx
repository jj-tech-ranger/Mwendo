import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { userRepository, auditLogRepository } from '../../repositories';
import { UserProfile, UserRole } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';

export const AdminUsersScreen: React.FC = () => {
  const { user: currentAdmin } = useAuthStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected User for Drawer/Detail
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Modal states
  const [userToSuspend, setUserToSuspend] = useState<UserProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('Repeated False Hazardous Reports');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const fetched = await userRepository.getAll();
      setUsers(fetched);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle Suspend / Unsuspend action
  async function handleToggleSuspend() {
    if (!userToSuspend) return;
    setIsSubmitting(true);
    setActionSuccess(null);

    const isSuspending = userToSuspend.isActive; // if currently active, we suspend
    const newStatus = !isSuspending;

    try {
      // 1. Live Firestore Update (updates real state)
      await userRepository.update(userToSuspend.id, {
        isActive: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // 2. Write Audit Log entry
      await auditLogRepository.save({
        id: `audit-${Date.now()}`,
        saccoId: userToSuspend.saccoId || 'PLATFORM_GLOBAL',
        actorName: currentAdmin?.displayName || 'System Admin',
        actorRole: 'admin',
        action: isSuspending ? `SUSPEND_USER (${suspendReason})` : 'UNSUSPEND_USER',
        target: `User ID: ${userToSuspend.id} (${userToSuspend.displayName})`,
        timestamp: new Date().toISOString(),
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userToSuspend.id ? { ...u, isActive: newStatus } : u
        )
      );

      setActionSuccess(
        isSuspending
          ? `User ${userToSuspend.displayName} has been suspended. Live status updated.`
          : `User ${userToSuspend.displayName} has been reactivated.`
      );
      setUserToSuspend(null);
    } catch (err) {
      console.error('Failed to toggle user suspension:', err);
      alert('Error updating user status. Please check connection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter logic
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      u.displayName.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.phoneNumber && u.phoneNumber.toLowerCase().includes(query)) ||
      u.id.toLowerCase().includes(query);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'suspended' && !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-lg">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform User Directory & Identity Management
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Cross-tenant governance over 52k+ accounts. All identity actions are audit-logged.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="info" className="py-1 px-3">
            {filteredUsers.length} Users Displayed
          </Badge>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-md rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-body-sm text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500">check_circle</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Search & Filters Row */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex flex-col md:flex-row gap-md items-center justify-between">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, email, or Passenger ID..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-sm w-full md:w-auto">
          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
          >
            <option value="all">All Roles</option>
            <option value="passenger">Passengers</option>
            <option value="sacco_official">SACCO Officials</option>
            <option value="sacco_manager">SACCO Managers</option>
            <option value="authority">Authorities (NTSA/County)</option>
            <option value="admin">System Admins</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface-container border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-label-mono"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md">Display Name / ID</th>
                <th className="p-md">Contact</th>
                <th className="p-md">Platform Role</th>
                <th className="p-md">Trust Score</th>
                <th className="p-md">Status</th>
                <th className="p-md">Joined Date</th>
                <th className="p-md text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container/50 transition-colors">
                  <td className="p-md font-bold text-on-surface">
                    <div>
                      <p>{u.displayName}</p>
                      <span className="font-label-mono text-[10px] text-outline">{u.id}</span>
                    </div>
                  </td>

                  <td className="p-md text-on-surface-variant">
                    <p>{u.email}</p>
                    <p className="font-label-mono text-[10px] text-outline">{u.phoneNumber || 'No phone'}</p>
                  </td>

                  <td className="p-md">
                    <span className="inline-flex items-center gap-1 font-label-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {u.role}
                    </span>
                  </td>

                  <td className="p-md">
                    <div className="flex items-center gap-1">
                      <span className="font-label-mono font-bold text-xs">{u.trustScore ?? 100}</span>
                      <span className="text-[10px] text-outline">/100</span>
                    </div>
                  </td>

                  <td className="p-md">
                    {u.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Suspended</Badge>
                    )}
                  </td>

                  <td className="p-md font-label-mono text-[10px] text-outline">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>

                  <td className="p-md text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedUser(u)}
                      title="View Details"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </Button>

                    <Button
                      size="sm"
                      variant={u.isActive ? 'secondary' : 'primary'}
                      onClick={() => setUserToSuspend(u)}
                    >
                      {u.isActive ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected User Details Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-md bg-surface-container-lowest border-l border-outline-variant/30 h-full p-lg overflow-y-auto space-y-md shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-md">
              <div>
                <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                  User Details
                </h3>
                <span className="font-label-mono text-xs text-outline">{selectedUser.id}</span>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-sm text-xs font-body-sm">
              <div className="p-md rounded-2xl bg-surface-container-low space-y-2">
                <p className="font-bold text-sm text-on-surface">{selectedUser.displayName}</p>
                <p className="text-on-surface-variant">{selectedUser.email}</p>
                <p className="font-label-mono text-outline">{selectedUser.phoneNumber}</p>

                <div className="pt-2 flex items-center gap-2">
                  <Badge variant={selectedUser.isActive ? 'success' : 'danger'}>
                    {selectedUser.isActive ? 'Active Status' : 'Suspended Status'}
                  </Badge>
                  <Badge variant="info">{selectedUser.role}</Badge>
                </div>
              </div>

              <div className="p-md rounded-2xl border border-outline-variant/20 space-y-2">
                <span className="font-label-mono text-[10px] text-outline uppercase font-bold">
                  Trust Engine & Reputation
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Current Score</span>
                  <span className="font-label-mono text-base font-bold text-primary">
                    {selectedUser.trustScore ?? 100} / 100
                  </span>
                </div>
                <p className="text-[10px] text-outline">
                  Calculated based on verified vs corroboration ratio, rate limits, and report dispute logs.
                </p>
              </div>

              <div className="p-md rounded-2xl border border-outline-variant/20 space-y-2">
                <span className="font-label-mono text-[10px] text-outline uppercase font-bold">
                  Organization Scope
                </span>
                <p className="text-on-surface font-bold">
                  {selectedUser.saccoId ? `SACCO: ${selectedUser.saccoId}` : selectedUser.authorityScope ? `Authority (${selectedUser.authorityScope} - ${selectedUser.county})` : 'Global Unrestricted'}
                </p>
              </div>
            </div>

            <div className="pt-md border-t border-outline-variant/20 flex gap-2">
              <Button
                variant={selectedUser.isActive ? 'secondary' : 'primary'}
                className="w-full justify-center"
                onClick={() => {
                  setUserToSuspend(selectedUser);
                  setSelectedUser(null);
                }}
              >
                {selectedUser.isActive ? 'Suspend User' : 'Reactivate User'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {userToSuspend && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg max-w-lg w-full space-y-md shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                {userToSuspend.isActive ? 'Confirm User Suspension' : 'Confirm User Reactivation'}
              </h3>
            </div>

            <p className="font-body-sm text-xs text-on-surface-variant">
              Target User: <strong className="text-on-surface">{userToSuspend.displayName}</strong> ({userToSuspend.email})
            </p>

            {userToSuspend.isActive && (
              <>
                {/* Warning Callout per specs */}
                <div className="p-md rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-body-sm text-xs space-y-1">
                  <p className="font-bold">⚠️ Security & Live State Propagation Notice</p>
                  <p className="text-[11px] leading-relaxed">
                    Firebase Auth custom tokens may take up to ~1 hour to expire. Suspending here writes the live Firestore status check (<code className="font-label-mono">users/{userToSuspend.id}.isActive = false</code>), which middleware and route guards enforce instantly.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                    Select Suspension Reason (Required for Audit Log)
                  </label>
                  <select
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-body-sm"
                  >
                    <option value="Repeated False Hazardous Reports">Repeated False Hazardous Reports</option>
                    <option value="Automated Spam / Rate Limit Breach">Automated Spam / Rate Limit Breach</option>
                    <option value="Account Hijack / Security Risk">Account Hijack / Security Risk</option>
                    <option value="Authority Legal Mandate">Authority Legal Mandate</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-sm pt-sm border-t border-outline-variant/20">
              <Button variant="outline" onClick={() => setUserToSuspend(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant={userToSuspend.isActive ? 'primary' : 'secondary'}
                onClick={handleToggleSuspend}
                disabled={isSubmitting}
                className={userToSuspend.isActive ? 'bg-rose-600 hover:bg-rose-700 text-white border-none' : ''}
              >
                {isSubmitting
                  ? 'Updating Live State...'
                  : userToSuspend.isActive
                  ? 'Confirm Suspension & Audit Log'
                  : 'Reactivate Account'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
