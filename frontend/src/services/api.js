/**
 * Centralized API service for SENTINEL Z backend.
 * Reads base URL from Vite environment variable with localhost:8000 fallback.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson.detail) {
            errorDetail = typeof errorJson.detail === 'string'
              ? errorJson.detail
              : JSON.stringify(errorJson.detail);
          }
        } catch (_) {
          // Ignore json parse error on non-json body
        }
        throw new Error(errorDetail);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout connecting to ${url}`);
      }
      throw err;
    }
  }

  /**
   * Health probe
   * @returns {Promise<{ status: string, app: string, version: string, active_nodes: number, active_edges: number, linuxone_ready: boolean }>}
   */
  async getHealth() {
    return this._request('/api/health');
  }

  /**
   * Infrastructure topology graph
   * @returns {Promise<{ node_count: number, edge_count: number, nodes: Array, edges: Array, node_types: Object }>}
   */
  async getInfrastructure() {
    return this._request('/api/infrastructure');
  }

  /**
   * Risk evaluation snapshot
   * @returns {Promise<{ evaluated_at: string, overall_system_risk: number, high_risk_node_count: number, nodes_evaluated: number, risks: Array }>}
   */
  async getRisks() {
    return this._request('/api/risks');
  }

  /**
   * Recent event logs & cascade warnings
   * @param {number} limit 
   * @returns {Promise<{ total_events: number, unresolved_anomalies: number, events: Array }>}
   */
  async getEvents(limit = 50) {
    return this._request(`/api/events?limit=${limit}`);
  }

  /**
   * Decision support recommendations
   * @returns {Promise<{ timestamp: string, total_recommendations: number, recommendations: Array }>}
   */
  async getRecommendations() {
    return this._request('/api/recommendations');
  }

  /**
   * Inject fault / stress scenario on target node
   * @param {string} nodeId 
   * @param {string} scenario 
   * @param {number} intensity 
   * @param {number} durationSeconds 
   */
  async injectFault(nodeId, scenario = 'thermal_runaway', intensity = 0.9, durationSeconds = 60) {
    return this._request('/api/telemetry/inject', {
      method: 'POST',
      body: JSON.stringify({
        node_id: nodeId,
        scenario,
        intensity,
        duration_seconds: durationSeconds,
      }),
    });
  }

  /**
   * Reset simulation and clear all active faults
   */
  async resetSimulation() {
    return this._request('/api/telemetry/reset', {
      method: 'POST',
    });
  }

  /**
   * Run counterfactual scenario comparison (Baseline vs Mitigation)
   * @param {{ failed_node_id: string, failure_severity?: number, intervention_type: string, target_node_id?: string, parameters?: Object }} payload
   * @returns {Promise<Object>}
   */
  async compareInterventions(payload) {
    return this._request('/api/simulate/interventions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiService(BASE_URL);
export default api;

