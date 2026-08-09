import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatusChip } from '../../components/ui/StatusChip';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import { FilterChip, FilterGroup } from '../../components/ui/FilterChip';
import { MediaUploader } from '../../components/ui/MediaUploader';
import { Dialog } from '../../components/ui/Dialog';
import { Drawer } from '../../components/ui/Drawer';
import { Alert } from '../../components/ui/Alert';
import { Spinner, ProgressBar, PulsingRing } from '../../components/ui/LoadingIndicators';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ToastProvider, useToast } from '../../components/ui/Toast';
import { DataTable, Column } from '../../components/ui/DataTable';
import {
  MetricCard,
  VehicleCard,
  TripCard,
  HazardCard,
  AnalyticsWidget,
  ProfileCard,
} from '../../components/ui/DomainCards';
import {
  LineChartWrapper,
  AreaChartWrapper,
  BarChartWrapper,
  DonutChartWrapper,
} from '../../components/charts/Charts';
import { MapComponent } from '../../components/map/MapComponent';
import { useThemeStore } from '../../store/useThemeStore';
import { BRAND_ASSETS } from '../../components/assets/BrandAssets';

interface DemoRow {
  id: string;
  plateNumber: string;
  saccoName: string;
  routeName: string;
  riskScore: number;
  status: string;
}

const demoTableData: DemoRow[] = [
  { id: '1', plateNumber: 'KDA 123A', saccoName: 'MetroLink SACCO', routeName: 'Thika Road', riskScore: 12, status: 'Active' },
  { id: '2', plateNumber: 'KCB 456B', saccoName: 'GreenLine SACCO', routeName: 'Waiyaki Way', riskScore: 45, status: 'Active' },
  { id: '3', plateNumber: 'KDD 789C', saccoName: 'TransitStar SACCO', routeName: 'Mombasa Road', riskScore: 88, status: 'Flagged' },
  { id: '4', plateNumber: 'KBA 321D', saccoName: 'CityRide SACCO', routeName: 'Ngong Road', riskScore: 24, status: 'Active' },
  { id: '5', plateNumber: 'KCC 654E', saccoName: 'MetroLink SACCO', routeName: 'Thika Road', riskScore: 68, status: 'Provisional' },
];

const demoColumns: Column<DemoRow>[] = [
  { key: 'plateNumber', header: 'Plate Number', sortable: true },
  { key: 'saccoName', header: 'SACCO', sortable: true },
  { key: 'routeName', header: 'Route', sortable: true },
  {
    key: 'riskScore',
    header: 'Risk Level',
    sortable: true,
    render: (row) => <StatusChip score={row.riskScore} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <Badge variant={row.status === 'Active' ? 'success' : row.status === 'Flagged' ? 'danger' : 'warning'}>
        {row.status}
      </Badge>
    ),
  },
];

const demoChartData = [
  { name: 'Mon', trips: 120, violations: 4, safetyScore: 92 },
  { name: 'Tue', trips: 150, violations: 8, safetyScore: 88 },
  { name: 'Wed', trips: 180, violations: 2, safetyScore: 96 },
  { name: 'Thu', trips: 140, violations: 12, safetyScore: 82 },
  { name: 'Fri', trips: 210, violations: 5, safetyScore: 91 },
  { name: 'Sat', trips: 250, violations: 14, safetyScore: 78 },
  { name: 'Sun', trips: 190, violations: 3, safetyScore: 94 },
];

const demoPieData = [
  { name: 'Overspeed', value: 45, color: '#C0392B' },
  { name: 'Harsh Braking', value: 25, color: '#E67E22' },
  { name: 'Black Spot Proximity', value: 20, color: '#185FA5' },
  { name: 'Signal Loss', value: 10, color: '#0F6E56' },
];

