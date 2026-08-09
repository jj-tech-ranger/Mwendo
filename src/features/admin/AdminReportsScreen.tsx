import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { blackSpotRepository } from '../../repositories';
import { BlackSpot } from '../../types';

export const AdminReportsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'blackspots' | 'executive'>('blackspots');
  const [reports, setReports] = useState<BlackSpot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBlackspotReports();
  }, []);

  async function loadBlackspotReports() {
    setIsLoading(true);
    try {
      const fetched = await blackSpotRepository.getAll();
      setReports(fetched);
    } catch (err) {
      console.error('Failed to load blackspot reports:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = reports.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.routeName.toLowerCase().includes(q) ||
      (r.county && r.county.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Reports & Analytical Digests
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Cross-tenant blackspot hazard reports explorer and executive funder impact digests.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-surface-container border border-outline-variant/30 rounded-xl p-1 font-label-mono text-xs">
          <button
            onClick={() => setActiveTab('blackspots')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'blackspots'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Blackspot Reports ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('executive')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'executive'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Executive Digests
          </button>
        </div>
      </div>

      {activeTab === 'blackspots' && (
        <div className="space-y-md">
          {/* Search Row */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-md shadow-sm flex items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hazard name, route, or county..."
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button variant="outline" className="gap-2">
              <span className="material-symbols-outlined text-base">download</span>
              Export CSV Report
            </Button>
          </div>

          {/* Table */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-body-sm">
                <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
                  <tr>
                    <th className="p-md">Hazard Location / Title</th>
                    <th className="p-md">Route & County</th>
                    <th className="p-md">Severity</th>
                    <th className="p-md">Corroboration</th>
                    <th className="p-md">Confidence Score</th>
                    <th className="p-md">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container/50">
                      <td className="p-md font-bold text-on-surface">
                        <p>{r.name}</p>
                        <p className="text-[11px] text-on-surface-variant line-clamp-1">
                          {r.hazardDescription}
                        </p>
                      </td>

                      <td className="p-md font-label-mono text-xs text-on-surface-variant">
                        <p>{r.routeName}</p>
                        <p className="text-[10px] text-outline">{r.county}</p>
                      </td>

                      <td className="p-md">
                        <Badge variant={r.severity === 'critical' ? 'danger' : 'warning'}>
                          {r.severity}
                        </Badge>
                      </td>

                      <td className="p-md font-label-mono font-bold text-xs">
                        {r.corroborationCount ?? 1} Commuters
                      </td>

                      <td className="p-md font-label-mono font-bold text-primary">
                        {r.confidenceScore ?? 80}%
                      </td>

                      <td className="p-md">
                        {r.verifiedByAuthority ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="neutral">Pending Verification</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'executive' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md flex flex-col justify-between">
            <div className="space-y-2">
              <span className="material-symbols-outlined text-3xl text-primary">analytics</span>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                Platform Monthly Growth & Safety Digest
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Comprehensive 30-day analytics on registered vehicles, passenger trips, and overspeed mitigation metrics across all corridors.
              </p>
            </div>
            <Button variant="primary" className="w-full justify-center gap-2">
              <span className="material-symbols-outlined text-base">download</span>
              Generate Executive PDF
            </Button>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md flex flex-col justify-between">
            <div className="space-y-2">
              <span className="material-symbols-outlined text-3xl text-amber-600">verified_user</span>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                NTSA Compliance & Inspection Audit
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Roadside speed governor audit summaries, SACCO safety score leaderboards, and impound logs for NTSA directorate.
              </p>
            </div>
            <Button variant="secondary" className="w-full justify-center gap-2">
              <span className="material-symbols-outlined text-base">download</span>
              Download NTSA Report
            </Button>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-sm space-y-md flex flex-col justify-between">
            <div className="space-y-2">
              <span className="material-symbols-outlined text-3xl text-emerald-600">nature_people</span>
              <h3 className="font-headline-lg-mobile text-base font-bold text-on-surface">
                Grant & Global Road Safety Funder Impact
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Quantified lives saved, blackspot hazard warning triggers, and commuter safety score shifts for donor reporting.
              </p>
            </div>
            <Button variant="outline" className="w-full justify-center gap-2">
              <span className="material-symbols-outlined text-base">download</span>
              Download Impact Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
