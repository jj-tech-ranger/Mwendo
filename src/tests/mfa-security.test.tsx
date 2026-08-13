// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { mfaService, TotpSetupData } from '../services/mfaService';
import { RoleGuard } from '../components/common/RoleGuard';
import { useAuthStore } from '../store/useAuthStore';
import * as firestore from 'firebase/firestore';
import { generateTotpToken, verifyTotpToken } from '../../apps/functions/src/auth/verifyTotpChallenge';

const { mockMultiFactorInstance, mockTotpMultiFactorGenerator, mockHttpsCallable } = vi.hoisted(() => {
  return {
    mockMultiFactorInstance: {
      getSession: vi.fn(),
      enroll: vi.fn(),
      unenroll: vi.fn(),
      enrolledFactors: [] as any[],
    },
    mockTotpMultiFactorGenerator: {
      FACTOR_ID: 'totp',
      generateSecret: vi.fn(),
      assertionForEnrollment: vi.fn(),
      assertionForSignIn: vi.fn(),
    },
    mockHttpsCallable: vi.fn(),
  };
});

// Mock firebase/auth
vi.mock('firebase/auth', async (importOriginal) => {
  const original = await importOriginal<Record<string, any>>();
  return {
    ...original,
    multiFactor: vi.fn(() => mockMultiFactorInstance),
    TotpMultiFactorGenerator: mockTotpMultiFactorGenerator,
  };
});

// Mock firebase/functions
vi.mock('firebase/functions', async (importOriginal) => {
  const original = await importOriginal<Record<string, any>>();
  return {
    ...original,
    httpsCallable: vi.fn((_fns, name) => {
      return (data: any) => mockHttpsCallable(name, data);
    }),
  };
});

// Mock firestore updateDoc and doc
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof firestore>();
  return {
    ...original,
    doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
    updateDoc: vi.fn(),
  };
});

