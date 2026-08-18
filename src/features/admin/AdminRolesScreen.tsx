import React, { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface Capability {
  id: string;
  category: string;
  label: string;
  description: string;
}

export const AdminRolesScreen: React.FC = () => {
  const capabilities: Capability[] = [
    {
      id: 'cap_view_global',
      category: 'DATA ACCESS',
      label: 'Global Cross-Tenant Access',
      description: 'View data across all SACCOs, counties, and commuters without tenant restrictions.',
    },
    {
      id: 'cap_suspend_users',
      category: 'IDENTITY',
      label: 'Suspend & Manage Accounts',
      description: 'Modify user active state and trigger real-time session status revocation.',
    },
    {
      id: 'cap_manage_saccos',
      category: 'ORGANIZATIONS',
      label: 'Register & Suspend SACCOs',
      description: 'Approve, verify, suspend, or decommission registered transport SACCOs.',
    },
    {
      id: 'cap_override_trust',
      category: 'TRUST ENGINE',
      label: 'Manual Trust Score Override',
      description: 'Adjust user reputation scores manually with mandatory audit reasoning.',
    },
    {
      id: 'cap_remote_config',
      category: 'OPERATIONS',
      label: 'Remote Config & Feature Flags',
      description: 'Modify client feature flags, overspeed thresholds, and geofence radii.',
    },
    {
      id: 'cap_maintenance_toggle',
      category: 'OPERATIONS',
      label: 'Maintenance Mode Toggle',
      description: 'Activate or deactivate platform-wide maintenance mode layout.',
    },
    {
      id: 'cap_enforce_inspections',
      category: 'AUTHORITY',
      label: 'Issue Vehicle Impound / Fines',
      description: 'Conduct NTSA roadside inspections and record official impound mandates.',
    },
  ];

  const roles = [
    {
      name: 'System Administrator (Unrestricted)',
      code: 'admin',
      permissions: ['cap_view_global', 'cap_suspend_users', 'cap_manage_saccos', 'cap_override_trust', 'cap_remote_config', 'cap_maintenance_toggle'],
    },
    {
      name: 'Authority Inspector (County / National)',
      code: 'authority',
      permissions: ['cap_enforce_inspections'],
    },
    {
      name: 'SACCO Manager',
      code: 'sacco_manager',
      permissions: [],
    },
    {
      name: 'Passenger / Commuter',
      code: 'passenger',
      permissions: [],
    },
  ];

  return (
    <div className="space-y-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-lg-mobile text-lg text-on-surface font-bold">
            Platform Roles & Capabilities Matrix
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            Granular access controls governing multi-tenant isolation and administrative capabilities.
          </p>
        </div>

        <Badge variant="info">4 Platform Roles Defined</Badge>
      </div>

      {/* Role Policy Context Callout */}
      <div className="p-md rounded-2xl bg-surface-container-lowest border border-outline-variant/30 space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-primary font-bold text-xs">
          <span className="material-symbols-outlined text-base">info</span>
          <span>Role-Based Access Control Policy</span>
        </div>
        <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
          Users may hold multiple assigned role authorizations. Active session permissions are strictly constrained to their currently selected active role, preventing privilege crossover between SACCO and Authority portals.
        </p>
      </div>

      {/* Matrix Table */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-body-sm">
            <thead className="bg-surface-container-low font-label-mono text-[10px] text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/20">
              <tr>
                <th className="p-md w-1/3">Capability Name & Scope</th>
                {roles.map((r) => (
                  <th key={r.code} className="p-md text-center">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {capabilities.map((cap) => (
                <tr key={cap.id} className="hover:bg-surface-container/50">
                  <td className="p-md">
                    <span className="font-label-mono text-[9px] text-primary uppercase font-bold block">
                      {cap.category}
                    </span>
                    <p className="font-bold text-on-surface">{cap.label}</p>
                    <p className="text-[11px] text-on-surface-variant">{cap.description}</p>
                  </td>

                  {roles.map((r) => {
                    const hasPerm = r.permissions.includes(cap.id);
                    return (
                      <td key={r.code} className="p-md text-center align-middle">
                        {hasPerm ? (
                          <span className="material-symbols-outlined text-emerald-500 text-xl">
                            check_circle
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-outline/30 text-xl">
                            cancel
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
