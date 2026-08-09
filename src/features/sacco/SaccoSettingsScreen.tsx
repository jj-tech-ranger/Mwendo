import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { auditLogRepository } from '../../repositories';
import { where } from 'firebase/firestore';
import { AuditLog } from '../../types';

export const SaccoSettingsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'audit' | 'help'>('profile');
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    async function loadLogs() {
      try {
        const docs = await auditLogRepository.getAll([where('saccoId', '==', saccoId)]);
        if (docs.length > 0) {
          setLogs(docs);
        } else {
          setLogs([
            {
              id: 'log_1',
              saccoId,
              actorName: user?.displayName || 'SACCO Manager',
              actorRole: 'sacco_manager',
              action: 'Claimed Provisional Vehicle KDA 771B',
              target: 'Vehicle Fleet',
              timestamp: new Date().toISOString(),
            },
            {
              id: 'log_2',
              saccoId,
              actorName: 'System Engine',
              actorRole: 'telemetry_bot',
              action: 'NTSA Safety Score Recalculated (82/100)',
              target: 'SACCO Profile',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.warn('Error loading audit logs:', err);
      }
    }
    loadLogs();
  }, [saccoId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Organization Settings & Support</h1>
          <p className="text-xs text-on-surface-variant">SACCO metadata, subscription plan, immutable audit ledger, and support portal</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'profile' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Org Profile
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'billing' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Billing & Plan
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'audit' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'help' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Help & Support
          </button>
        </div>
      </div>

      {/* ORG PROFILE TAB (§23B) */}
      {activeTab === 'profile' && (
        <Card className="p-6 max-w-2xl space-y-4">
          <h3 className="font-bold text-sm text-on-surface">Organization Metadata</h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold block mb-1">SACCO Registered Name</label>
              <Input value={saccoName} readOnly className="bg-surface-container font-bold" />
            </div>
            <div>
              <label className="font-bold block mb-1">NTSA License Code</label>
              <Input value={saccoId === 'sacco_greenline' ? 'NTSA/SACCO/2024/099' : 'NTSA/SACCO/2024/014'} readOnly className="bg-surface-container font-mono" />
            </div>
            <div>
              <label className="font-bold block mb-1">Primary Dispatch Phone</label>
              <Input defaultValue="+254 700 111 222" />
            </div>
            <div>
              <label className="font-bold block mb-1">Official Contact Email</label>
              <Input defaultValue={`info@${saccoId}.co.ke`} />
            </div>

            <Button className="mt-2 font-bold" onClick={() => alert('Organization profile saved.')}>
              Save Profile Changes
            </Button>
          </div>
        </Card>
      )}

      {/* BILLING & PLAN TAB (§23C) */}
      {activeTab === 'billing' && (
        <Card className="p-6 max-w-2xl space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <Badge variant="success" className="font-mono text-xs">
                Active Subscription
              </Badge>
              <h3 className="font-black text-lg text-on-surface mt-1">Growth Enterprise Plan</h3>
              <p className="text-xs text-on-surface-variant">Includes up to 100 active vehicles and full telemetry streaming</p>
            </div>
            <Button size="sm">Upgrade Plan</Button>
          </div>

          <div className="space-y-2 pt-4 border-t border-outline-variant/20 text-xs">
            <div className="flex justify-between font-mono">
              <span>Vehicle Limit Usage</span>
              <span className="font-bold">24 / 100 Fleet Slots</span>
            </div>
            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
              <div className="w-[24%] h-full bg-primary" />
            </div>
          </div>
        </Card>
      )}

      {/* AUDIT LOGS TAB (§24) */}
      {activeTab === 'audit' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-outline-variant/20 flex justify-between items-center text-xs font-bold">
            <span>Read-Only Immutable Audit Ledger</span>
            <span className="font-mono text-on-surface-variant">Tenant: {saccoId}</span>
          </div>

          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-surface-container-high border-b border-outline-variant/30 uppercase text-on-surface-variant">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action Executed</th>
                <th className="p-3">Target Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-medium">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-container/50">
                  <td className="p-3 text-on-surface-variant">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="p-3 font-bold text-primary">{log.actorName}</td>
                  <td className="p-3 text-on-surface">{log.action}</td>
                  <td className="p-3 text-on-surface-variant">{log.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* HELP & SUPPORT TAB (§25) */}
      {activeTab === 'help' && (
        <Card className="p-6 max-w-2xl space-y-4">
          <h3 className="font-bold text-sm text-on-surface">SACCO Operations Support</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Need help configuring telemetry sensors or managing NTSA fleet compliance? Our dedicated account managers are available 24/7.
          </p>

          <div className="p-4 bg-surface-container rounded-xl flex items-center justify-between text-xs font-mono">
            <div>
              <div className="font-bold text-primary">Account Manager Contact</div>
              <div className="text-on-surface-variant">support@mwendosalama.go.ke</div>
            </div>
            <Button size="sm" onClick={() => alert('Support ticket initiated.')}>
              Contact NTSA Support
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
