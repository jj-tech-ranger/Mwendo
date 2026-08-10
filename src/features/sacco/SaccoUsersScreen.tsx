import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { useAuthStore } from '../../store/useAuthStore';
import { teamUserRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { TeamUser } from '../../types';

export const SaccoUsersScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles'>('users');
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'sacco_manager' | 'operations' | 'viewer'>('operations');

  const loadTeamUsers = async () => {
    setLoading(true);
    try {
      const docs = await teamUserRepository.getAll([where('saccoId', '==', saccoId)]);
      setTeamUsers(docs);
    } catch (err) {
      console.warn('Error loading team users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamUsers();
  }, [saccoId]);

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail) return;
    const newUser: TeamUser = {
      id: `tu_${Date.now()}`,
      saccoId,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: 'invited',
      lastActive: 'Pending Acceptance',
    };

    try {
      await teamUserRepository.save(newUser);
      await loadTeamUsers();
    } catch (err) {
      setTeamUsers([...teamUsers, newUser]);
    } finally {
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
    }
  };

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

          <Button size="sm" className="font-bold text-xs ml-2" onClick={() => setShowInviteModal(true)}>
            + Invite User
          </Button>
        </div>
      </div>

      {activeSubTab === 'users' ? (
        <Card className="p-0 overflow-hidden">
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
                    <Badge variant={u.status === 'active' ? 'success' : 'warning'} className="capitalize text-[10px]">
                      {u.status}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-right font-mono text-on-surface-variant">{u.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        /* ROLES PERMISSIONS MATRIX (§22) */
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
                  { name: 'View Fleet Telemetry', m: '✓', o: '✓', v: '✓' },
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

      {/* INVITE USER MODAL */}
      {showInviteModal && (
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
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="w-full p-2 bg-surface text-on-surface border border-outline-variant/40 rounded-xl"
              >
                <option value="sacco_manager">SACCO Manager</option>
                <option value="operations">Operations / Dispatch</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite}>Send Invitation</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
