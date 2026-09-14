import React, { useState, useEffect } from 'react';
import { limit, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { userRepository, saccoRepository, teamUserRepository } from '../../repositories';
import { UserProfile, UserRole, TeamUser } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';
import { functionsService } from '../../services/functionsService';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';
import { getSaccoName } from '../../lib/saccoUtils';

export const AdminUsersScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const currentAdmin = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch !== null) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  // Selected User for Drawer/Detail
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Modal states
  const [userToSuspend, setUserToSuspend] = useState<UserProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('Repeated False Hazardous Reports');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      return userRepository.getAll([limit(100)]);
    },
    staleTime: QUERY_STALE_TIMES.VEHICLES_AND_DRIVERS,
  });

  // Load registered SACCOs for role provisioning dropdown
  const { data: registeredSaccos = [] } = useQuery({
    queryKey: ['adminSaccos'],
    queryFn: async () => {
      return saccoRepository.getAll();
    },
    staleTime: QUERY_STALE_TIMES.VEHICLES_AND_DRIVERS,
  });

  // Load pending SACCO team user invites (awaiting Admin role provisioning)
  const { data: pendingTeamInvites = [] } = useQuery({
    queryKey: ['pendingTeamInvites'],
    queryFn: async () => {
      return teamUserRepository.getAll([where('status', '==', 'invited')]);
    },
    staleTime: QUERY_STALE_TIMES.VEHICLES_AND_DRIVERS,
  });

  // Role Assignment Modal States
  const [userToAssignRole, setUserToAssignRole] = useState<UserProfile | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('passenger');
  const [selectedSaccoId, setSelectedSaccoId] = useState<string>('');
  const [selectedAuthorityScope, setSelectedAuthorityScope] = useState<'national' | 'county'>('national');
  const [selectedCounty, setSelectedCounty] = useState<string>('Nairobi');
  const [selectedBadgeNumber, setSelectedBadgeNumber] = useState<string>('');
  const [associatedTeamUserId, setAssociatedTeamUserId] = useState<string | undefined>(undefined);
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Safeguard: check if current admin is the sole active admin and attempting self-demotion
  const activeAdminsCount = users.filter((u) => u.isActive && (u.role === 'admin' || (u as any).activeRole === 'admin')).length;
  const isSoleAdminSelfDemoting =
    currentAdmin?.id === userToAssignRole?.id && selectedNewRole !== 'admin' && activeAdminsCount <= 1;

  function openRoleAssignment(user: UserProfile, teamInvite?: TeamUser) {
    setUserToAssignRole(user);
    setSelectedNewRole(teamInvite ? 'sacco_manager' : (user.role || 'passenger'));
    setSelectedSaccoId(teamInvite?.saccoId || user.saccoId || (registeredSaccos[0]?.id ?? ''));
    setSelectedAuthorityScope(user.authorityScope === 'county' ? 'county' : 'national');
    setSelectedCounty(user.county || 'Nairobi');
    setSelectedBadgeNumber(user.badgeNumber || '');
    setAssociatedTeamUserId(teamInvite?.id);
    setRoleError(null);
  }

  async function handleAssignRole() {
    if (!userToAssignRole) return;
    if (isSoleAdminSelfDemoting) {
      setRoleError('Cannot remove admin role: You are the sole active administrator account.');
      return;
    }

    setIsRoleSubmitting(true);
    setRoleError(null);

    try {
      await functionsService.assignUserRole({
        targetUid: userToAssignRole.id,
        newRole: selectedNewRole,
        saccoId: selectedNewRole === 'sacco_manager' ? selectedSaccoId : undefined,
        authorityScope: selectedNewRole === 'authority' ? selectedAuthorityScope : undefined,
        county: selectedNewRole === 'authority' && selectedAuthorityScope === 'county' ? selectedCounty : undefined,
        badgeNumber: selectedNewRole === 'authority' ? selectedBadgeNumber : undefined,
        teamUserId: associatedTeamUserId,
      });

      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      await queryClient.invalidateQueries({ queryKey: ['pendingTeamInvites'] });

      setActionSuccess(
        `Role for ${userToAssignRole.displayName || userToAssignRole.email} updated to '${selectedNewRole}'. Auth custom claims merged and session tokens revoked.`
      );
      setUserToAssignRole(null);
      setSelectedUser(null);
    } catch (err: any) {
      console.error('Failed to assign user role:', err);
      setRoleError(err?.message || 'Failed to assign role. Please verify your permissions and input parameters.');
      showToast('error', 'Role Assignment Failed', err?.message || 'Error updating user role.');
    } finally {
      setIsRoleSubmitting(false);
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
      // BE-001 / SEC-004: User suspension is executed server-side via Cloud Function callable.
      // The function sets users/{uid}.isActive = false, sets the isSuspended custom claim in Firebase Auth,
      // revokes active refresh tokens, and records an audit log entry.
      if (isSuspending) {
        await functionsService.callCloudFunction('suspendUser', {
          targetUid: userToSuspend.id,
          reason: suspendReason,
        });
      } else {
        await functionsService.callCloudFunction('reactivateUser', {
          targetUid: userToSuspend.id,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });

      setActionSuccess(
        isSuspending
          ? `User ${userToSuspend.displayName} has been suspended. Live status updated.`
          : `User ${userToSuspend.displayName} has been reactivated.`
      );
      setUserToSuspend(null);
    } catch (err) {
      console.error('Failed to toggle user suspension:', err);
      showToast('error', 'Status Update Failed', 'Error updating user status. Please check connection.');
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

      {/* Pending SACCO Team Invitations (Awaiting Admin Role Provisioning) */}
      {pendingTeamInvites.length > 0 && (
        <div className="bg-surface-container-lowest border border-amber-500/30 rounded-2xl p-md shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
              <span className="material-symbols-outlined text-base">hourglass_top</span>
              <span>Pending SACCO Team Invitations (Requires Admin Authorization)</span>
            </div>
            <Badge variant="warning">{pendingTeamInvites.length} Pending</Badge>
          </div>
          <p className="text-xs text-on-surface-variant">
            SACCO managers have invited new team members. An administrator must provision their custom claims and authorize the role assignment before they can access tenant data.
          </p>
          <div className="divide-y divide-outline-variant/20 border border-outline-variant/20 rounded-xl overflow-hidden">
            {pendingTeamInvites.map((invite) => {
              const matchedUser = users.find((u) => u.email?.toLowerCase() === invite.email.toLowerCase());
              return (
                <div key={invite.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-container-low/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-on-surface">{invite.name}</span>
                      <span className="font-mono text-xs text-on-surface-variant">({invite.email})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-outline mt-0.5">
                      <span>SACCO: <strong className="text-on-surface">{getSaccoName(invite.saccoId)}</strong> ({invite.saccoId})</span>
                      <span>•</span>
                      <span>Requested Role: <Badge variant="neutral" className="text-[10px]">{invite.role}</Badge></span>
                    </div>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        if (matchedUser) {
                          openRoleAssignment(matchedUser, invite);
                        } else {
                          openRoleAssignment(
                            {
                              id: (invite as any).uid || `pending_${invite.id}`,
                              email: invite.email,
                              displayName: invite.name,
                              role: 'passenger',
                              isActive: true,
                              createdAt: new Date().toISOString(),
                            } as UserProfile,
                            invite
                          );
                        }
                      }}
                    >
                      Authorize & Provision Role
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
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
                      onClick={() => openRoleAssignment(u)}
                      title="Assign Role & Custom Claims"
                    >
                      <span className="material-symbols-outlined text-sm">manage_accounts</span>
                    </Button>

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
                variant="outline"
                className="w-1/2 justify-center"
                onClick={() => {
                  openRoleAssignment(selectedUser);
                }}
              >
                <span className="material-symbols-outlined text-sm mr-1">manage_accounts</span>
                Change Role
              </Button>
              <Button
                variant={selectedUser.isActive ? 'secondary' : 'primary'}
                className="w-1/2 justify-center"
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

      {/* Role Assignment Modal */}
      {userToAssignRole && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg max-w-lg w-full space-y-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-primary">
              <span className="material-symbols-outlined text-3xl">manage_accounts</span>
              <div>
                <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                  Server-Authoritative Role Provisioning
                </h3>
                <p className="font-label-mono text-[11px] text-outline">
                  Admin-gated custom claims & tenant assignment
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-1 text-xs">
              <p className="font-bold text-on-surface">
                Target User: {userToAssignRole.displayName || 'No Name'} ({userToAssignRole.email})
              </p>
              <p className="font-mono text-outline text-[11px]">UID: {userToAssignRole.id}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-on-surface-variant text-[11px]">Current Role:</span>
                <Badge variant="neutral" className="text-[10px] uppercase font-mono">
                  {userToAssignRole.role || 'passenger'}
                </Badge>
                {userToAssignRole.saccoId && (
                  <Badge variant="info" className="text-[10px]">
                    SACCO: {userToAssignRole.saccoId}
                  </Badge>
                )}
                {userToAssignRole.authorityScope && (
                  <Badge variant="info" className="text-[10px]">
                    Authority: {userToAssignRole.authorityScope}
                  </Badge>
                )}
              </div>
            </div>

            {/* Target UID edit if user was stubbed from invite */}
            {userToAssignRole.id.startsWith('pending_') && (
              <div className="space-y-1">
                <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                  Target Firebase Auth UID (Required for Claims)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5xXyZ..."
                  value={userToAssignRole.id.startsWith('pending_') ? '' : userToAssignRole.id}
                  onChange={(e) =>
                    setUserToAssignRole({
                      ...userToAssignRole,
                      id: e.target.value.trim(),
                    })
                  }
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-mono"
                />
                <p className="text-[10px] text-outline">
                  The user must have signed up or created an account in Firebase Auth.
                </p>
              </div>
            )}

            {/* Role Selector */}
            <div className="space-y-1">
              <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                Assign Elevated Role
              </label>
              <select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-body-sm"
              >
                <option value="passenger">Passenger / Commuter (Default Commuter Profile)</option>
                <option value="sacco_manager">SACCO Manager (Tenant Fleet & Operations Operator)</option>
                <option value="authority">Authority Inspector (NTSA / Roadside Compliance Officer)</option>
                <option value="admin">System Administrator (Global Platform Governance)</option>
              </select>
            </div>

            {/* SACCO Manager Tenant Configuration */}
            {selectedNewRole === 'sacco_manager' && (
              <div className="space-y-1 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
                <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                  Assigned Transport SACCO (Mandatory)
                </label>
                <select
                  value={selectedSaccoId}
                  onChange={(e) => setSelectedSaccoId(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-body-sm"
                >
                  <option value="">-- Select Registered SACCO --</option>
                  {registeredSaccos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                  {/* Fallback standard SACCOs if collection not fully populated in demo */}
                  {!registeredSaccos.some((s) => s.id === '2NK_SACCO') && (
                    <option value="2NK_SACCO">2NK Sacco Ltd (2NK_SACCO)</option>
                  )}
                  {!registeredSaccos.some((s) => s.id === 'SUPER_METRO') && (
                    <option value="SUPER_METRO">Super Metro Sacco (SUPER_METRO)</option>
                  )}
                  {!registeredSaccos.some((s) => s.id === 'EASY_COACH') && (
                    <option value="EASY_COACH">Easy Coach Express (EASY_COACH)</option>
                  )}
                </select>
                <p className="text-[10px] text-outline mt-1">
                  Tenant boundaries are strictly enforced. The user will only access fleet data for this SACCO.
                </p>
              </div>
            )}

            {/* Authority Scope Configuration */}
            {selectedNewRole === 'authority' && (
              <div className="space-y-3 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
                <div className="space-y-1">
                  <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                    Jurisdiction / Authority Scope
                  </label>
                  <select
                    value={selectedAuthorityScope}
                    onChange={(e) => setSelectedAuthorityScope(e.target.value as 'national' | 'county')}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-body-sm"
                  >
                    <option value="national">National Headquarters (NTSA National)</option>
                    <option value="county">County Transport Enforcement</option>
                  </select>
                </div>

                {selectedAuthorityScope === 'county' && (
                  <div className="space-y-1">
                    <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                      Assigned County
                    </label>
                    <select
                      value={selectedCounty}
                      onChange={(e) => setSelectedCounty(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-body-sm"
                    >
                      <option value="Nairobi">Nairobi</option>
                      <option value="Kiambu">Kiambu</option>
                      <option value="Mombasa">Mombasa</option>
                      <option value="Nakuru">Nakuru</option>
                      <option value="Machakos">Machakos</option>
                      <option value="Kisumu">Kisumu</option>
                      <option value="Uasin Gishu">Uasin Gishu</option>
                      <option value="Nyeri">Nyeri</option>
                      <option value="Meru">Meru</option>
                      <option value="Kajiado">Kajiado</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-label-mono text-[10px] text-on-surface-variant uppercase font-bold">
                    Inspector Badge / Authority ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NTSA-INSP-449"
                    value={selectedBadgeNumber}
                    onChange={(e) => setSelectedBadgeNumber(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-2.5 text-xs text-on-surface font-mono"
                  />
                </div>
              </div>
            )}

            {/* Lockout Prevention Warning */}
            {isSoleAdminSelfDemoting && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">error</span>
                  Lockout Prevention Safeguard Active
                </p>
                <p className="text-[11px] leading-relaxed">
                  You cannot remove the administrator role from your own account because you are currently the sole active platform administrator. Promote another administrator before relinquishing your role.
                </p>
              </div>
            )}

            {/* General Security Notice */}
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">security</span>
                Claims Propagation & Token Revocation
              </p>
              <p className="text-[11px] leading-relaxed text-on-surface-variant">
                Submitting updates the authoritative Firebase Auth custom claims and revokes active refresh tokens. The target user will receive their new permissions immediately upon next token refresh.
              </p>
            </div>

            {/* Error Message */}
            {roleError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>{roleError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-sm pt-sm border-t border-outline-variant/20">
              <Button
                variant="outline"
                onClick={() => {
                  setUserToAssignRole(null);
                  setRoleError(null);
                }}
                disabled={isRoleSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAssignRole}
                disabled={
                  isRoleSubmitting ||
                  isSoleAdminSelfDemoting ||
                  !userToAssignRole.id ||
                  userToAssignRole.id.startsWith('pending_') ||
                  (selectedNewRole === 'sacco_manager' && !selectedSaccoId)
                }
              >
                {isRoleSubmitting ? 'Provisioning Role & Claims...' : 'Confirm & Provision Role'}
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
                {/* Warning Callout */}
                <div className="p-md rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-body-sm text-xs space-y-1">
                  <p className="font-bold">⚠️ Security & Live State Propagation Notice</p>
                  <p className="text-[11px] leading-relaxed">
                    Suspending an account immediately revokes access across all portals. Security middleware and route guards will enforce this block in real time.
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
