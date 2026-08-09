import React from 'react';
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  AreaChart as ReAreaChart,
  Area,
  BarChart as ReBarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../lib/utils';

interface CommonChartProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  height?: number;
  className?: string;
}

// Brand palette colors for charts
const CHART_COLORS = {
  primary: '#1A5C2E',
  secondary: '#0F6E56',
  amber: '#E67E22',
  danger: '#C0392B',
  blue: '#185FA5',
  slate: '#64748B',
  pieColors: ['#1A5C2E', '#0F6E56', '#E67E22', '#185FA5', '#C0392B', '#94A3B8'],
};

/* ==========================================
 * 1. LineChartWrapper
 * ========================================== */
export interface LineChartProps extends CommonChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  lines: Array<{ key: string; name?: string; color?: string }>;
}

export const LineChartWrapper: React.FC<LineChartProps> = ({
  data,
  xKey,
  lines,
  isLoading = false,
  isEmpty = false,
  height = 260,
  className,
}) => {
  if (isLoading) return <Skeleton className={cn('w-full rounded-xl', className)} style={{ height }} />;
  if (isEmpty || !data || data.length === 0) {
    return (
      <div className={cn('w-full flex items-center justify-center bg-surface-container-low rounded-xl', className)} style={{ height }}>
        <EmptyState title="No Chart Data" description="There is no trend telemetry available for this period." icon="show_chart" />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#888888" />
          <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111111',
              borderColor: '#333333',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          {lines.map((l, i) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name || l.key}
              stroke={l.color || CHART_COLORS.pieColors[i % CHART_COLORS.pieColors.length]}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              isAnimationActive
            />
          ))}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ==========================================
 * 2. AreaChartWrapper
 * ========================================== */
export interface AreaChartProps extends CommonChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  areas: Array<{ key: string; name?: string; color?: string }>;
}

export const AreaChartWrapper: React.FC<AreaChartProps> = ({
  data,
  xKey,
  areas,
  isLoading = false,
  isEmpty = false,
  height = 260,
  className,
}) => {
  if (isLoading) return <Skeleton className={cn('w-full rounded-xl', className)} style={{ height }} />;
  if (isEmpty || !data || data.length === 0) {
    return (
      <div className={cn('w-full flex items-center justify-center bg-surface-container-low rounded-xl', className)} style={{ height }}>
        <EmptyState title="No Area Data" description="No area trends recorded." icon="analytics" />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {areas.map((a, i) => {
              const color = a.color || CHART_COLORS.pieColors[i % CHART_COLORS.pieColors.length];
              return (
                <linearGradient key={a.key} id={`grad-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#888888" />
          <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111111',
              borderColor: '#333333',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          {areas.map((a, i) => {
            const color = a.color || CHART_COLORS.pieColors[i % CHART_COLORS.pieColors.length];
            return (
              <Area
                key={a.key}
                type="monotone"
                dataKey={a.key}
                name={a.name || a.key}
                stroke={color}
                fillOpacity={1}
                fill={`url(#grad-${a.key})`}
                strokeWidth={2}
                isAnimationActive
              />
            );
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ==========================================
 * 3. BarChartWrapper
 * ========================================== */
export interface BarChartProps extends CommonChartProps {
  data: Array<Record<string, any>>;
  xKey: string;
  bars: Array<{ key: string; name?: string; color?: string }>;
}

export const BarChartWrapper: React.FC<BarChartProps> = ({
  data,
  xKey,
  bars,
  isLoading = false,
  isEmpty = false,
  height = 260,
  className,
}) => {
  if (isLoading) return <Skeleton className={cn('w-full rounded-xl', className)} style={{ height }} />;
  if (isEmpty || !data || data.length === 0) {
    return (
      <div className={cn('w-full flex items-center justify-center bg-surface-container-low rounded-xl', className)} style={{ height }}>
        <EmptyState title="No Bar Data" description="No distribution available." icon="bar_chart" />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#888888" />
          <YAxis tick={{ fontSize: 11 }} stroke="#888888" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111111',
              borderColor: '#333333',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          {bars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.name || b.key}
              fill={b.color || CHART_COLORS.pieColors[i % CHART_COLORS.pieColors.length]}
              radius={[6, 6, 0, 0]}
              isAnimationActive
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ==========================================
 * 4. DonutChartWrapper / PieChartWrapper
 * ========================================== */
export interface DonutChartProps extends CommonChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
}

export const DonutChartWrapper: React.FC<DonutChartProps> = ({
  data,
  isLoading = false,
  isEmpty = false,
  height = 260,
  className,
}) => {
  if (isLoading) return <Skeleton className={cn('w-full rounded-xl', className)} style={{ height }} />;
  if (isEmpty || !data || data.length === 0) {
    return (
      <div className={cn('w-full flex items-center justify-center bg-surface-container-low rounded-xl', className)} style={{ height }}>
        <EmptyState title="No Breakdown Data" description="No breakdown proportions logged." icon="pie_chart" />
      </div>
    );
  }

  return (
    <div className={cn('w-full flex items-center justify-center', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={4}
            dataKey="value"
            isAnimationActive
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || CHART_COLORS.pieColors[index % CHART_COLORS.pieColors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#111111',
              borderColor: '#333333',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PieChartWrapper = DonutChartWrapper;
