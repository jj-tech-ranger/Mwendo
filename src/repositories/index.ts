import { BaseRepository } from './baseRepository';
import { UserProfile, Trip, BlackSpot, SafetyAlert, Vehicle, Driver, Violation, Complaint, AuditLog, TeamUser, InspectionReport, SACCO, PlatformAnalyticsDaily, SaccoAnalyticsDaily, AnalyticsDocument } from '../types';

export class UserRepository extends BaseRepository<UserProfile> {
  constructor() {
    super('users');
  }
}

export class SaccoRepository extends BaseRepository<SACCO> {
  constructor() {
    super('saccos');
  }
}

export class TripRepository extends BaseRepository<Trip> {
  constructor() {
    super('trips');
  }
}

export class BlackSpotRepository extends BaseRepository<BlackSpot> {
  constructor() {
    super('black_spots');
  }
}

export class AlertRepository extends BaseRepository<SafetyAlert> {
  constructor() {
    super('safety_alerts');
  }
}

export class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super('vehicles');
  }
}

export class DriverRepository extends BaseRepository<Driver> {
  constructor() {
    super('drivers');
  }
}

export class ViolationRepository extends BaseRepository<Violation> {
  constructor() {
    super('violations');
  }
}

export class ComplaintRepository extends BaseRepository<Complaint> {
  constructor() {
    super('complaints');
  }
}

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super('audit_logs');
  }
}

export class TeamUserRepository extends BaseRepository<TeamUser> {
  constructor() {
    super('team_users');
  }
}

export class InspectionReportRepository extends BaseRepository<InspectionReport> {
  constructor() {
    super('inspections');
  }
}

export class ProcessedEventRepository extends BaseRepository<{ id: string; eventId: string; handler: string; processedAt: string }> {
  constructor() {
    super('processedEvents');
  }
}

export class AnalyticsRepository extends BaseRepository<AnalyticsDocument> {
  constructor() {
    super('analytics');
  }
}

export class PublicPinRepository extends BaseRepository<{ id: string; title: string; routeName: string; latitude: number; longitude: number; severity: string }> {
  constructor() {
    super('public_pins');
  }
}

export const userRepository = new UserRepository();
export const saccoRepository = new SaccoRepository();
export const tripRepository = new TripRepository();
export const blackSpotRepository = new BlackSpotRepository();
export const alertRepository = new AlertRepository();
export const safetyAlertRepository = alertRepository;
export const vehicleRepository = new VehicleRepository();
export const driverRepository = new DriverRepository();
export const violationRepository = new ViolationRepository();
export const complaintRepository = new ComplaintRepository();
export const auditLogRepository = new AuditLogRepository();
export const teamUserRepository = new TeamUserRepository();
export const inspectionReportRepository = new InspectionReportRepository();
export const processedEventRepository = new ProcessedEventRepository();
export const analyticsRepository = new AnalyticsRepository();
export const publicPinRepository = new PublicPinRepository();