describe('AUTH-002 & AUTH-003: MFA Security Hardening & Challenge Verification', () => {
  const KNOWN_SECRET = 'JBSWY3DPEHPK3PXP';

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'admin_123',
        uid: 'admin_123',
        email: 'admin@ntsa.go.ke',
        displayName: 'NTSA Administrator',
        role: 'admin',
        isActive: true,
        isVerified: true,
        isMfaEnrolled: false,
        isMfaVerified: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    // Default mock implementation for verifyTotpChallenge Cloud Function
    mockHttpsCallable.mockImplementation(async (fnName, data) => {
      if (fnName === 'verifyTotpChallenge') {
        const isValid = verifyTotpToken(KNOWN_SECRET, data.code, 1, Date.now());
        if (!isValid) {
          const err: any = new Error('Invalid 6-digit TOTP verification code.');
          err.code = 'functions/invalid-argument';
          throw err;
        }
        return { data: { success: true, verified: true } };
      }
      return { data: { success: true } };
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('AUTH-002: getEnrollmentSecret & enrollTotp', () => {
    it('generates real client-side QR code data URL and does not leak secret to 3rd-party API', async () => {
      const mockTotpSecret = {
        secretKey: KNOWN_SECRET,
        generateQrCodeUrl: vi.fn().mockReturnValue('otpauth://totp/Mwendo%20Salama:admin%40ntsa.go.ke?secret=JBSWY3DPEHPK3PXP&issuer=Mwendo%20Salama'),
      };

      mockMultiFactorInstance.getSession.mockResolvedValue({} as any);
      mockTotpMultiFactorGenerator.generateSecret.mockResolvedValue(mockTotpSecret as any);

      const fakeUser = { uid: 'admin_123', email: 'admin@ntsa.go.ke' } as any;
      const setupData = await mfaService.getEnrollmentSecret(fakeUser);

      expect(setupData.secretKey).toBe(KNOWN_SECRET);
      expect(setupData.qrCodeUrl).toMatch(/^data:image\/png;base64,/);
      expect(setupData.qrCodeUrl).not.toContain('api.qrserver.com');
      expect(setupData.totpSecret).toBe(mockTotpSecret);
    });

    it('propagates error and refuses fallback secret when TOTP is unavailable in Identity Platform', async () => {
      mockMultiFactorInstance.getSession.mockRejectedValue(
        new Error('auth/operation-not-allowed: TOTP is not enabled on this project.')
      );

      const fakeUser = { uid: 'admin_123', email: 'admin@ntsa.go.ke' } as any;

      await expect(mfaService.getEnrollmentSecret(fakeUser)).rejects.toThrow(
        'auth/operation-not-allowed: TOTP is not enabled on this project.'
      );
    });

    it('negative path: fails when TOTP enrollment throws and leaves isMfaEnrolled as false in Firestore', async () => {
      const mockTotpSecret = {
        secretKey: KNOWN_SECRET,
      } as any;

      const setupData: TotpSetupData = {
        secretKey: KNOWN_SECRET,
        qrCodeUrl: 'data:image/png;base64,mock',
        totpSecret: mockTotpSecret,
      };

      mockTotpMultiFactorGenerator.assertionForEnrollment.mockReturnValue({} as any);
      mockMultiFactorInstance.enroll.mockRejectedValue(new Error('auth/invalid-verification-code'));

      const fakeUser = { uid: 'admin_123', email: 'admin@ntsa.go.ke' } as any;

      await expect(
        mfaService.enrollTotp(fakeUser, '123456', setupData)
      ).rejects.toThrow('auth/invalid-verification-code');

      expect(firestore.updateDoc).not.toHaveBeenCalled();

      const currentUser = useAuthStore.getState().user;
      expect(currentUser?.isMfaEnrolled).toBe(false);
      expect(currentUser?.isMfaVerified).toBe(false);
    });

    it('positive path: sets isMfaEnrolled to true and records totpSecret in Firestore after multiFactor.enroll() succeeds', async () => {
      const mockTotpSecret = {
        secretKey: KNOWN_SECRET,
      } as any;

      const setupData: TotpSetupData = {
        secretKey: KNOWN_SECRET,
        qrCodeUrl: 'data:image/png;base64,mock',
        totpSecret: mockTotpSecret,
      };

      mockTotpMultiFactorGenerator.assertionForEnrollment.mockReturnValue({} as any);
      mockMultiFactorInstance.enroll.mockResolvedValue(undefined);

      const fakeUser = { uid: 'admin_123', email: 'admin@ntsa.go.ke' } as any;

      const result = await mfaService.enrollTotp(fakeUser, '654321', setupData);

      expect(result).toBe(true);
      expect(mockMultiFactorInstance.enroll).toHaveBeenCalled();

      expect(firestore.updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/admin_123' }),
        expect.objectContaining({
          isMfaEnrolled: true,
          isMfaVerified: true,
          totpSecret: KNOWN_SECRET,
        })
      );

      const currentUser = useAuthStore.getState().user;
      expect(currentUser?.isMfaEnrolled).toBe(true);
      expect(currentUser?.isMfaVerified).toBe(true);
    });
  });

  describe('AUTH-003: verifyChallenge (Resolver-Present vs Resolver-Null Paths)', () => {
    it('resolver-null path: rejects arbitrary 6-digit code (e.g. 000000) and leaves user unverified', async () => {
      useAuthStore.setState({
        user: {
          id: 'admin_123',
          uid: 'admin_123',
          email: 'admin@ntsa.go.ke',
          displayName: 'NTSA Administrator',
          role: 'admin',
          isActive: true,
          isVerified: true,
          isMfaEnrolled: true,
          isMfaVerified: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // Attempt to verify with arbitrary 6-digit code when resolver is null
      await expect(mfaService.verifyChallenge('000000', null)).rejects.toThrow(
        'Invalid 6-digit TOTP verification code.'
      );

      // User in store MUST NOT be marked isMfaVerified
      const currentUser = useAuthStore.getState().user;
      expect(currentUser?.isMfaVerified).toBe(false);
    });

    it('resolver-null path: succeeds with cryptographically valid TOTP code for the enrolled secret', async () => {
      useAuthStore.setState({
        user: {
          id: 'admin_123',
          uid: 'admin_123',
          email: 'admin@ntsa.go.ke',
          displayName: 'NTSA Administrator',
          role: 'admin',
          isActive: true,
          isVerified: true,
          isMfaEnrolled: true,
          isMfaVerified: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      // Generate a valid TOTP code for the known secret
      const validCode = generateTotpToken(KNOWN_SECRET, Date.now());

      const result = await mfaService.verifyChallenge(validCode, null);
      expect(result).toBe(true);

      const currentUser = useAuthStore.getState().user;
      expect(currentUser?.isMfaVerified).toBe(true);
    });

    it('resolver-present path: verifies via MultiFactorResolver and propagates errors', async () => {
      const mockResolver = {
        hints: [{ factorId: 'totp', uid: 'totp_factor_1' }],
        resolveSignIn: vi.fn().mockResolvedValue(undefined),
      } as any;

      mockTotpMultiFactorGenerator.assertionForSignIn.mockReturnValue({} as any);

      const result = await mfaService.verifyChallenge('123456', mockResolver);
      expect(result).toBe(true);
      expect(mockTotpMultiFactorGenerator.assertionForSignIn).toHaveBeenCalledWith('totp_factor_1', '123456');
      expect(mockResolver.resolveSignIn).toHaveBeenCalled();
    });

    it('resolver-present path: fails and re-throws when resolver.resolveSignIn throws invalid code error', async () => {
      const mockResolver = {
        hints: [{ factorId: 'totp', uid: 'totp_factor_1' }],
        resolveSignIn: vi.fn().mockRejectedValue({ code: 'auth/invalid-verification-code' }),
      } as any;

      mockTotpMultiFactorGenerator.assertionForSignIn.mockReturnValue({} as any);

      await expect(mfaService.verifyChallenge('000000', mockResolver)).rejects.toThrow(
        'Invalid 6-digit TOTP verification code.'
      );
    });
  });

  describe('RoleGuard MFA Gate Security', () => {
    it('strictly denies unenrolled admin from accessing /admin and redirects to /auth/mfa-enrollment', () => {
      useAuthStore.setState({
        user: {
          id: 'admin_123',
          uid: 'admin_123',
          email: 'admin@ntsa.go.ke',
          displayName: 'NTSA Administrator',
          role: 'admin',
          isActive: true,
          isVerified: true,
          isMfaEnrolled: false,
          isMfaVerified: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/auth/mfa-enrollment" element={<div>MFA Enrollment Screen for Admin</div>} />
            <Route element={<RoleGuard allowedRoles={['admin']} />}>
              <Route path="/admin" element={<div>Protected Admin Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('MFA Enrollment Screen for Admin')).toBeTruthy();
      expect(screen.queryByText('Protected Admin Dashboard')).toBeNull();
    });

    it('strictly denies unverified admin from accessing /admin and redirects to /auth/mfa-challenge', () => {
      useAuthStore.setState({
        user: {
          id: 'admin_123',
          uid: 'admin_123',
          email: 'admin@ntsa.go.ke',
          displayName: 'NTSA Administrator',
          role: 'admin',
          isActive: true,
          isVerified: true,
          isMfaEnrolled: true,
          isMfaVerified: false,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/auth/mfa-challenge" element={<div>MFA Challenge Screen for Admin</div>} />
            <Route element={<RoleGuard allowedRoles={['admin']} />}>
              <Route path="/admin" element={<div>Protected Admin Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('MFA Challenge Screen for Admin')).toBeTruthy();
      expect(screen.queryByText('Protected Admin Dashboard')).toBeNull();
    });
  });
});
