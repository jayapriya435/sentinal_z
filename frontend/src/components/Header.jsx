import React from 'react';
import { ShieldAlert, Activity, RefreshCw, Zap, RotateCcw } from 'lucide-react';

export default function Header({
  connectionStatus,
  lastUpdated,
  onRefresh,
  onSimulateFault,
  onResetSimulation,
  isRefreshing
}) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="brand-badge">
          <div className="brand-icon">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div className="brand-title">
              SENTINEL Z
              <span className="brand-tag">CrisisGraph</span>
              <span className="brand-tag" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                IBM Z 2026
              </span>
            </div>
            <div className="brand-subtitle">
              Real-Time AI for Predicting Cascading Infrastructure Failures
            </div>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="simulated-badge" title="Adhering to IBM Z Datathon guidelines: All telemetry and topologies are synthetic simulations.">
          <Activity size={14} />
          SIMULATED DATA ONLY
        </div>
      </div>

      <div className="header-right">
        <div
          className={`status-indicator ${connectionStatus === 'connected' ? '' : 'disconnected'}`}
          title={connectionStatus === 'connected' ? 'FastAPI Backend Online' : 'Connecting to API...'}
        >
          <span className="status-dot"></span>
          <span>{connectionStatus === 'connected' ? 'API ONLINE' : 'DISCONNECTED'}</span>
        </div>

        <button
          className="btn btn-danger"
          onClick={() => onSimulateFault('sub_alpha')}
          title="Simulate thermal runaway on Substation Alpha to trigger cascade prediction"
        >
          <Zap size={14} />
          <span>Stress Substation Alpha</span>
        </button>

        <button
          className="btn"
          onClick={onResetSimulation}
          title="Clear all injected faults and restore nominal baseline"
        >
          <RotateCcw size={14} />
          <span>Reset Grid</span>
        </button>

        <button
          className="btn btn-primary"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Manually poll latest API state"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spinner' : ''} />
          <span>{isRefreshing ? 'Polling...' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
}
