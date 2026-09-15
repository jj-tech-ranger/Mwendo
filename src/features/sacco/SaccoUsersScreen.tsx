import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/useAuthStore';
import { teamUserRepository } from '../../repositories';
import { TeamUser } from '../../types';
import { getSaccoName, getEffectiveSaccoId } from '../../lib/saccoUtils';

export const SaccoUsersScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = getEffectiveSaccoId(user?.saccoId);

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles'>('users');
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'sacco_manager' | 'operations' | 'viewer'>('operations');

  useEffect(() => {
    if (!saccoId) return;

    const unsubscribe = teamUserRepository.subscribeBySaccoId(
      saccoId,
      (users) => {
        setTeamUsers(users);
      },
      (err) => {
        console.warn('Error in team users subscription:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [saccoId]);

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail || !saccoId) return;
    const nowIso = new Date().toISOString();
    const newUser: TeamUser = {
      id: `tu_${Date.now()}`,
      saccoId,
      name: inviteName.trim(),
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      status: 'invited',
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActive: 'Awaiting Admin Approval',
    };

    try {
      await teamUserRepository.save(newUser);
    } catch (err) {
      console.warn('Error inviting team user; retaining local fallback:', err);
      setTeamUsers((prev) => [...prev, newUser]);
    } finally {
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
    }
  };

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
          <h1 className="text-lg font-black text-on-surface">User Management & Team Accounts — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">Internal team accounts, dispatch officers, and role permissions matrix</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubTab === 'users' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Team Members
          </button>
          <button
            onClick={() => setActiveSubTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubTab === 'roles' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Role Permissions
          </button>

          <Button size="sm" className="font-bold text-xs ml-2" onClick={() => setShowInviteModal(true)} data-testid="open-invite-modal-btn">
            + Invite User
          </Button>
        </div>
      </div>

      {activeSubTab === 'users' ? (
        <div className="space-y-4">
          {teamUsers.some((u) => u.status === 'invited') && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-amber-500">pending_actions</span>
                <span>
                  <strong>Pending Invites:</strong> One or more team members are awaiting platform administrator custom claim authorization.
                </span>
              </div>
            </div>
          )}

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-high border-b border-outline-variant/30 font-mono uppercase text-on-surface-variant">
                  <tr>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 font-mono text-right">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 font-medium">
                  {teamUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-container/50">
                      <td className="p-3.5 font-bold text-on-surface">{u.name}</td>
                      <td className="p-3.5 font-mono text-on-surface-variant">{u.email}</td>
                      <td className="p-3.5 capitalize">
                        <Badge variant="neutral" className="font-mono text-[10px]">
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={u.status === 'active' ? 'success' : u.status === 'invited' ? 'warning' : 'neutral'}
                          className="text-[10px]"
                          data-testid={`status-badge-${u.id}`}
                        >
                          {u.status === 'invited' ? 'Pending Admin Approval' : u.status === 'active' ? 'Active' : u.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right font-mono text-on-surface-variant" data-testid={`last-active-${u.id}`}>
                        {u.status === 'invited'
                          ? 'Awaiting Admin Approval'
                          : u.lastActive && u.lastActive !== 'Pending Acceptance' && u.lastActive !== 'Awaiting Admin Approval'
                            ? u.lastActive
                            : u.updatedAt
                              ? new Date(u.updatedAt).toLocaleDateString()
                              : 'Active'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-sm text-on-surface">Team Permissions Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-outline-variant/30 rounded-xl">
              <thead className="bg-surface-container font-mono text-on-surface-variant uppercase">
                <tr>
                  <th className="p-3">Capability</th>
                  <th className="p-3">SACCO Manager</th>
                  <th className="p-3">Operations</th>
                  <th className="p-3">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-medium">
                {[
                  { name: 'View Fleet Trips & Speed', m: '✓', o: '✓', v: '✓' },
                  { name: 'Manage Vehicles & Drivers', m: '✓', o: '✓', v: '—' },
                  { name: 'Claim Provisional Vehicles', m: '✓', o: '—', v: '—' },
                  { name: 'Moderate Black Spot Reports', m: '✓', o: '✓', v: '—' },
                  { name: 'Export NTSA Reports', m: '✓', o: '✓', v: '—' },
                  { name: 'Manage Team Users & Roles', m: '✓', o: '—', v: '—' },
                ].map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-bold">{row.name}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">{row.m}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">{row.o}</td>
                    <td className="p-3 font-mono text-on-surface-variant">{row.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Team Member">
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-bold block mb-1">Full Name</label>
            <Input placeholder="e.g. Jane Mutesi" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          </div>
          <div>
            <label className="font-bold block mb-1">Work Email</label>
            <Input placeholder="jane@metrolink.co.ke" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </div>
          <div>
            <label className="font-bold block mb-1">Role Assignment</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'sacco_manager' | 'operations' | 'viewer')}
              className="w-full p-2 bg-surface text-on-surface border border-outline-variant/40 rounded-xl"
            >
              <option value="sacco_manager">SACCO Manager</option>
              <option value="operations">Operations / Dispatch</option>
              <option value="viewer">Viewer (Read-only)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-high border border-outline-variant/20 text-[11px] text-on-surface-variant space-y-1">
            <span className="font-semibold text-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
              Server-Authoritative Role Provisioning
            </span>
            <p>
              Sending an invitation creates a verified pending role request. A platform administrator will review the request and provision the required Firebase Auth custom claims before the user can access SACCO tenant data.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} data-testid="send-invitation-btn">
              Send Invitation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
