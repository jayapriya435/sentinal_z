import React, { useState } from 'react';
import {
  GitCompare,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Layers,
  ArrowRight,
  TrendingDown,
  Info,
  Server
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';

const INTERVENTION_OPTIONS = [
  {
    value: 'no_intervention',
    label: '1. No Intervention (Baseline Cascade)',
    desc: 'Simulates natural unmitigated failure propagation across primary and secondary dependency links.'
  },
  {
    value: 'load_rerouting',
    label: '2. Load Rerouting (Alternative Feeder)',
    desc: 'Transfers transmission strain away from the compromised link along verified secondary grid ties.'
  },
  {
    value: 'component_isolation',
    label: '3. Component Isolation (Controlled Islanding)',
    desc: 'Trips circuit breakers to physically isolate the component, halting systemic surge but cutting power to dependent nodes.'
  },
  {
    value: 'redundant_failover',
    label: '4. Redundant Failover (Emergency Backup)',
    desc: 'Switches the target facility to dedicated on-site emergency generator or verified secondary backup circuit.'
  }
];

export default function InterventionPanel({
  infrastructure,
  initialFailedNodeId,
  onSelectNode
}) {
  const nodes = infrastructure?.nodes || [];

  const [failedNodeId, setFailedNodeId] = useState(initialFailedNodeId || (nodes[0]?.id || 'sub_alpha'));
  const [targetNodeId, setTargetNodeId] = useState('');
  const [interventionType, setInterventionType] = useState('load_rerouting');
  const [severity, setSeverity] = useState(0.90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);

  const handleRunSimulation = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        failed_node_id: failedNodeId,
        failure_severity: parseFloat(severity),
        intervention_type: interventionType,
        target_node_id: targetNodeId ? targetNodeId : undefined,
      };

      const result = await api.compareInterventions(payload);
      setComparisonResult(result);
    } catch (err) {
      setError(err.message || 'Counterfactual simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setComparisonResult(null);
    setError(null);
  };

  // Prepare top components for Recharts side-by-side visualization
  const chartData = (comparisonResult?.component_comparisons || [])
    .filter(c => c.baseline_composite_risk > 0.10 || c.intervention_composite_risk > 0.10)
    .slice(0, 7)
    .map(c => ({
      name: c.node_name.length > 16 ? c.node_name.slice(0, 14) + '..' : c.node_name,
      baseline: Number((c.baseline_composite_risk * 100).toFixed(1)),
      intervention: Number((c.intervention_composite_risk * 100).toFixed(1)),
      delta: Number((c.risk_delta * 100).toFixed(1)),
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Parameter Selection Card */}
      <div style={{
        background: '#131c31',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '1.2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <GitCompare size={18} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
            Counterfactual Scenario Setup
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 'auto' }}>
            Evaluated on independent CrisisGraph clones
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Failed Component */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Root Failing Component
            </label>
            <select
              value={failedNodeId}
              onChange={(e) => setFailedNodeId(e.target.value)}
              style={{
                width: '100%',
                background: '#0d1322',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.8rem',
                fontFamily: 'inherit'
              }}
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.type})
                </option>
              ))}
            </select>
          </div>

          {/* Intervention Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Mitigation Intervention
            </label>
            <select
              value={interventionType}
              onChange={(e) => setInterventionType(e.target.value)}
              style={{
                width: '100%',
                background: '#0d1322',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.8rem',
                fontFamily: 'inherit'
              }}
            >
              {INTERVENTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Component (Optional) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
              Specific Action Target (Optional)
            </label>
            <select
              value={targetNodeId}
              onChange={(e) => setTargetNodeId(e.target.value)}
              style={{
                width: '100%',
                background: '#0d1322',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.8rem',
                fontFamily: 'inherit'
              }}
            >
              <option value="">Default (Apply to failing root node)</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.type})
                </option>
              ))}
            </select>
          </div>

          {/* Failure Severity Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Anomaly Severity
              </label>
              <span className="mono" style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                {(severity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={severity}
              onChange={(e) => setSeverity(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.2rem', justifyContent: 'flex-end' }}>
          {comparisonResult && (
            <button className="btn" onClick={handleReset}>
              <RotateCcw size={14} />
              <span>Reset Scenario</span>
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={handleRunSimulation}
            disabled={loading}
            style={{ padding: '8px 18px' }}
          >
            <Play size={14} className={loading ? 'spinner' : ''} />
            <span>{loading ? 'Evaluating Graph Clones...' : 'Run Scenario Comparison'}</span>
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: '0.8rem',
            padding: '0.6rem 0.8rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            color: '#fca5a5',
            fontSize: '0.75rem'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Results View */}
      {comparisonResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Feasibility & Scenario Headline */}
          <div style={{
            background: comparisonResult.is_feasible
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${comparisonResult.is_feasible ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.35)'}`,
            borderRadius: 10,
            padding: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.8rem'
          }}>
            {comparisonResult.is_feasible ? (
              <CheckCircle2 size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
            ) : (
              <XCircle size={22} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            )}

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  {comparisonResult.scenario_name}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: comparisonResult.is_feasible ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: comparisonResult.is_feasible ? '#10b981' : '#ef4444',
                  textTransform: 'uppercase'
                }}>
                  {comparisonResult.is_feasible ? 'FEASIBLE STRATEGY' : 'INFEASIBLE STRATEGY'}
                </span>
              </div>

              {!comparisonResult.is_feasible && (
                <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '0.4rem' }}>
                  <strong>Operational Barrier:</strong> {comparisonResult.feasibility_reason}
                </div>
              )}

              {/* Modeling Assumptions */}
              <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                <span style={{ fontWeight: 700, color: '#cbd5e1' }}>Simulated Assumptions:</span>
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.2rem' }}>
                  {comparisonResult.assumptions.map((asm, idx) => (
                    <li key={idx}>{asm}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Aggregate KPI Delta Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* System Risk Delta */}
            <div className="summary-card">
              <div className="summary-card-info">
                <span className="summary-card-title">Overall Risk Delta</span>
                <span className="summary-card-value" style={{
                  color: comparisonResult.overall_risk_delta > 0
                    ? '#10b981'
                    : (comparisonResult.overall_risk_delta < 0 ? '#ef4444' : '#94a3b8')
                }}>
                  {comparisonResult.overall_risk_delta > 0 ? '-' : ''}
                  {Math.abs(comparisonResult.overall_risk_delta * 100).toFixed(1)}%
                </span>
                <span className="summary-card-subtitle">
                  Baseline: {(comparisonResult.baseline_overall_risk * 100).toFixed(1)}% → Action: {(comparisonResult.intervention_overall_risk * 100).toFixed(1)}%
                </span>
              </div>
              <div className="summary-card-icon">
                <TrendingDown size={20} />
              </div>
            </div>

            {/* Critical Facilities Threatened */}
            <div className="summary-card">
              <div className="summary-card-info">
                <span className="summary-card-title">Critical Facilities</span>
                <span className="summary-card-value">
                  {comparisonResult.intervention_critical_facilities_affected}
                  <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                    {' '}/ {comparisonResult.baseline_critical_facilities_affected}
                  </span>
                </span>
                <span className="summary-card-subtitle">
                  Hospitals &amp; Emergency Hubs at risk
                </span>
              </div>
              <div className="summary-card-icon">
                <Shield size={20} />
              </div>
            </div>

            {/* Improved Components */}
            <div className="summary-card">
              <div className="summary-card-info">
                <span className="summary-card-title">Improved Facilities</span>
                <span className="summary-card-value" style={{ color: '#10b981' }}>
                  {comparisonResult.improved_components.length}
                </span>
                <span className="summary-card-subtitle">
                  Cascade risk reduced
                </span>
              </div>
              <div className="summary-card-icon">
                <CheckCircle2 size={20} style={{ color: '#10b981' }} />
              </div>
            </div>

            {/* Collateral Disruption / Newly Affected */}
            <div className={`summary-card ${comparisonResult.newly_affected_components.length > 0 ? 'critical' : ''}`}>
              <div className="summary-card-info">
                <span className="summary-card-title">Collateral Disruptions</span>
                <span className="summary-card-value" style={{
                  color: comparisonResult.newly_affected_components.length > 0 ? '#ef4444' : '#94a3b8'
                }}>
                  {comparisonResult.newly_affected_components.length}
                </span>
                <span className="summary-card-subtitle">
                  Lost feed due to isolation
                </span>
              </div>
              <div className="summary-card-icon">
                <AlertTriangle size={20} style={{ color: comparisonResult.newly_affected_components.length > 0 ? '#ef4444' : '#64748b' }} />
              </div>
            </div>
          </div>

          {/* Collateral Outage Warning Banner if any */}
          {comparisonResult.newly_affected_components.length > 0 && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              fontSize: '0.78rem',
              color: '#fca5a5'
            }}>
              <strong>Operational Warning:</strong> Isolating this component terminates primary service to:
              {' '}<strong style={{ color: '#fff' }}>{comparisonResult.newly_affected_components.join(', ')}</strong>.
              Verify emergency localized battery/diesel runtimes before committing.
            </div>
          )}

          {/* Visual Side-by-Side Chart */}
          {chartData.length > 0 && (
            <div style={{
              background: '#131c31',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '0.8rem' }}>
                Top Stressed Facilities: Baseline vs. Mitigated Composite Risk (%)
              </div>
              <div style={{ height: 230, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-15} textAnchor="end" />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: '#0d1322', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 11 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Bar dataKey="baseline" name="Baseline (Unmitigated)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="intervention" name="Counterfactual Action" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Side-by-Side Component Breakdown Table */}
          <div style={{
            background: '#131c31',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            overflow: 'hidden'
          }}>
            <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
              Per-Component Comparative Risk Matrix
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Component</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Sector</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Baseline Risk</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Action Risk</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Delta (ΔRisk)</th>
                    <th style={{ padding: '0.6rem 0.8rem' }}>Diagnosis</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonResult.component_comparisons.map((c) => {
                    const isImproved = c.risk_improved;
                    const isNew = c.is_newly_affected;

                    return (
                      <tr
                        key={c.node_id}
                        onClick={() => onSelectNode && onSelectNode(c.node_id)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          cursor: 'pointer',
                          background: isNew ? 'rgba(239, 68, 68, 0.08)' : (isImproved ? 'rgba(16, 185, 129, 0.05)' : 'transparent')
                        }}
                      >
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: '#fff' }}>
                          {c.node_name}
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                          {c.node_type.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem' }} className="mono">
                          <span className={`node-risk-pill ${c.baseline_status}`}>
                            {(c.baseline_composite_risk * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem' }} className="mono">
                          <span className={`node-risk-pill ${c.intervention_status}`}>
                            {(c.intervention_composite_risk * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700 }} className="mono">
                          <span style={{ color: isImproved ? '#10b981' : (c.risk_delta < 0 ? '#ef4444' : '#64748b') }}>
                            {c.risk_delta > 0 ? '-' : (c.risk_delta < 0 ? '+' : '')}
                            {Math.abs(c.risk_delta * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.8rem', color: '#cbd5e1', fontSize: '0.72rem' }}>
                          {c.reasoning}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Explainable Synthesis Callout */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 10,
            padding: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.8rem'
          }}>
            <Info size={20} style={{ color: '#38bdf8', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                Recommendation: {comparisonResult.recommendation}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {comparisonResult.explanation}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
