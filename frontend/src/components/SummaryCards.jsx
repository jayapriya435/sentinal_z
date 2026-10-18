import React from 'react';
import { Network, AlertTriangle, ShieldCheck, HeartPulse } from 'lucide-react';

export default function SummaryCards({ infrastructure, risksData, eventsData }) {
  // 1. Total infrastructure nodes from actual API response
  const totalNodes = infrastructure?.node_count || risksData?.nodes_evaluated || 0;

  // 2. Active anomalies derived from events unresolved anomalies count or direct_risk >= 0.60
  const activeAnomalies = eventsData?.unresolved_anomalies !== undefined
    ? eventsData.unresolved_anomalies
    : (risksData?.risks?.filter(r => r.direct_risk >= 0.60)?.length || 0);

  // 3. High-risk components directly from /api/risks
  const highRiskCount = risksData?.high_risk_node_count !== undefined
    ? risksData.high_risk_node_count
    : (risksData?.risks?.filter(r => r.composite_risk >= 0.50)?.length || 0);

  // 4. Potentially affected critical facilities (hospitals, emergency facilities, traffic control)
  // that have non-nominal status or elevated cascade risk
  const affectedCriticalFacilities = (risksData?.risks || []).filter(r => {
    const isCriticalSector = ['hospital', 'emergency_facility', 'traffic_system'].includes(r.node_type);
    const hasCascadeRisk = (r.cascade_risk || 0) > 0.20 || r.status !== 'nominal';
    return isCriticalSector && hasCascadeRisk;
  }).length;

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-card-info">
          <span className="summary-card-title">Total Infrastructure</span>
          <span className="summary-card-value">{totalNodes}</span>
          <span className="summary-card-subtitle">
            {infrastructure?.edge_count ? `${infrastructure.edge_count} dependency edges` : 'Monitored grid nodes'}
          </span>
        </div>
        <div className="summary-card-icon">
          <Network size={22} />
        </div>
      </div>

      <div className={`summary-card ${activeAnomalies > 0 ? 'anomalies' : ''}`}>
        <div className="summary-card-info">
          <span className="summary-card-title">Active Anomalies</span>
          <span className="summary-card-value">{activeAnomalies}</span>
          <span className="summary-card-subtitle">
            {activeAnomalies > 0 ? 'IsolationForest threshold breach' : 'All sensor telemetry nominal'}
          </span>
        </div>
        <div className="summary-card-icon">
          <AlertTriangle size={22} />
        </div>
      </div>

      <div className={`summary-card ${highRiskCount > 0 ? 'critical' : ''}`}>
        <div className="summary-card-info">
          <span className="summary-card-title">High-Risk Components</span>
          <span className="summary-card-value">{highRiskCount}</span>
          <span className="summary-card-subtitle">
            Composite risk &gt;= 0.50
          </span>
        </div>
        <div className="summary-card-icon">
          <ShieldCheck size={22} />
        </div>
      </div>

      <div className={`summary-card ${affectedCriticalFacilities > 0 ? 'critical' : ''}`}>
        <div className="summary-card-info">
          <span className="summary-card-title">Threatened Critical Facilities</span>
          <span className="summary-card-value">{affectedCriticalFacilities}</span>
          <span className="summary-card-subtitle">
            Hospitals, dispatch &amp; civic grids
          </span>
        </div>
        <div className="summary-card-icon">
          <HeartPulse size={22} />
        </div>
      </div>
    </div>
  );
}
