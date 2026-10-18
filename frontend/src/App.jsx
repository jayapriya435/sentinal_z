import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import InfrastructureGraph from './components/InfrastructureGraph';
import RiskPanel from './components/RiskPanel';
import RiskCharts from './components/RiskCharts';
import EventFeed from './components/EventFeed';
import NodeDetails from './components/NodeDetails';
import InterventionPanel from './components/InterventionPanel';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import api from './services/api';
import { ShieldAlert, BarChart3, Bell, Eye, GitCompare } from 'lucide-react';

export default function App() {
  const [infrastructure, setInfrastructure] = useState(null);
  const [risksData, setRisksData] = useState(null);
  const [eventsData, setEventsData] = useState(null);
  const [health, setHealth] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeTab, setActiveTab] = useState('risks'); // 'risks' | 'charts' | 'events' | 'details'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);

  const pollTimerRef = useRef(null);

  // Full Initial Fetch
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [infraRes, risksRes, eventsRes, healthRes] = await Promise.all([
        api.getInfrastructure(),
        api.getRisks(),
        api.getEvents(50),
        api.getHealth(),
      ]);

      setInfrastructure(infraRes);
      setRisksData(risksRes);
      setEventsData(eventsRes);
      setHealth(healthRes);
      setConnectionStatus('connected');
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError(err.message || 'Unable to connect to SENTINEL Z backend');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, []);

  // Periodic Polling for Telemetry & Risk Updates
  const pollUpdates = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [risksRes, eventsRes, healthRes] = await Promise.all([
        api.getRisks(),
        api.getEvents(50),
        api.getHealth(),
      ]);

      setRisksData(risksRes);
      setEventsData(eventsRes);
      setHealth(healthRes);
      setConnectionStatus('connected');
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Polling error:', err);
      setConnectionStatus('disconnected');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Setup mount & polling interval
  useEffect(() => {
    loadInitialData();

    // Auto-poll every 4 seconds
    pollTimerRef.current = setInterval(() => {
      pollUpdates();
    }, 4000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [loadInitialData, pollUpdates]);

  // Handle Node Selection
  const handleSelectNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      setActiveTab('details');
    }
  }, []);

  // Handle Fault Simulation
  const handleSimulateFault = useCallback(async (nodeId = 'sub_alpha') => {
    try {
      setIsRefreshing(true);
      await api.injectFault(nodeId, 'thermal_runaway', 0.95, 60);
      setSelectedNodeId(nodeId);
      setActiveTab('risks');
      // Immediate poll
      await pollUpdates();
    } catch (err) {
      alert(`Simulation injection failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [pollUpdates]);

  // Handle Simulation Reset
  const handleResetSimulation = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await api.resetSimulation();
      await pollUpdates();
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [pollUpdates]);

  if (loading) {
    return (
      <div className="app-container">
        <LoadingState />
      </div>
    );
  }

  if (error && !infrastructure) {
    return (
      <div className="app-container">
        <ErrorState error={error} onRetry={loadInitialData} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. Header */}
      <Header
        connectionStatus={connectionStatus}
        lastUpdated={lastUpdated}
        onRefresh={pollUpdates}
        onSimulateFault={handleSimulateFault}
        onResetSimulation={handleResetSimulation}
        isRefreshing={isRefreshing}
      />

      <main className="dashboard-main">
        {/* 2. Real-Time Summary Cards */}
        <SummaryCards
          infrastructure={infrastructure}
          risksData={risksData}
          eventsData={eventsData}
        />

        {/* 3. Main Command Grid: Graph Canvas on Left, Operations Panels on Right */}
        <div className="workspace-grid">
          {/* Left Canvas: React Flow Infrastructure Graph */}
          <InfrastructureGraph
            infrastructure={infrastructure}
            risksData={risksData}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            loading={loading}
            error={error}
            onRetry={loadInitialData}
          />

          {/* Right Workspace: Tabbed Analytics & Diagnostics */}
          <div className="panel" style={{ height: '100%', minHeight: 620 }}>
            <div className="panel-header">
              <div className="panel-title-group">
                <span className="panel-title">Operational Diagnostics</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Auto-syncing (4s)
              </span>
            </div>

            <div className="panel-body">
              {/* Tab Selector Controls */}
              <div className="tab-controls">
                <button
                  className={`tab-btn ${activeTab === 'risks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('risks')}
                >
                  <ShieldAlert size={14} />
                  <span>Risks ({risksData?.risks?.length || 0})</span>
                </button>

                <button
                  className={`tab-btn ${activeTab === 'interventions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('interventions')}
                >
                  <GitCompare size={14} />
                  <span>Interventions</span>
                </button>

                <button
                  className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('charts')}
                >
                  <BarChart3 size={14} />
                  <span>Analytics</span>
                </button>

                <button
                  className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                >
                  <Bell size={14} />
                  <span>Events ({eventsData?.events?.length || 0})</span>
                </button>

                <button
                  className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => setActiveTab('details')}
                >
                  <Eye size={14} />
                  <span>Inspect</span>
                </button>
              </div>

              {/* Tab Content Display */}
              {activeTab === 'risks' && (
                <RiskPanel
                  risksData={risksData}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                />
              )}

              {activeTab === 'interventions' && (
                <InterventionPanel
                  infrastructure={infrastructure}
                  initialFailedNodeId={selectedNodeId}
                  onSelectNode={handleSelectNode}
                />
              )}

              {activeTab === 'charts' && (
                <RiskCharts
                  risksData={risksData}
                  infrastructure={infrastructure}
                />
              )}

              {activeTab === 'events' && (
                <EventFeed
                  eventsData={eventsData}
                  onSelectNode={handleSelectNode}
                />
              )}

              {activeTab === 'details' && (
                <NodeDetails
                  nodeId={selectedNodeId}
                  infrastructure={infrastructure}
                  risksData={risksData}
                  onClose={() => {
                    setSelectedNodeId(null);
                    setActiveTab('risks');
                  }}
                  onInjectFault={handleSimulateFault}
                  onResetSimulation={handleResetSimulation}
                  onSelectNode={handleSelectNode}
                  onOpenInterventions={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    setActiveTab('interventions');
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="dashboard-footer">
        <div className="footer-disclaimer">
          <span className="footer-badge">IBM Z DATATHON 2026</span>
          <span>
            Demonstrative research prototype. All infrastructure nodes, sensor telemetry, and risk calculations are synthetic simulations generated for AI validation and must not be presented as real-world failure probabilities.
          </span>
        </div>
      </footer>
    </div>
  );
}
