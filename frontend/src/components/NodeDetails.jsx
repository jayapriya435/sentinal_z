import React from 'react';
import {
  X,
  Zap,
  ShieldAlert,
  ArrowRight,
  ArrowDownRight,
  Activity,
  Layers,
  CheckCircle,
} from 'lucide-react';

export default function NodeDetails({
  nodeId,
  infrastructure,
  risksData,
  onClose,
  onInjectFault,
  onResetSimulation,
  onSelectNode,
  onOpenInterventions,
}) {
  const node = infrastructure?.nodes?.find(n => n.id === nodeId);
  const risk = risksData?.risks?.find(r => r.node_id === nodeId);

  if (!node) {
    return (
      <div className="state-container">
        <ShieldAlert size={28} style={{ color: '#64748b' }} />
        <span>Select an infrastructure node on the graph or risk list to inspect.</span>
      </div>
    );
  }

  // Incoming and Outgoing Dependencies
  const incoming = (infrastructure?.edges || []).filter(e => e.target === nodeId);
  const outgoing = (infrastructure?.edges || []).filter(e => e.source === nodeId);

  const status = risk?.status || node.status || 'nominal';

  return (
    <div className="node-details-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
              {node.name}
            </span>
            <span className={`node-risk-pill ${status}`}>
              {status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
            ID: <code className="mono">{node.id}</code> • Type: {node.type?.replace('_', ' ')} • Criticality: {(node.criticality * 100).toFixed(0)}%
          </div>
        </div>

        <button
          className="btn"
          style={{ padding: '4px 6px', background: 'transparent' }}
          onClick={onClose}
          title="Close details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Risk Metrics */}
      <div className="risk-bars-container" style={{ margin: '0.2rem 0' }}>
        <div className="risk-bar-group">
          <div className="risk-bar-label">
            <span>Direct Risk</span>
            <span className="mono">{((risk?.direct_risk || 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="risk-bar-track">
            <div
              className={`risk-bar-fill ${(risk?.direct_risk || 0) >= 0.6 ? 'critical' : (risk?.direct_risk || 0) >= 0.3 ? 'warning' : 'nominal'}`}
              style={{ width: `${Math.min(100, (risk?.direct_risk || 0) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="risk-bar-group">
          <div className="risk-bar-label">
            <span>Cascade Impact</span>
            <span className="mono">{((risk?.cascade_risk || 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="risk-bar-track">
            <div
              className={`risk-bar-fill ${(risk?.cascade_risk || 0) >= 0.6 ? 'critical' : (risk?.cascade_risk || 0) >= 0.3 ? 'warning' : 'nominal'}`}
              style={{ width: `${Math.min(100, (risk?.cascade_risk || 0) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="risk-bar-group">
          <div className="risk-bar-label">
            <span>Composite</span>
            <span className="mono">{((risk?.composite_risk || 0) * 100).toFixed(0)}%</span>
          </div>
          <div className="risk-bar-track">
            <div
              className={`risk-bar-fill ${(risk?.composite_risk || 0) >= 0.65 ? 'critical' : (risk?.composite_risk || 0) >= 0.35 ? 'warning' : 'nominal'}`}
              style={{ width: `${Math.min(100, (risk?.composite_risk || 0) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Explainable Rationale */}
      {risk?.reasoning && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 6,
          padding: '0.6rem 0.8rem',
          fontSize: '0.75rem',
          color: '#cbd5e1',
          lineHeight: 1.45
        }}>
          <strong style={{ color: '#38bdf8' }}>Explainable Diagnostic:</strong> {risk.reasoning}
        </div>
      )}

      {/* Upstream Cascade Path if Supported */}
      {risk?.impacted_by && risk.impacted_by.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 6,
          padding: '0.5rem 0.8rem',
          fontSize: '0.72rem',
          color: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <Layers size={14} />
          <span>Propagated from upstream nodes: <strong>{risk.impacted_by.join(' → ')}</strong></span>
        </div>
      )}

      {/* Sector Operational Metadata */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
          Operational Metadata
        </div>
        <div className="metadata-grid">
          {Object.entries(node.metadata || {}).map(([key, value]) => {
            if (key === 'coordinates') return null;
            return (
              <div key={key} className="metadata-item">
                <div className="metadata-label">{key.replace(/_/g, ' ')}</div>
                <div className="metadata-val">
                  {typeof value === 'boolean'
                    ? (value ? 'YES' : 'NO')
                    : (typeof value === 'object' ? JSON.stringify(value) : String(value))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dependencies: Incoming & Outgoing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.3rem' }}>
            Upstream Suppliers ({incoming.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {incoming.length === 0 ? (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Primary root grid supply</span>
            ) : (
              incoming.map(e => (
                <button
                  key={e.source}
                  className="btn"
                  style={{ fontSize: '0.7rem', padding: '3px 8px', justifyContent: 'flex-start' }}
                  onClick={() => onSelectNode(e.source)}
                >
                  <ArrowDownRight size={12} style={{ color: '#38bdf8' }} />
                  <span>{e.source} ({e.dependency_type})</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.3rem' }}>
            Downstream Dependents ({outgoing.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {outgoing.length === 0 ? (
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Terminal facility / end consumer</span>
            ) : (
              outgoing.map(e => (
                <button
                  key={e.target}
                  className="btn"
                  style={{ fontSize: '0.7rem', padding: '3px 8px', justifyContent: 'flex-start' }}
                  onClick={() => onSelectNode(e.target)}
                >
                  <ArrowRight size={12} style={{ color: '#f59e0b' }} />
                  <span>{e.target} ({e.dependency_type})</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Targeted Stress Injection Actions */}
      {/* Action Buttons */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {onOpenInterventions && (
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => onOpenInterventions(node.id)}
          >
            <span>Simulate Interventions for {node.name}</span>
          </button>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={() => onInjectFault(node.id)}
          >
            <Zap size={14} />
            <span>Stress This Node</span>
          </button>

          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={onResetSimulation}
          >
            <CheckCircle size={14} />
            <span>Clear Stress</span>
          </button>
        </div>
      </div>
    </div>
  );
}
