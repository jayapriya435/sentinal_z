import React from 'react';
import { AlertCircle, ShieldAlert, GitCommit } from 'lucide-react';

export default function RiskPanel({ risksData, selectedNodeId, onSelectNode }) {
  const risksList = risksData?.risks || [];

  if (risksList.length === 0) {
    return (
      <div className="state-container">
        <ShieldAlert size={32} style={{ color: '#64748b' }} />
        <span>No risk evaluations available. Polling backend...</span>
      </div>
    );
  }

  return (
    <div className="risk-list">
      {risksList.map((item, index) => {
        const isSelected = item.node_id === selectedNodeId;
        const status = item.status || 'nominal';

        return (
          <div
            key={item.node_id}
            className={`risk-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectNode(item.node_id)}
          >
            <div className="risk-item-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                    #{index + 1}
                  </span>
                  <span className="risk-item-title">{item.node_name}</span>
                </div>
                <div className="risk-item-sector">
                  {item.node_type?.replace('_', ' ')} • Criticality: {(item.criticality * 100).toFixed(0)}%
                </div>
              </div>

              <span className={`node-risk-pill ${status}`}>
                {(item.composite_risk * 100).toFixed(1)}% {status.toUpperCase()}
              </span>
            </div>

            {/* Direct, Cascade, and Composite Risk Bars */}
            <div className="risk-bars-container">
              <div className="risk-bar-group">
                <div className="risk-bar-label">
                  <span>Direct Risk</span>
                  <span className="mono">{(item.direct_risk * 100).toFixed(0)}%</span>
                </div>
                <div className="risk-bar-track">
                  <div
                    className={`risk-bar-fill ${item.direct_risk >= 0.6 ? 'critical' : item.direct_risk >= 0.3 ? 'warning' : 'nominal'}`}
                    style={{ width: `${Math.min(100, item.direct_risk * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="risk-bar-group">
                <div className="risk-bar-label">
                  <span>Cascade Risk</span>
                  <span className="mono">{(item.cascade_risk * 100).toFixed(0)}%</span>
                </div>
                <div className="risk-bar-track">
                  <div
                    className={`risk-bar-fill ${item.cascade_risk >= 0.6 ? 'critical' : item.cascade_risk >= 0.3 ? 'warning' : 'nominal'}`}
                    style={{ width: `${Math.min(100, item.cascade_risk * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="risk-bar-group">
                <div className="risk-bar-label">
                  <span>Composite</span>
                  <span className="mono">{(item.composite_risk * 100).toFixed(0)}%</span>
                </div>
                <div className="risk-bar-track">
                  <div
                    className={`risk-bar-fill ${item.composite_risk >= 0.65 ? 'critical' : item.composite_risk >= 0.35 ? 'warning' : 'nominal'}`}
                    style={{ width: `${Math.min(100, item.composite_risk * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Upstream Cascade Roots if any */}
            {item.impacted_by && item.impacted_by.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0.3rem 0', fontSize: '0.68rem', color: '#f59e0b' }}>
                <GitCommit size={12} />
                <span>Impacted upstream by: {item.impacted_by.join(', ')}</span>
              </div>
            )}

            {/* Explainable Reasoning */}
            <div className="risk-item-reasoning">
              {item.reasoning}
            </div>
          </div>
        );
      })}
    </div>
  );
}
