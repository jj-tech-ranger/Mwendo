/**
 * Source of Truth: Canonical Platform User Roles
 * - 'passenger': Commuters using the app for trip safety monitoring, SOS alerts, hazard reporting, and trip history. Used in /passenger shell.
 * - 'sacco_manager': SACCO administrators managing fleet vehicles, drivers, speed violations, and compliance. Used in /sacco shell.
 * - 'authority': NTSA / Traffic Police inspectors conducting vehicle inspections, reviewing complaints, and monitoring black spots. Used in /authority shell.
 * - 'admin': System administrators managing platform users, SACCO registrations, security policies, and system health. Used in /admin shell.
 */
export type UserRole = 'passenger' | 'sacco_manager' | 'authority' | 'admin';

export interface UserClaims {
  activeRole?: UserRole | undefined;
  saccoId?: string | undefined;
  authorityScope?: ('national' | 'county') | undefined;
  isSuspended?: boolean | undefined;
  [key: string]: unknown;
}

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string | undefined;
  role: UserRole;
  activeRole?: UserRole | undefined;
  claimedActiveRole?: UserRole | undefined;
  claimedSaccoId?: string | undefined;
  claimedAuthorityScope?: ('national' | 'county') | undefined;
  claimedIsSuspended?: boolean | undefined;
  claims?: UserClaims | undefined;
  saccoId?: string | undefined;
  authorityId?: string | undefined;
  authorityScope?: ('national' | 'county') | undefined;
  county?: string | undefined;
  badgeNumber?: string | undefined;
  isVerified: boolean;
  isActive: boolean;
  isMfaEnrolled?: boolean | undefined;
  isMfaVerified?: boolean | undefined;
  isAnonymous?: boolean | undefined;
  trustScore?: number | undefined;
  termsAccepted?: boolean | undefined;
  privacyPolicyVersion?: string | undefined;
  termsAcceptedAt?: string | undefined;
  ageConfirmed?: boolean | undefined;
  ageConfirmedAt?: string | undefined;
  analyticsConsent?: boolean | undefined;
  analyticsConsentAt?: string | undefined;
  emergencyContacts?: Array<{ name: string; phone: string; relationship: string }> | undefined;
  language?: 'en' | 'sw' | undefined;
  theme?: 'light' | 'dark' | 'system' | undefined;
  notificationPreferences?: { overspeedAlerts: boolean; blackspotWarnings: boolean; weeklyDigest: boolean } | undefined;
  createdAt: string;
  updatedAt: string;
}

export type TripStatus = 'active' | 'completed' | 'auto_completed' | 'incomplete_signal_lost' | 'discarded';

import type { Timestamp } from 'firebase/firestore';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  speedKmH: number;
  accuracy?: number;
  timestamp: Timestamp | string;
  heading?: number;
}

export interface Trip {
  id: string;
  tripId?: string | undefined;
  vehicleId: string;
  vehicleRegNumber: string;
  plateNumber?: string | undefined;
  saccoId: string;
  saccoName: string;
  routeName: string;
  origin?: string | undefined;
  destination?: string | undefined;
  status: TripStatus;
  currentSpeedKmH: number;
  maxSpeedKmH: number;
  avgSpeedKmH: number;
  driverName?: string | undefined;
  passengerCount?: number | undefined;
  startTime: Timestamp | string;
  endTime?: Timestamp | string | undefined;
  durationSeconds?: number | undefined;
  distanceMeters?: number | undefined;
  overspeedEventsCount?: number | undefined;
  violationsCount?: number | undefined;
  userId?: string | undefined;
  startLocation?: { latitude: number; longitude: number; geohash?: string } | undefined;
  endLocation?: { latitude: number; longitude: number; geohash?: string } | undefined;
  lastGpsUpdate?: GPSPoint | undefined;
  telemetryStoragePath?: string | undefined;
  traceId?: string | undefined;
  timestamp?: Timestamp | string | undefined;
  createdAt?: Timestamp | string | undefined;
  updatedAt?: Timestamp | string | undefined;
}

