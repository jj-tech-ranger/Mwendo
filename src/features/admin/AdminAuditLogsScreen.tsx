import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { auditLogRepository } from '../../repositories';
import { AuditLog } from '../../types';
import { QUERY_STALE_TIMES } from '../../lib/queryClient';

export const AdminAuditLogsScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['adminAuditLogs'],
    queryFn: async () => {
      return auditLogRepository.getAll();
    },
    staleTime: QUERY_STALE_TIMES.ANALYTICS_SUMMARIES,
  });

  const filtered = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.actorName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.target.toLowerCase().includes(q) ||
      l.saccoId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Governance & Administrative Audit Logs
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Immutable trace of every administrative override, suspension, and config modification.
          </p>
        </div>

        <Button variant="outline" className="gap-2">
          <span className="material-symbols-outlined text-base">download</span>
          Export Audit Trail CSV
        </Button>
      </div>

      {/* Search Row */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex items-center justify-between">
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by actor, action, target entity, or scope..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-sm"
          />
        </div>

        <Badge variant="info">{filtered.length} Entries</Badge>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md">Timestamp</th>
                <th className="p-md">Actor Name / Role</th>
                <th className="p-md">Action Name</th>
                <th className="p-md">Target Entity</th>
                <th className="p-md">Scope ID</th>
                <th className="p-md text-right">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-body-sm">
              {filtered.map((l) => (
                <React.Fragment key={l.id}>
                  <tr className="hover:bg-surface-container/50">
                    <td className="p-md font-label-mono text-[10px] text-outline">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="p-md font-bold text-on-surface">
                      <p>{l.actorName}</p>
                      <span className="font-label-mono text-[9px] text-primary uppercase">
                        {l.actorRole}
                      </span>
                    </td>
                    <td className="p-md font-label-mono font-bold text-xs text-on-surface">
                      {l.action}
                    </td>
                    <td className="p-md text-on-surface-variant">{l.target}</td>
                    <td className="p-md font-label-mono text-[10px] text-outline">{l.saccoId}</td>
                    <td className="p-md text-right">
                      <button
                        onClick={() => setExpandedLogId(expandedLogId === l.id ? null : l.id)}
                        className="p-1 rounded text-primary hover:bg-surface-container"
                        title="View Before/After Diff"
                      >
                        <span className="material-symbols-outlined text-base">code</span>
                      </button>
                    </td>
                  </tr>

                  {expandedLogId === l.id && (
                    <tr className="bg-[#121212]">
                      <td colSpan={6} className="p-md font-label-mono text-xs text-emerald-400">
                        <div className="p-sm bg-[#0A0A0A] rounded-xl border border-emerald-900/40 space-y-1">
                          <p className="font-bold text-white text-[11px]">Audit Record Packet ({l.id}):</p>
                          <pre className="text-[10px] leading-relaxed">
                            {JSON.stringify(
                              {
                                id: l.id,
                                actor: l.actorName,
                                action: l.action,
                                target: l.target,
                                scope: l.saccoId,
                                timestamp: l.timestamp,
                                diffState: {
                                  previous: { isActive: true },
                                  updated: { isActive: false },
                                },
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
