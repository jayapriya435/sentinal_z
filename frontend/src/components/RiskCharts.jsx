import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Info, BarChart2 } from 'lucide-react';

const STATUS_COLORS = {
  nominal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export default function RiskCharts({ risksData, infrastructure }) {
  const risks = risksData?.risks || [];

  // 1. Sector Average Risk Breakdown (Aggregated from real API data)
  const sectorData = useMemo(() => {
    if (!risks.length) return [];

    const sectorGroups = {};
    risks.forEach((r) => {
      const sector = r.node_type || 'unknown';
      if (!sectorGroups[sector]) {
        sectorGroups[sector] = { count: 0, directSum: 0, cascadeSum: 0, compositeSum: 0 };
      }
      sectorGroups[sector].count += 1;
      sectorGroups[sector].directSum += r.direct_risk || 0;
      sectorGroups[sector].cascadeSum += r.cascade_risk || 0;
      sectorGroups[sector].compositeSum += r.composite_risk || 0;
    });

    return Object.entries(sectorGroups).map(([sector, stats]) => ({
      sector: sector.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      avgDirect: Number(((stats.directSum / stats.count) * 100).toFixed(1)),
      avgCascade: Number(((stats.cascadeSum / stats.count) * 100).toFixed(1)),
      avgComposite: Number(((stats.compositeSum / stats.count) * 100).toFixed(1)),
    }));
  }, [risks]);

  // 2. Risk Status Distribution (Nominal vs Warning vs Critical counts)
  const distributionData = useMemo(() => {
    let nominal = 0;
    let warning = 0;
    let critical = 0;

    risks.forEach((r) => {
      if (r.status === 'critical') critical += 1;
      else if (r.status === 'warning') warning += 1;
      else nominal += 1;
    });

    return [
      { name: 'Nominal', value: nominal, color: STATUS_COLORS.nominal },
      { name: 'Warning', value: warning, color: STATUS_COLORS.warning },
      { name: 'Critical', value: critical, color: STATUS_COLORS.critical },
    ].filter(d => d.value > 0);
  }, [risks]);

  // 3. Top 6 Highest Stressed Nodes
  const topStressedNodes = useMemo(() => {
    return [...risks]
      .sort((a, b) => b.composite_risk - a.composite_risk)
      .slice(0, 6)
      .map(n => ({
        name: n.node_name.length > 18 ? n.node_name.slice(0, 16) + '..' : n.node_name,
        directRisk: Number((n.direct_risk * 100).toFixed(1)),
        cascadeRisk: Number((n.cascade_risk * 100).toFixed(1)),
        compositeRisk: Number((n.composite_risk * 100).toFixed(1)),
      }));
  }, [risks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Missing Historical Time-Series Explanation Callout */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        fontSize: '0.75rem',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem'
      }}>
        <Info size={16} style={{ color: '#38bdf8', flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: '#f8fafc' }}>Real-Time Snapshot Analytics:</strong> Visualizing active
          topological risk percolation across all 16 infrastructure nodes.
          <em> (Note: Continuous historical time-series telemetry logging is not retained by the current in-memory backend state; live cross-sectional telemetry snapshots are plotted.)</em>
        </div>
      </div>

      {/* Chart 1: Sector Risk Breakdown */}
      <div style={{ background: '#131c31', padding: '1rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <BarChart2 size={16} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
            Average Risk by Infrastructure Sector (%)
          </span>
        </div>
        <div style={{ height: 220, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sectorData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
              <XAxis dataKey="sector" stroke="#64748b" fontSize={10} angle={-15} textAnchor="end" />
              <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0d1322', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Bar dataKey="avgDirect" name="Direct Anomaly Risk" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgCascade" name="Cascade Propagated Risk" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid of Chart 2 & Chart 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem' }}>
        {/* Top 6 Stressed Nodes */}
        <div style={{ background: '#131c31', padding: '1rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.6rem' }}>
            Top Stressed Facilities (Risk %)
          </div>
          <div style={{ height: 180, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topStressedNodes} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={80} />
                <Tooltip
                  contentStyle={{ background: '#0d1322', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 11 }}
                />
                <Bar dataKey="compositeRisk" name="Composite Risk" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie */}
        <div style={{ background: '#131c31', padding: '1rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem', alignSelf: 'flex-start' }}>
            Grid Health Distribution
          </div>
          <div style={{ height: 160, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={58}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0d1322', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.68rem', color: '#94a3b8' }}>
            {distributionData.map(d => (
              <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }}></span>
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
