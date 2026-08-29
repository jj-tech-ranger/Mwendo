import { describe, it, expect, vi } from 'vitest';
import { processSendSosLogic } from '../../apps/functions/src/alerts/sendSOS';

describe('CF-006: Emergency SOS Backend Dispatch & DLQ Verification', () => {
  it('dispatches SMS to user emergency contacts and FCM to SACCO and Authority channels', async () => {
    const savedDocs: Record<string, any> = {};

    const mockDb: any = {
      collection: (col: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (col === 'users' && id === 'passenger_001') {
              return {
                exists: true,
                data: () => ({
                  displayName: 'Wangari Maathai',
                  phoneNumber: '+254700000001',
                  emergencyContacts: [
                    { name: 'John Doe', relationship: 'Brother', phone: '+254711111111' },
                    { name: 'Grace Doe', relationship: 'Mother', phone: '+254722222222' },
                  ],
                }),
              };
            }
            return { exists: false, data: () => ({}) };
          },
          create: async (data: any) => {
            const key = `${col}/${id}`;
            if (savedDocs[key]) throw new Error('ALREADY_EXISTS');
            savedDocs[key] = data;
          },
          set: async (data: any) => {
            savedDocs[`${col}/${id}`] = data;
          },
          update: async (data: any) => {
            const key = `${col}/${id}`;
            savedDocs[key] = { ...(savedDocs[key] || {}), ...data };
          },
        }),
      }),
    };

    const mockMessaging: any = {
      sendToTopic: vi.fn().mockResolvedValue({ messageId: 'fcm-msg-id-123' }),
    };

    const mockSms: any = {
      sendSms: vi.fn().mockResolvedValue({ messageId: 'sms-msg-id-123', success: true }),
    };

    const payload = {
      alertId: 'sos_alert_100',
      userId: 'passenger_001',
      vehicleRegNumber: 'KDA 123B',
      saccoId: 'sacco_metro_trans',
      location: { lat: -1.286389, lng: 36.817223 },
      speedKmH: 95,
      message: 'Urgent SOS triggered',
    };

    const result = await processSendSosLogic(mockDb, mockMessaging, mockSms, payload);

    expect(result.success).toBe(true);
    expect(result.contactsNotifiedCount).toBe(2);
    expect(result.fcmDispatchedCount).toBe(2);
    expect(result.dlqCount).toBe(0);
    expect(mockSms.sendSms).toHaveBeenCalledTimes(2);
    expect(mockSms.sendSms).toHaveBeenCalledWith('+254711111111', expect.stringContaining('Wangari Maathai'));
    expect(mockSms.sendSms).toHaveBeenCalledWith('+254722222222', expect.stringContaining('KDA 123B'));
    expect(mockMessaging.sendToTopic).toHaveBeenCalledWith('sacco_sacco_metro_trans', expect.objectContaining({ notification: expect.objectContaining({ title: expect.stringContaining('KDA 123B') }) }));
    expect(mockMessaging.sendToTopic).toHaveBeenCalledWith('authority_alerts', expect.objectContaining({ notification: expect.objectContaining({ title: expect.stringContaining('KDA 123B') }) }));

    const alertDoc = savedDocs['safety_alerts/sos_alert_100'];
    expect(alertDoc).toBeDefined();
    expect(alertDoc.smsDispatchedCount).toBe(2);
    expect(alertDoc.emergencyContactsCount).toBe(2);
    expect(alertDoc.emergencyContacts).toBeUndefined();
  });

  it('routes failed SMS dispatches to Dead Letter Queue (dlq_notifications)', async () => {
    const savedDocs: Record<string, any> = {};

    const mockDb: any = {
      collection: (col: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (col === 'users' && id === 'passenger_002') {
              return {
                exists: true,
                data: () => ({
                  displayName: 'Kipchoge Keino',
                  emergencyContacts: [
                    { name: 'Valid Contact', relationship: 'Spouse', phone: '+254711000000' },
                    { name: 'Failing Contact', relationship: 'Friend', phone: '+254799999999' },
                  ],
                }),
              };
            }
            return { exists: false, data: () => ({}) };
          },
          create: async (data: any) => {
            const key = `${col}/${id}`;
            if (savedDocs[key]) throw new Error('ALREADY_EXISTS');
            savedDocs[key] = data;
          },
          set: async (data: any) => {
            savedDocs[`${col}/${id}`] = data;
          },
          update: async (data: any) => {
            const key = `${col}/${id}`;
            savedDocs[key] = { ...(savedDocs[key] || {}), ...data };
          },
        }),
      }),
    };

    const mockMessaging: any = {
      sendToTopic: vi.fn().mockResolvedValue({ messageId: 'fcm-msg-id' }),
    };

    const mockSms: any = {
      sendSms: vi.fn().mockImplementation(async (to: string) => {
        if (to === '+254799999999') {
          throw new Error('Twilio Network Error: Destination unreachable');
        }
        return { messageId: 'sms-ok', success: true };
      }),
    };

    const result = await processSendSosLogic(mockDb, mockMessaging, mockSms, {
      alertId: 'sos_alert_200',
      userId: 'passenger_002',
      vehicleRegNumber: 'KBZ 999A',
      saccoId: 'sacco_express',
      location: { lat: -0.0917, lng: 34.768 },
    });

    expect(result.success).toBe(true);
    expect(result.contactsNotifiedCount).toBe(1);
    expect(result.dlqCount).toBe(1);
    const dlqKeys = Object.keys(savedDocs).filter((k) => k.startsWith('dlq_notifications/'));
    expect(dlqKeys.length).toBe(1);
    const firstKey = dlqKeys[0]!;
    const dlqEntry = savedDocs[firstKey];
    expect(dlqEntry.topic).toBe('safety-alerts');
    expect(dlqEntry.type).toBe('sms_emergency_contact');
    expect(dlqEntry.targetRecipient).toContain('Failing Contact');
    expect(dlqEntry.errorMessage).toContain('Twilio Network Error');
    expect(dlqEntry.status).toBe('failed_dead_letter');
  });
});