export interface Vehicle {
  id: string;
  regNumber: string;
  saccoId: string;
  saccoName: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'suspended';
  insuranceExpiry: string;
  inspectionExpiry: string;
  riskScore?: number;
  riskTier?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SACCO {
  id: string;
  name: string;
  registrationCode: string;
  fleetCount: number;
  safetyScore: number;
  contactPhone: string;
  contactEmail: string;
  status: 'active' | 'under_review' | 'suspended';
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type HazardType = 'accident_prone' | 'pothole' | 'carjacking_risk' | 'poor_lighting' | 'unmarked_bump' | 'police_checkpoint' | 'flash_flooding';

export interface BlackSpot {
  id: string; spotId?: string; name: string; title?: string; routeName: string; county?: string;
  latitude: number; longitude: number; radiusMeters?: number; severity: SeverityLevel; hazardType?: HazardType;
  accidentCount12M?: number; hazardDescription: string; description?: string; reportedByUid: string;
  verifiedByAuthority?: boolean; corroborationCount?: number; confidenceScore?: number; evidencePhotoUrls?: string[];
  status?: 'pending' | 'published' | 'under_review' | 'rejected'; createdAt: string; updatedAt?: string;
}

export type AlertType = 'overspeeding' | 'blackspot_approaching' | 'harsh_braking' | 'sos' | 'route_deviation';
export interface SafetyAlert { id: string; tripId: string; userId?: string; vehicleRegNumber: string; driverName?: string; saccoId: string; type: AlertType; severity: SeverityLevel; message: string; latitude: number; longitude: number; speedKmH: number; timestamp: string; acknowledgedBySacco?: boolean; acknowledgedByAuthority?: boolean; status?: 'active' | 'resolved' | 'cancelled'; }
export interface PlatformAnalyticsDaily { id: string; docId?: string; date: string; type: 'daily' | 'platform_daily'; totalTrips: number; totalViolations: number; activeAlerts: number; riskDistribution: { low: number; medium: number; high: number; critical: number }; updatedAt: string; }
export interface SaccoAnalyticsDaily { id: string; docId?: string; saccoId: string; type: 'sacco' | 'sacco_daily'; safetyScore: number; fleetCount: number; unresolvedComplaints: number; updatedAt: string; }
export type AnalyticsDocument = PlatformAnalyticsDaily | SaccoAnalyticsDaily;
export interface Driver { id: string; name: string; licenseNumber: string; saccoId: string; assignedVehicleReg?: string; routeName?: string; status: 'active' | 'on_leave' | 'suspended'; safetyScore: number; phone?: string; totalTrips?: number; totalViolations?: number; createdAt?: string; }
export interface Violation { id: string; violationId?: string; saccoId: string; userId?: string; vehicleRegNumber: string; driverName?: string; routeName?: string; recordedSpeedKmH: number; speedLimitKmH: number; severity: SeverityLevel; confidenceScore: number; isCorroborated: boolean; timestamp: Timestamp | string; status: 'pending' | 'reviewed' | 'disputed' | 'dismissed'; locationName?: string; latitude?: number; longitude?: number; createdAt?: Timestamp | string; updatedAt?: Timestamp | string; }
export interface Complaint { id: string; saccoId: string; vehicleRegNumber?: string; passengerName?: string; reportedByUid?: string; title: string; description: string; status: 'open' | 'investigating' | 'resolved'; createdAt: string; }
export interface AuditLog { id: string; saccoId: string; actorName: string; actorRole: string; action: string; target: string; timestamp: string; }
export interface TeamUser { id: string; saccoId: string; name: string; email: string; role: 'sacco_manager' | 'operations' | 'viewer'; status: 'active' | 'invited' | 'suspended'; lastActive?: string; }
export interface InspectionReport { id: string; vehicleRegNumber: string; saccoId: string; saccoName?: string; inspectorId: string; inspectorName: string; county: string; inspectionDate: string; speedGovernorStatus: 'valid' | 'tampered' | 'expired' | 'missing'; brakeStatus: 'pass' | 'fail'; tireStatus: 'pass' | 'fail'; overallResult: 'passed' | 'failed' | 'impounded' | 'suspended'; certificateNumber?: string; expiryDate?: string; notes?: string; createdAt: string; }
export interface UserRateLimitDoc { id: string; userId: string; sosTimestamps?: number[]; blackSpotTimestamps?: number[]; updatedAt: string; }
