import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';

export const PassengerAlertsScreen: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'alerts' | 'achievements' | 'trust' | 'reports'>('alerts');
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);

  const [alertsList] = useState([
    {
      id: 'a1',
      title: 'Overspeed Warning Triggered',
      route: 'Thika Road – Near Survey of Kenya',
      time: '10 mins ago',
      type: 'overspeed',
      severity: 'high',
      message: 'Vehicle KDA 123A was logged traveling at 94 km/h (Limit: 80 km/h).',
    },
    {
      id: 'a2',
      title: 'Black Spot Approaching',
      route: 'Waiyaki Way – Kangemi Flyover',
      time: '1 hour ago',
      type: 'blackspot',
      severity: 'medium',
      message: 'Entering high-accident corridor. Exercise caution.',
    },
    {
      id: 'a3',
      title: 'Trust Score Increased (+10)',
      route: 'System Reward',
      time: 'Yesterday',
      type: 'system',
      severity: 'safe',
      message: 'Your black spot hazard report on Mombasa Road was verified by 14 commuters.',
    },
  ]);

  const [reportsList] = useState([
    {
      id: 'r1',
      title: 'Unmarked Speed Bump on Highway',
      location: 'Mombasa Road – Sameer Park',
      date: '07 Aug 2026',
      status: 'published',
      trustBonus: '+10 Score',
    },
    {
      id: 'r2',
      title: 'Pothole across outer lane',
      location: 'Ngong Road – Dagoretti',
      date: '02 Aug 2026',
      status: 'pending',
      trustBonus: 'Under Review',
    },
  ]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Top Header */}
      <div>
        <h1 className="text-xl font-black text-on-surface">Alerts & Safety Center</h1>
        <p className="text-xs text-on-surface-variant">
          Notifications, trust score, and hazard submission history
        </p>
      </div>

      {/* Sub Tabs */}
      <div className="flex bg-surface-container p-1 rounded-xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'alerts' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveSubTab('trust')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'trust' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Trust Score
        </button>
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'reports' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          My Reports
        </button>
        <button
          onClick={() => setActiveSubTab('achievements')}
          className={`flex-1 py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'achievements' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Badges
        </button>
      </div>

      {/* SUB-TAB 1: ALERTS & NOTIFICATIONS */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant">
            <span>Recent Activity</span>
            <span>3 Unread</span>
          </div>

          {alertsList.map((alert) => (
            <Card
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className="p-4 cursor-pointer hover:bg-surface-container-high/50 transition-colors space-y-2 border border-outline-variant/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`p-1.5 rounded-full ${
                      alert.severity === 'high'
                        ? 'bg-error/20 text-error'
                        : alert.severity === 'medium'
                        ? 'bg-amber-500/20 text-amber-600'
                        : 'bg-emerald-500/20 text-emerald-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base block">
                      {alert.type === 'overspeed' ? 'speed' : alert.type === 'blackspot' ? 'warning' : 'verified'}
                    </span>
                  </span>
                  <span className="font-bold text-sm text-on-surface">{alert.title}</span>
                </div>

                <span className="text-[10px] font-mono text-on-surface-variant">{alert.time}</span>
              </div>

              <p className="text-xs text-on-surface-variant">{alert.route}</p>
            </Card>
          ))}
        </div>
      )}

      {/* SUB-TAB 2: TRUST SCORE */}
      {activeSubTab === 'trust' && (
        <div className="space-y-4">
          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-emerald-900/10 to-teal-900/10 border border-emerald-500/20">
            <div className="w-24 h-24 mx-auto rounded-full bg-emerald-600/10 border-4 border-emerald-600 text-emerald-800 dark:text-emerald-300 flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-mono">78</span>
              <span className="text-[9px] uppercase tracking-wider font-bold">/ 100</span>
            </div>

            <div>
              <Badge className="bg-emerald-700 text-white font-bold">Trusted Reporter</Badge>
              <p className="text-xs text-on-surface-variant mt-2 max-w-xs mx-auto">
                Your hazard reports receive priority moderation review. Keep contributing verified road data!
              </p>
            </div>
          </Card>

          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
              Trust Score Breakdown
            </h3>
            <Card className="p-3 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span>Confirmed Hazard Reports (3)</span>
                <span className="text-emerald-700 font-bold">+30 pts</span>
              </div>
              <div className="flex justify-between">
                <span>Tracked Safe Trips (47)</span>
                <span className="text-emerald-700 font-bold">+28 pts</span>
              </div>
              <div className="flex justify-between">
                <span>Account Verified Bonus</span>
                <span className="text-emerald-700 font-bold">+20 pts</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MY REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
            Submitted Hazard Reports
          </h2>

          {reportsList.map((r) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-on-surface">{r.title}</div>
                  <div className="text-xs text-on-surface-variant">{r.location}</div>
                </div>

                <Badge
                  variant={r.status === 'published' ? 'success' : 'neutral'}
                  className="text-[10px] uppercase font-bold"
                >
                  {r.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant border-t border-outline-variant/20 pt-2">
                <span>Date: {r.date}</span>
                <span className="text-emerald-700 font-bold">{r.trustBonus}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* SUB-TAB 4: ACHIEVEMENTS & BADGES */}
      {activeSubTab === 'achievements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-on-surface">Badges Earned</span>
            <span className="text-emerald-700 font-bold">12 of 24 Unlocked</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { title: 'Safe Traveler', desc: '10 trips without overspeed', icon: 'verified_user', earned: true },
              { title: 'Road Guardian', desc: 'First black spot report verified', icon: 'shield', earned: true },
              { title: 'Corridor Eagle', desc: 'Tracked trips across 3 corridors', icon: 'alt_route', earned: true },
              { title: 'Night Watch', desc: 'Tracked night trip safely', icon: 'dark_mode', earned: false },
              { title: 'Civic Pioneer', desc: 'Reported 5 road hazards', icon: 'flag', earned: false },
            ].map((b, idx) => (
              <Card
                key={idx}
                className={`p-4 text-center space-y-2 ${
                  b.earned ? 'bg-surface border-emerald-500/30' : 'bg-surface-container-low opacity-60'
                }`}
              >
                <div
                  className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                    b.earned ? 'bg-emerald-600 text-white' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{b.icon}</span>
                </div>
                <div className="font-bold text-xs text-on-surface">{b.title}</div>
                <p className="text-[10px] text-on-surface-variant">{b.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Alert Detail Dialog */}
      <Dialog
        isOpen={!!selectedAlert}
        onClose={() => setSelectedAlert(null)}
        title={selectedAlert?.title || 'Notification Detail'}
      >
        {selectedAlert && (
          <div className="space-y-3 text-xs text-on-surface">
            <div className="font-mono text-on-surface-variant">{selectedAlert.time} · {selectedAlert.route}</div>
            <p className="text-on-surface leading-relaxed">{selectedAlert.message}</p>
            <Button className="w-full mt-2" onClick={() => setSelectedAlert(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
};