const ComponentShowcaseInner: React.FC = () => {
  const { mode, setMode, variant, setVariant } = useThemeStore();
  const { showToast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [simulatedState, setSimulatedState] = useState<'normal' | 'loading' | 'disabled' | 'error'>('normal');

  const isSimLoading = simulatedState === 'loading';
  const isSimDisabled = simulatedState === 'disabled';

  return (
    <div className="min-h-screen bg-background text-on-surface p-md sm:p-xl space-y-xl font-body-md max-w-7xl mx-auto">
      {/* Header & Controls Panel */}
      <div className="bg-surface-container-lowest p-lg rounded-2xl border border-outline-variant/30 shadow-md space-y-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
          <div className="flex items-center gap-3">
            <img src={BRAND_ASSETS.appIcon} alt="Mwendo Salama" className="w-12 h-12 rounded-xl" />
            <div>
              <h1 className="font-headline-lg-mobile sm:font-headline-lg text-primary">
                Mwendo Salama Component Showcase
              </h1>
              <p className="font-body-sm text-on-surface-variant">
                Gated UI design system showcase rendering every reusable component across all theme states.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Phase 2 Reusable Library</Badge>
            <Badge variant="success">Fidelity Verified</Badge>
          </div>
        </div>

        {/* Global Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md pt-md border-t border-outline-variant/20">
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Color Theme Mode
            </label>
            <div className="flex gap-1">
              {(['light', 'dark'] as const).map((m) => (
                <Button
                  key={m}
                  variant={mode === m ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setMode(m)}
                  className="capitalize flex-1"
                >
                  {m} Mode
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Shell Variant Theme
            </label>
            <div className="flex gap-1">
              {(['default', 'authority', 'admin'] as const).map((v) => (
                <Button
                  key={v}
                  variant={variant === v ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setVariant(v)}
                  className="capitalize flex-1 text-xs"
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Simulate Primitive State
            </label>
            <div className="flex gap-1">
              {(['normal', 'loading', 'disabled', 'error'] as const).map((s) => (
                <Button
                  key={s}
                  variant={simulatedState === s ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSimulatedState(s)}
                  className="capitalize flex-1 text-[11px] px-1"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 1. BUTTONS SECTION */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          1. Buttons (Variants, Sizes & States)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
          <Card variant="default" className="space-y-sm">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">Primary Button</span>
            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm" isLoading={isSimLoading} disabled={isSimDisabled}>
                Small Primary
              </Button>
              <Button size="md" isLoading={isSimLoading} disabled={isSimDisabled}>
                Medium Primary
              </Button>
              <Button size="lg" isLoading={isSimLoading} disabled={isSimDisabled}>
                Large Primary
              </Button>
            </div>
          </Card>

          <Card variant="default" className="space-y-sm">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">Secondary & Outline</span>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="secondary" size="md" isLoading={isSimLoading} disabled={isSimDisabled}>
                Secondary
              </Button>
              <Button variant="outline" size="md" isLoading={isSimLoading} disabled={isSimDisabled}>
                Outline
              </Button>
              <Button variant="ghost" size="md" isLoading={isSimLoading} disabled={isSimDisabled}>
                Ghost
              </Button>
            </div>
          </Card>

          <Card variant="default" className="space-y-sm">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">Danger & Full-Width</span>
            <div className="space-y-2">
              <Button variant="danger" size="md" className="w-full" isLoading={isSimLoading} disabled={isSimDisabled}>
                Emergency Action Button
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 2. BADGES, TAGS, PILLS & STATUS CHIPS */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          2. Badges, Tags, Pills & Risk Status Chips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <Card variant="default" className="space-y-sm">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">
              Risk-Coded Status Chips
            </span>
            <div className="flex flex-wrap gap-3 items-center pt-2">
              <StatusChip score={18} />
              <StatusChip score={48} />
              <StatusChip score={88} />
              <StatusChip riskLevel="info" label="GPS Tracked" />
            </div>
          </Card>

          <Card variant="default" className="space-y-sm">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">
              Badges & Leaderboard Medals
            </span>
            <div className="flex flex-wrap gap-2 items-center pt-2">
              <Badge variant="success">Verified SACCO</Badge>
              <Badge variant="warning">Provisional</Badge>
              <Badge variant="danger">Suspended</Badge>
              <Badge variant="info">Authority Live</Badge>
              <StatusChip rank={1} />
              <StatusChip rank={2} />
              <StatusChip rank={3} />
            </div>
          </Card>
        </div>
      </section>

      {/* 3. AVATARS */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          3. Avatars (Generated Initials — No Placeholder Photography)
        </h2>
        <Card variant="default" className="flex flex-wrap items-center gap-lg">
          <Avatar name="Juma Commuter" size="xs" />
          <Avatar name="Amina Inspector" size="sm" status="online" />
          <Avatar name="MetroLink Manager" size="md" isVerified />
          <Avatar name="Mwendo Salama" size="lg" status="busy" />
          <Avatar name="NTSA Admin" size="xl" isVerified status="online" />
        </Card>
      </section>

      {/* 4. DOMAIN CARDS & STAT METRICS */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          4. Domain Cards & Metric Widgets
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <MetricCard
            title="Total Tracked Trips"
            value="15,420"
            subtitle="Corridor network active"
            trend={{ value: 14.2, label: 'vs last month', isPositiveGood: true }}
            icon="directions_bus"
          />
          <MetricCard
            title="Active Violations"
            value="18"
            subtitle="Sustained overspeed events"
            trend={{ value: -8.5, label: 'vs yesterday', isPositiveGood: true }}
            icon="speed"
            themeContext="authority"
          />
          <MetricCard
            title="Validated Black Spots"
            value="2,104"
            subtitle="Crowdsourced reports"
            trend={{ value: 5.1, label: 'verified by commuters' }}
            icon="report_problem"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          <VehicleCard
            plateNumber="KDA 123A"
            saccoName="MetroLink SACCO"
            routeName="Thika Superhighway"
            riskScore={18}
            totalViolations={1}
            status="active"
            onAction={() => showToast('info', 'Vehicle Selected', 'Viewing details for KDA 123A')}
          />

          <TripCard
            routeName="Thika Road - Nairobi CBD"
            plateNumber="KCB 456B"
            saccoName="GreenLine SACCO"
            startTime="Today, 08:30 AM"
            durationMinutes={38}
            maxSpeedKmh={78}
            violationsCount={0}
            safetyScore={98}
            status="active"
            onSelect={() => showToast('success', 'Trip Selected', 'Thika Road active trip')}
          />

          <HazardCard
            title="Unmarked Speed Bump"
            hazardType="Unmarked Bump"
            locationName="Mombasa Road - Near Airport Turnoff"
            severity="high"
            corroborations={24}
            status="published"
            onAction={() => showToast('warning', 'Hazard Selected', 'Mombasa Road Speed Bump')}
          />
        </div>

        <ProfileCard
          displayName="Juma Commuter"
          email="juma@example.com"
          role="Passenger"
          trustScore={82}
          tripsCount={47}
          reportsCount={12}
        />
      </section>

      {/* 5. INPUTS, SEARCH, FILTERS & MEDIA UPLOADER */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          5. Inputs, Search, Filters & Media Uploader
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <Card variant="default" className="space-y-md">
            <Input
              label="PSV Registration Plate"
              placeholder="e.g. KDA 123A"
              icon="badge"
              disabled={isSimDisabled}
              error={simulatedState === 'error' ? 'Invalid Kenyan plate format' : undefined}
            />

            <SearchInput
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onClear={() => setSearchValue('')}
              placeholder="Search routes, SACCOs, drivers..."
            />

            <div>
              <span className="block text-xs font-label-bold text-on-surface-variant uppercase mb-2">
                Filter Group
              </span>
              <FilterGroup
                options={[
                  { key: 'all', label: 'All Reports', count: 42 },
                  { key: 'active', label: 'Active Trips', count: 18 },
                  { key: 'pending', label: 'Pending Queue', count: 5 },
                ]}
                activeKey={activeFilter}
                onChange={setActiveFilter}
              />
            </div>
          </Card>

          <Card variant="default" className="space-y-md">
            <MediaUploader
              label="Black Spot Evidence Photo"
              helperText="Upload road photo (PNG/JPG up to 5MB)"
            />
          </Card>
        </div>
      </section>

      {/* 6. DATA TABLE & PAGINATION */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          6. Table (&lt;DataTable&gt; - Sorting, Filtering, Search &amp; Pagination)
        </h2>
        <DataTable
          columns={demoColumns}
          data={demoTableData}
          isLoading={isSimLoading}
          emptyTitle="No Vehicles Found"
          searchPlaceholder="Search vehicles by plate or SACCO..."
        />
      </section>

      {/* 7. CHARTS (RECHARTS WRAPPERS) */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          7. Charts (Themed Recharts Wrappers)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
          <AnalyticsWidget title="Weekly Safety Score Trend" subtitle="7-day rolling average">
            <LineChartWrapper
              data={demoChartData}
              xKey="name"
              lines={[{ key: 'safetyScore', name: 'Safety Score (%)', color: '#1A5C2E' }]}
              isLoading={isSimLoading}
            />
          </AnalyticsWidget>

          <AnalyticsWidget title="Violations Distribution" subtitle="By Hazard & Violation Category">
            <DonutChartWrapper data={demoPieData} isLoading={isSimLoading} />
          </AnalyticsWidget>
        </div>
      </section>

      {/* 8. MAP COMPONENT */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          8. Map Presentational Wrapper
        </h2>
        <MapComponent centerAddress="Thika Road Corridor - Nairobi" />
      </section>

      {/* 9. DIALOGS, DRAWERS, TOASTS & ALERTS */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          9. Modals, Bottom Sheets, Alerts &amp; Toast System
        </h2>

        <Card variant="default" className="space-y-md">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setIsDialogOpen(true)}>
              Open Modal Dialog
            </Button>
            <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>
              Open Bottom Sheet
            </Button>
            <Button
              variant="outline"
              onClick={() => showToast('success', 'Report Verified', 'Black spot published to map')}
            >
              Trigger Success Toast
            </Button>
            <Button
              variant="danger"
              onClick={() => showToast('error', 'Overspeed Alert', 'Vehicle exceeded 90 km/h')}
            >
              Trigger Error Toast
            </Button>
          </div>

          <div className="space-y-2 pt-2">
            <Alert variant="info" title="System Status">
              Live GPS telemetry connected to europe-west2 region.
            </Alert>
            <Alert variant="warning" title="Black Spot Warning">
              Approaching high-risk corridor segment on Mombasa Road.
            </Alert>
          </div>
        </Card>

        {/* Dialog Instance */}
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title="Confirm Action"
          description="Are you sure you want to perform this operation on the Mwendo Salama platform?"
          primaryActionLabel="Confirm"
          onPrimaryAction={() => {
            setIsDialogOpen(false);
            showToast('success', 'Action Confirmed', 'The operation completed successfully.');
          }}
        />

        {/* Drawer Instance */}
        <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Hazard Details">
          <div className="space-y-md py-md">
            <p className="font-body-md text-on-surface-variant">
              Detailed breakdown of the reported black spot including passenger corroborations and photo evidence.
            </p>

            <HazardCard
              title="Pothole Hotspot"
              hazardType="Pothole"
              locationName="Waiyaki Way - Kangemi"
              severity="medium"
              corroborations={12}
              status="published"
            />

            <Button variant="primary" className="w-full" onClick={() => setIsDrawerOpen(false)}>
              Done
            </Button>
          </div>
        </Drawer>
      </section>

      {/* 10. LOADING INDICATORS & SKELETONS */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          10. Loading Indicators &amp; Skeletons
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <Card variant="default" className="space-y-md">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">
              Spinners &amp; Pulsing Rings
            </span>
            <div className="flex items-center gap-lg">
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
              <PulsingRing size={48} />
            </div>
            <ProgressBar progress={68} label="Syncing Telemetry" />
          </Card>

          <Card variant="default" className="space-y-md">
            <span className="font-label-bold text-xs uppercase text-on-surface-variant">
              Shimmering Skeletons
            </span>
            <div className="space-y-2">
              <Skeleton className="h-6 w-3/4 rounded-lg" />
              <Skeleton className="h-4 w-1/2 rounded-lg" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </Card>
        </div>
      </section>

      {/* 11. EMPTY STATES */}
      <section className="space-y-md">
        <h2 className="font-headline-lg-mobile text-xl text-primary border-b border-outline-variant/20 pb-2">
          11. Empty State Family
        </h2>
        <Card variant="default">
          <EmptyState
            icon="directions_bus"
            title="No Active Trips"
            description="Start tracking your PSV journey to record live speed telemetry and safety metrics."
            primaryCtaLabel="Start Trip"
            onPrimaryCta={() => showToast('info', 'Start Trip', 'Opening trip flow...')}
          />
        </Card>
      </section>
    </div>
  );
};

export const ComponentShowcaseScreen: React.FC = () => {
  return (
    <ToastProvider>
      <ComponentShowcaseInner />
    </ToastProvider>
  );
};
