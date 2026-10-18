import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, Cpu, HeartPulse, Car, Radio, Flame, ShieldAlert, GitCommit } from 'lucide-react';

const SECTOR_ICONS = {
  substation: Zap,
  transformer: Cpu,
  hospital: HeartPulse,
  traffic_system: Car,
  communication_hub: Radio,
  emergency_facility: Flame,
};

function CustomNode({ data, selected }) {
  const { node, risk } = data;
  const status = risk?.status || node?.status || 'nominal';
  const compositeRisk = risk?.composite_risk !== undefined ? risk.composite_risk : 0.0;
  const directRisk = risk?.direct_risk !== undefined ? risk.direct_risk : 0.0;
  const cascadeRisk = risk?.cascade_risk !== undefined ? risk.cascade_risk : 0.0;

  // Determine if this node is suffering from an active cascade propagation
  const isCascadeAffected = Boolean(
    (cascadeRisk > 0.20 || (risk?.impacted_by && risk.impacted_by.length > 0)) &&
    (status !== 'nominal' || cascadeRisk > 0.20)
  );

  const IconComponent = SECTOR_ICONS[node?.type] || ShieldAlert;

  const nodeClasses = [
    'custom-node',
    status,
    isCascadeAffected ? 'cascade-affected' : '',
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={nodeClasses}
      tabIndex={0}
      role="button"
      aria-label={`${node?.name} node, status ${status}`}
      onClick={(e) => {
        if (data?.onSelect) {
          data.onSelect();
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={{ background: '#38bdf8', width: 8, height: 8, border: '2px solid #070a13' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={{ background: '#38bdf8', width: 6, height: 6, opacity: 0 }}
      />

      <div className="node-header">
        <span className="node-sector">
          <IconComponent size={12} />
          {node?.type?.replace('_', ' ')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {isCascadeAffected && (
            <span
              className="node-cascade-pill"
              title={`Cascade propagation from: ${risk?.impacted_by?.join(' → ') || 'upstream nodes'}`}
            >
              <GitCommit size={10} />
              CASCADE
            </span>
          )}
          <span className={`node-risk-pill ${status}`}>
            {status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="node-name" title={node?.name}>
        {node?.name}
      </div>

      <div className="node-footer">
        <span className="mono" style={{ color: '#cbd5e1', fontWeight: 600 }}>
          Risk: {(compositeRisk * 100).toFixed(0)}%
        </span>
        <span className="mono" style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
          D:{(directRisk * 100).toFixed(0)}% | C:{(cascadeRisk * 100).toFixed(0)}%
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={{ background: '#38bdf8', width: 8, height: 8, border: '2px solid #070a13' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={{ background: '#38bdf8', width: 6, height: 6, opacity: 0 }}
      />
    </div>
  );
}

export default memo(CustomNode);
