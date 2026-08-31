# Critical role journeys

This directory reserves the browser E2E surface for the three release-critical journeys:

- Passenger: authenticate, view trip state, trigger/report safety flow, verify resulting state.
- SACCO manager: authenticate, inspect managed operations, verify tenant-scoped data.
- Authority/admin: authenticate, inspect oversight/reporting controls, verify privileged actions remain role-gated.

The repository currently has Vitest and React Testing Library coverage but no installed browser runner. Do not mark these journeys as production-verified until a browser runner is provisioned and the flows are executed against the configured Firebase environment.
