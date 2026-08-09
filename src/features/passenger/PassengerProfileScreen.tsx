import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { BrandMark } from '../../components/assets/BrandAssets';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { useThemeStore } from '../../store/useThemeStore';
import { useLanguageStore } from '../../store/useLanguageStore';

export const PassengerProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { mode, toggleDarkMode } = useThemeStore();
  const isDark = mode === 'dark';
  const { language, setLanguage } = useLanguageStore();

  const [activeModal, setActiveModal] = useState<
    'editProfile' | 'changePassword' | 'privacy' | 'permissions' | 'deleteAccount' | null
  >(null);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.displayName || '');
  const [editPhone, setEditPhone] = useState(user?.phoneNumber || '');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await authService.updateProfileData({
        displayName: editName,
        phoneNumber: editPhone,
      });
      useAuthStore.setState((s) => {
        if (!s.user) return s;
        return {
          ...s,
          user: {
            ...s.user,
            displayName: editName,
            phoneNumber: editPhone,
          },
        };
      });
    } catch (err) {
      console.warn('Error updating profile in Firestore:', err);
    } finally {
      setIsSavingProfile(false);
      setActiveModal(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmText.toUpperCase() === 'DELETE') {
      logout();
      navigate('/auth/login');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Header Profile Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-black text-xl shadow-md border-2 border-emerald-400">
            {editName.charAt(0)}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-on-surface">{editName}</h1>
              <Badge variant="success" className="text-[10px] font-bold">
                Verified
              </Badge>
            </div>
            <p className="text-xs text-on-surface-variant font-mono">{editPhone}</p>
          </div>
        </div>

        <BrandMark className="w-9 h-9" />
      </div>

      {/* 3-Stat Strip */}
      <Card className="p-4 grid grid-cols-3 divide-x divide-outline-variant/20 text-center font-mono">
        <div>
          <div className="text-xl font-black text-on-surface">47</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Trips</div>
        </div>
        <div>
          <div className="text-xl font-black text-emerald-700">78</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Trust Score</div>
        </div>
        <div>
          <div className="text-xl font-black text-on-surface">9</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Reports</div>
        </div>
      </Card>

      {/* Settings Group */}
      <div className="space-y-4">
        {/* Account Settings */}
        <div className="space-y-2">
          <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
            Account & Security
          </h2>
          <Card className="divide-y divide-outline-variant/20 text-xs font-medium overflow-hidden">
            <button
              onClick={() => setActiveModal('editProfile')}
              className="w-full p-3.5 flex items-center justify-between hover:bg-surface-container-high transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">person</span>
                <span>Edit Profile</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </button>

            <button
              onClick={() => setActiveModal('changePassword')}
              className="w-full p-3.5 flex items-center justify-between hover:bg-surface-container-high transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">lock</span>
                <span>Change Password</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </button>
          </Card>
        </div>

        {/* Appearance & Language */}
        <div className="space-y-2">
          <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
            Preferences & Language
          </h2>
          <Card className="p-4 space-y-4 text-xs">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">contrast</span>
                <div>
                  <div className="font-bold">Dark Theme</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Night-friendly speed readout
                  </div>
                </div>
              </div>

              <button
                onClick={toggleDarkMode}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  isDark ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    isDark ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">translate</span>
                <div>
                  <div className="font-bold">Language</div>
                  <div className="text-[11px] text-on-surface-variant">English / Kiswahili</div>
                </div>
              </div>

              <div className="flex gap-1 bg-surface-container p-1 rounded-lg">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    language === 'en' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('sw')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                    language === 'sw' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                  }`}
                >
                  SW
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Data & Privacy */}
        <div className="space-y-2">
          <h2 className="text-xs font-mono font-bold text-on-surface-variant uppercase">
            Privacy & Permissions
          </h2>
          <Card className="divide-y divide-outline-variant/20 text-xs font-medium overflow-hidden">
            <button
              onClick={() => setActiveModal('privacy')}
              className="w-full p-3.5 flex items-center justify-between hover:bg-surface-container-high transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">security</span>
                <span>Data & Privacy</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </button>

            <button
              onClick={() => setActiveModal('permissions')}
              className="w-full p-3.5 flex items-center justify-between hover:bg-surface-container-high transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">tune</span>
                <span>App Permissions</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </button>
          </Card>
        </div>

        {/* Sign Out & Delete */}
        <div className="pt-2 space-y-2">
          <Button
            variant="outline"
            className="w-full text-error border-error/40 hover:bg-error/10 font-bold text-xs h-11"
            onClick={() => {
              logout();
              navigate('/auth/login');
            }}
          >
            Sign Out
          </Button>

          <button
            onClick={() => setActiveModal('deleteAccount')}
            className="w-full text-center text-xs text-error/80 hover:text-error hover:underline py-1"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* MODAL 1: EDIT PROFILE */}
      <Dialog
        isOpen={activeModal === 'editProfile'}
        onClose={() => setActiveModal(null)}
        title="Edit Profile"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Display Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface"
            />
          </div>
          <div>
            <label className="font-bold block mb-1">Phone Number</label>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface font-mono"
            />
          </div>
          <Button className="w-full mt-2" isLoading={isSavingProfile} onClick={handleSaveProfile}>
            Save Profile
          </Button>
        </div>
      </Dialog>

      {/* MODAL 2: CHANGE PASSWORD */}
      <Dialog
        isOpen={activeModal === 'changePassword'}
        onClose={() => setActiveModal(null)}
        title="Change Password"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold block mb-1">Current Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface"
            />
          </div>
          <div>
            <label className="font-bold block mb-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface text-on-surface"
            />
          </div>
          <Button className="w-full mt-2" onClick={() => setActiveModal(null)}>
            Update Password
          </Button>
        </div>
      </Dialog>

      {/* MODAL 3: PRIVACY */}
      <Dialog
        isOpen={activeModal === 'privacy'}
        onClose={() => setActiveModal(null)}
        title="Data & Privacy"
      >
        <div className="space-y-3 text-xs text-on-surface-variant">
          <p>
            Mwendo Salama complies with Kenya Data Protection Act (DPA) 2019. Raw GPS telemetry is compressed and stored securely for safety verification.
          </p>
          <div className="p-3 bg-surface-container rounded-xl font-mono text-[11px] text-on-surface">
            ✓ Anonymized Trip Telemetry
            <br />
            ✓ Encrypted Emergency SMS
            <br />✓ Right to Erasure Available
          </div>
          <Button className="w-full mt-2" onClick={() => setActiveModal(null)}>
            Close
          </Button>
        </div>
      </Dialog>

      {/* MODAL 4: PERMISSIONS */}
      <Dialog
        isOpen={activeModal === 'permissions'}
        onClose={() => setActiveModal(null)}
        title="App Permissions"
      >
        <div className="space-y-2 text-xs">
          {[
            { name: 'Location (GPS)', status: 'Allowed' },
            { name: 'Notifications', status: 'Allowed' },
            { name: 'SMS (SOS Alert)', status: 'Allowed' },
            { name: 'Camera', status: 'Allowed' },
          ].map((p, i) => (
            <div key={i} className="flex justify-between p-2 bg-surface-container rounded-lg font-mono">
              <span>{p.name}</span>
              <span className="text-emerald-700 font-bold">{p.status}</span>
            </div>
          ))}
          <Button className="w-full mt-3" onClick={() => setActiveModal(null)}>
            Done
          </Button>
        </div>
      </Dialog>

      {/* MODAL 5: DELETE ACCOUNT */}
      <Dialog
        isOpen={activeModal === 'deleteAccount'}
        onClose={() => setActiveModal(null)}
        title="Permanently Delete Account?"
      >
        <div className="space-y-3 text-xs text-on-surface">
          <p className="text-error font-semibold">
            Warning: This action cannot be undone. All your trip history, trust score, and reports will be deleted.
          </p>
          <div>
            <label className="font-mono text-[11px] block mb-1 text-on-surface-variant">
              Type <span className="font-bold text-error">DELETE</span> to confirm:
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full h-9 px-3 rounded-lg border border-error/50 bg-surface font-mono uppercase text-error"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button
              disabled={deleteConfirmText.toUpperCase() !== 'DELETE'}
              className="flex-1 bg-error text-on-error font-bold"
              onClick={handleConfirmDelete}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
