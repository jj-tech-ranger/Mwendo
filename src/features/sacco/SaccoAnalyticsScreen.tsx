import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/useAuthStore';

export const SaccoAnalyticsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const saccoId = user?.saccoId || 'sacco_metrolink';
  const saccoName = saccoId === 'sacco_greenline' ? 'GreenLine SACCO' : 'MetroLink SACCO';

  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'leaderboards'>('analytics');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="text-lg font-black text-on-surface">Analytics & Fleet Performance — {saccoName}</h1>
          <p className="text-xs text-on-surface-variant">Real-time driver safety rankings, speed distribution, and corridor trends</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubTab === 'analytics' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Fleet Analytics
          </button>
          <button
            onClick={() => setActiveSubTab('leaderboards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubTab === 'leaderboards' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Driver Leaderboards
          </button>
        </div>
      </div>

      {activeSubTab === 'analytics' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Average Speed Score</span>
              <div className="text-2xl font-black font-mono text-emerald-700">88 / 100</div>
            </Card>
            <Card className="p-5 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Overspeed Rate / 100km</span>
              <div className="text-2xl font-black font-mono text-amber-600">1.4 Events</div>
            </Card>
            <Card className="p-5 space-y-1">
              <span className="text-xs font-mono uppercase text-on-surface-variant">Passenger Rating</span>
              <div className="text-2xl font-black font-mono text-primary">4.8 / 5.0</div>
            </Card>
          </div>

          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-sm text-on-surface">Corridor Speed Compliance Breakdown</h3>
            <div className="space-y-3 text-xs">
              {[
                { corridor: 'Thika Superhighway', compliance: 94 },
                { corridor: 'Mombasa Road Expressway', compliance: 82 },
                { corridor: 'Waiyaki Way Corridor', compliance: 91 },
              ].map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>{c.corridor}</span>
                    <span className="font-mono text-emerald-700 font-bold">{c.compliance}% compliant</span>
                  </div>
                  <div className="h-2.5 bg-surface-container rounded-full overflow-hidden">
                    <div style={{ width: `${c.compliance}%` }} className="h-full bg-primary" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        /* LEADERBOARDS SUB TAB (§19) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500">workspace_premium</span>
              Safest Drivers (Top Rated)
            </h3>
            <div className="space-y-3 text-xs font-medium">
              {[
                { rank: '1st 🥇', name: saccoId === 'sacco_greenline' ? 'Driver #201' : 'Driver #22', score: '98/100', trips: 140 },
                { rank: '2nd 🥈', name: saccoId === 'sacco_greenline' ? 'Driver #202' : 'Driver #45', score: '94/100', trips: 110 },
                { rank: '3rd 🥉', name: 'Driver #12', score: '91/100', trips: 95 },
              ].map((d, idx) => (
                <div key={idx} className="p-3 bg-surface-container rounded-xl flex items-center justify-between border border-outline-variant/20">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-amber-600">{d.rank}</span>
                    <div>
                      <div className="font-bold">{d.name}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{d.trips} trips completed</div>
                    </div>
                  </div>
                  <Badge variant="success" className="font-mono font-bold">
                    {d.score}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-error">warning</span>
              Vehicles Needing Attention
            </h3>
            <div className="space-y-3 text-xs font-medium">
              {[
                { plate: saccoId === 'sacco_greenline' ? 'KDC 303G' : 'KCC 789X', issue: 'Repeated overspeeding on Ngong Rd', score: '61/100' },
              ].map((v, idx) => (
                <div key={idx} className="p-3 bg-surface-container rounded-xl flex items-center justify-between border border-error/30">
                  <div>
                    <div className="font-mono font-bold text-primary">{v.plate}</div>
                    <div className="text-[10px] text-on-surface-variant">{v.issue}</div>
                  </div>
                  <Badge variant="danger" className="font-mono font-bold">
                    {v.score}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
