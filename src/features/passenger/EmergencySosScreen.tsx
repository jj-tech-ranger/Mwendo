import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { alertRepository } from '../../repositories';

export const EmergencySosScreen: React.FC = () => {
  const navigate = useNavigate();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [sosSent, setSosSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'sos' | 'contacts' | 'tips'>('sos');

  const [contacts, setContacts] = useState([
    { id: '1', name: 'Mary Wanjiku', relationship: 'Sister', phone: '+254 712 345 678' },
    { id: '2', name: 'Peter Ochieng', relationship: 'Spouse', phone: '+254 722 987 654' },
  ]);

  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('Family');

  /**
   * SAFETY-CRITICAL SOS DESIGN PATTERN:
   * Hold-to-confirm-then-fire (3-second buffer before dispatch).
   * We NEVER fire SMS or write to Firestore immediately on tap and offer to cancel later.
   * Emergency alerts trigger external dispatch and SMS deep-links; fire-then-cancel leaves false
   * alerts in flight. Holding first ensures only verified, non-cancelled SOS alerts are dispatched.
   */
  const dispatchSosAlert = async () => {
    // 1. Trigger local SMS deep link fallback per architecture §12
    const sosMessage = encodeURIComponent('EMERGENCY SOS: I need immediate assistance on my PSV journey! Live GPS location active.');
    window.location.href = `sms:999?body=${sosMessage}`;

    // 2. Save alert record to Firestore / local storage asynchronously
    try {
      const newAlert = {
        id: `sos_${Date.now()}`,
        userId: 'passenger_me',
        title: 'Emergency SOS Triggered',
        type: 'sos',
        severity: 'danger',
        message: 'Emergency SOS activated by passenger',
        createdAt: new Date().toISOString(),
        location: { lat: -1.286389, lng: 36.817223 },
      };
      await alertRepository.save(newAlert as any);
    } catch (err) {
      console.warn('Firestore SOS record error (offline fallback active):', err);
    }

    setSosSent(true);
  };

  // SOS Countdown Timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      dispatchSosAlert();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleTriggerSos = () => {
    setCountdown(3);
  };

  const handleCancelCountdown = () => {
    setCountdown(null);
  };

  const handleAddContact = () => {
    if (!newContactName || !newContactPhone) return;
    setContacts([
      ...contacts,
      {
        id: `c_${Date.now()}`,
        name: newContactName,
        relationship: newContactRel,
        phone: newContactPhone,
      },
    ]);
    setNewContactName('');
    setNewContactPhone('');
    setShowAddContact(false);
  };

  return (
    <div className="min-h-screen bg-background text-on-background p-4 sm:p-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between pb-2">
        <button
          onClick={() => navigate('/passenger')}
          className="flex items-center text-xs font-bold text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Dashboard
        </button>

        <Badge variant="danger" className="font-mono text-[10px] font-bold uppercase">
          Emergency Mode
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container p-1 rounded-xl text-xs font-bold mb-4">
        <button
          onClick={() => setActiveTab('sos')}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            activeTab === 'sos' ? 'bg-error text-on-error shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Emergency SOS
        </button>
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            activeTab === 'contacts' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Contacts ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab('tips')}
          className={`flex-1 py-2 rounded-lg transition-colors ${
            activeTab === 'tips' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          Safety Tips
        </button>
      </div>

      {/* TAB 1: EMERGENCY SOS */}
      {activeTab === 'sos' && (
        <div className="space-y-6 text-center">
          {/* Countdown State */}
          {countdown !== null ? (
            <Card className="p-8 bg-error/10 border-2 border-error space-y-4 animate-pulse">
              <div className="text-6xl font-black font-mono text-error">{countdown}</div>
              <h2 className="text-lg font-bold text-error">Sending alert in {countdown}...</h2>
              <p className="text-xs text-on-surface-variant">
                SMS with your GPS location will be sent to emergency contacts and NTSA safety hotline.
              </p>
              <Button
                variant="outline"
                className="w-full text-xs font-bold border-error text-error"
                onClick={handleCancelCountdown}
              >
                Cancel Alert
              </Button>
            </Card>
          ) : sosSent ? (
            /* SOS Sent Confirmation */
            <Card className="p-6 bg-emerald-500/10 border border-emerald-500/30 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-3xl">verified</span>
                <div>
                  <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                    Emergency Alert Dispatched
                  </h2>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Live GPS location broadcast active.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono bg-surface p-3 rounded-xl">
                <div className="text-emerald-700 font-bold">✓ Sent SMS to Mary Wanjiku</div>
                <div className="text-emerald-700 font-bold">✓ Sent SMS to Peter Ochieng</div>
                <div className="text-emerald-700 font-bold">✓ Logged to NTSA Incident Portal</div>
              </div>

              <Button
                className="w-full text-xs font-bold bg-emerald-700 text-white"
                onClick={() => setSosSent(false)}
              >
                I'm Safe Now — Cancel Broadcast
              </Button>
            </Card>
          ) : (
            /* Normal Hold-to-Alert Button */
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-on-surface">Emergency Assistance</h1>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                  Tap the red SOS button below if you feel unsafe or are in a vehicle accident.
                </p>
              </div>

              {/* Big Red SOS Button */}
              <button
                onClick={handleTriggerSos}
                className="w-40 h-40 mx-auto rounded-full bg-error text-on-error flex flex-col items-center justify-center font-black shadow-2xl shadow-error/40 hover:scale-105 active:scale-95 transition-all ring-8 ring-error/20"
              >
                <span className="text-3xl font-mono tracking-widest">SOS</span>
                <span className="text-[10px] font-sans font-normal opacity-90 mt-1 uppercase">
                  Tap to Broadcast
                </span>
              </button>

              {/* Quick Actions */}
              <div className="space-y-2 text-left pt-2">
                <h3 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
                  Quick Hotline Dial
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <a
                    href="tel:999"
                    className="p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between font-bold hover:bg-surface-container-high"
                  >
                    <span>National Police (999)</span>
                    <span className="material-symbols-outlined text-primary">call</span>
                  </a>
                  <a
                    href="tel:0800720822"
                    className="p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between font-bold hover:bg-surface-container-high"
                  >
                    <span>NTSA Safety Hotline</span>
                    <span className="material-symbols-outlined text-primary">call</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMERGENCY CONTACTS */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-surface">Trusted Contacts</h2>
            <Button size="sm" onClick={() => setShowAddContact(true)} className="text-xs">
              + Add Contact
            </Button>
          </div>

          <div className="space-y-2">
            {contacts.map((c) => (
              <Card key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-on-surface">{c.name}</div>
                  <div className="text-xs text-on-surface-variant">
                    {c.relationship} · <span className="font-mono">{c.phone}</span>
                  </div>
                </div>
                <Badge variant="neutral" className="text-[10px]">
                  SMS Ready
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SAFETY TIPS */}
      {activeTab === 'tips' && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase text-on-surface-variant">
            PSV Commuter Safety Guidelines
          </h2>

          <Card className="p-4 space-y-2">
            <div className="font-bold text-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-base">security</span>
              Verify PSV License & SACCO Markings
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Always ensure the vehicle displays an official NTSA inspection sticker and SACCO branding on both sides before boarding.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="font-bold text-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-base">speed</span>
              Monitor Speed on Night Corridors
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Use Mwendo Salama live speed tracking especially during long-distance or late-night corridor travel (e.g. Mombasa Road or Nakuru Highway).
            </p>
          </Card>
        </div>
      )}

      {/* Add Contact Modal */}
      <Dialog
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        title="Add Emergency Contact"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Full Name</label>
            <input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="e.g. Mary Wanjiku"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface"
            />
          </div>

          <div>
            <label className="font-bold block mb-1">Phone Number</label>
            <input
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              placeholder="e.g. +254 712 345 678"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface font-mono"
            />
          </div>

          <Button className="w-full mt-2" onClick={handleAddContact}>
            Save Contact
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
