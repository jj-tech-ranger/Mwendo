// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { SaccoUsersScreen } from '../features/sacco/SaccoUsersScreen';
import { useAuthStore } from '../store/useAuthStore';
import { functionsService } from '../services/functionsService';
import { inMemoryStore } from '../repositories/baseRepository';
import { TeamUser } from '../types';

describe('Sacco Team Invite & Admin Provisioning End-to-End Flow (Prompt 12)', () => {
  beforeEach(() => {
    // Reset inMemoryStore for team_users
    inMemoryStore['team_users'] = new Map<string, unknown>([
      [
        'team_001',
        {
          id: 'team_001',
          saccoId: 'sacco_2nk',
          name: 'Samuel Ndung’u',
          email: 'ops@2nksacco.co.ke',
          role: 'sacco_manager',
          status: 'active',
          lastActive: '2026-03-10',
        } as TeamUser,
      ],
    ]);

    // Setup Sacco Manager auth state
    useAuthStore.setState({
      user: {
        uid: 'user_sacco_mgr',
        id: 'user_sacco_mgr',
        displayName: 'Samuel Ndung’u',
        email: 'ops@2nksacco.co.ke',
        role: 'sacco_manager',
        activeRole: 'sacco_manager',
        saccoId: 'sacco_2nk',
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders initial active team members with correct badges and no pending banner', async () => {
    render(<SaccoUsersScreen />);

    expect(screen.getByText('Samuel Ndung’u')).toBeTruthy();
    expect(screen.getByText('ops@2nksacco.co.ke')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('2026-03-10')).toBeTruthy();

    // No pending invites banner should be shown initially
    expect(screen.queryByText(/One or more team members are awaiting platform administrator/i)).toBeNull();
  });

  it('creates a real pending team user request when Send Invitation is submitted, live-updating to Pending Admin Approval', async () => {
    render(<SaccoUsersScreen />);

    // Open invite dialog
    const openBtn = screen.getByTestId('open-invite-modal-btn');
    fireEvent.click(openBtn);

    expect(screen.getByText('Invite Team Member')).toBeTruthy();
    expect(
      screen.getByText(/Sending an invitation creates a verified pending role request/i)
    ).toBeTruthy();

    // Fill in invite details
    const nameInput = screen.getByPlaceholderText('e.g. Jane Mutesi');
    const emailInput = screen.getByPlaceholderText('jane@metrolink.co.ke');
    fireEvent.change(nameInput, { target: { value: 'Wanjiku Mwangi' } });
    fireEvent.change(emailInput, { target: { value: 'wanjiku@2nk.co.ke' } });

    // Click Send Invitation
    const sendBtn = screen.getByTestId('send-invitation-btn');
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // Verify row appeared live via the real-time subscription
    await waitFor(() => {
      expect(screen.getByText('Wanjiku Mwangi')).toBeTruthy();
      expect(screen.getByText('wanjiku@2nk.co.ke')).toBeTruthy();
    });

    // Verify status displays honest "Pending Admin Approval" and NOT misleading "Pending Acceptance"
    expect(screen.getByText('Pending Admin Approval')).toBeTruthy();
    expect(screen.getByText('Awaiting Admin Approval')).toBeTruthy();
    expect(screen.queryByText('Pending Acceptance')).toBeNull();

    // Verify the pending banner is now shown
    expect(
      screen.getByText(/One or more team members are awaiting platform administrator custom claim authorization/i)
    ).toBeTruthy();
  });

  it(
    'transitions from Pending Admin Approval to Active in real-time when Admin authorizes the request',
    async () => {
    render(<SaccoUsersScreen />);

    // 1. Submit invitation
    fireEvent.click(screen.getByTestId('open-invite-modal-btn'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Jane Mutesi'), { target: { value: 'David Kimani' } });
    fireEvent.change(screen.getByPlaceholderText('jane@metrolink.co.ke'), { target: { value: 'david@2nk.co.ke' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('send-invitation-btn'));
    });

    // Locate the newly created invite in memory store
    const store = inMemoryStore['team_users'] || new Map<string, unknown>();
    const invitedUser = Array.from(store.values() as Iterable<TeamUser>).find(
      (u) => u.email === 'david@2nk.co.ke'
    );
    expect(invitedUser).toBeDefined();
    expect(invitedUser?.status).toBe('invited');

    // Confirm UI shows pending state
    await waitFor(() => {
      const badge = screen.getByTestId(`status-badge-${invitedUser!.id}`);
      expect(badge.textContent).toContain('Pending Admin Approval');
      const lastActive = screen.getByTestId(`last-active-${invitedUser!.id}`);
      expect(lastActive.textContent).toContain('Awaiting Admin Approval');
    });

    // 2. Simulate Platform Admin approving and provisioning the role via functionsService.assignUserRole
    await act(async () => {
      await functionsService.assignUserRole({
        targetUid: 'david_firebase_uid_789',
        newRole: 'sacco_manager',
        saccoId: 'sacco_2nk',
        teamUserId: invitedUser!.id,
      });
    });

    // 3. Confirm UI flips to Active automatically via subscription without manual refresh
    await waitFor(() => {
      const badge = screen.getByTestId(`status-badge-${invitedUser!.id}`);
      expect(badge.textContent).toContain('Active');
      const lastActive = screen.getByTestId(`last-active-${invitedUser!.id}`);
      expect(lastActive.textContent).toContain('Active');
    });

    // Confirm no pending banner remains
    expect(screen.queryByText(/One or more team members are awaiting platform administrator/i)).toBeNull();
  }, 15000);
});
