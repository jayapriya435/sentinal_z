"""Counterfactual Intervention Simulation Engine for SENTINEL Z CrisisGraph."""
from typing import Dict, List, Any, Optional, Tuple, Set
import copy

from app.crisis_graph import CrisisGraph
from app.models import (
    ScenarioComparisonRequest,
    ScenarioComparisonResponse,
    ComponentRiskComparison,
    CascadePathDetail,
    NodeModel
)


class InterventionEngine:
    """Evaluates counterfactual mitigation interventions on isolated graph clones."""

    CRITICAL_SECTOR_TYPES: Set[str] = {
        "hospital",
        "emergency_facility",
        "traffic_system"
    }

    def __init__(self, crisis_graph: CrisisGraph):
        self.live_graph = crisis_graph

    def simulate_scenario(self, request: ScenarioComparisonRequest) -> ScenarioComparisonResponse:
        """
        Executes a deterministic side-by-side comparison between baseline failure
        and a counterfactual mitigation intervention on independent graph copies.
        """
        # Validate failed node exists
        failed_node = self.live_graph.get_node(request.failed_node_id)
        if not failed_node:
            raise ValueError(f"Failed component ID '{request.failed_node_id}' does not exist in the infrastructure topology.")

        target_id = request.target_node_id or request.failed_node_id
        target_node = self.live_graph.get_node(target_id)
        if not target_node:
            raise ValueError(f"Target component ID '{target_id}' does not exist in the infrastructure topology.")

        severity = request.failure_severity

        # -------------------------------------------------------------
        # 1. BASELINE SCENARIO (Independent evaluation copy)
        # -------------------------------------------------------------
        baseline_graph = self._clone_graph(self.live_graph)
        baseline_cascade = baseline_graph.simulate_cascade({failed_node.id: severity})
        baseline_node_risks, baseline_affected_paths = self._evaluate_risks_and_paths(
            graph=baseline_graph,
            failed_node_id=failed_node.id,
            failure_severity=severity,
            cascade_results=baseline_cascade
        )

        # -------------------------------------------------------------
        # 2. INTERVENTION SCENARIO (Separate isolated evaluation copy)
        # -------------------------------------------------------------
        intervention_graph = self._clone_graph(self.live_graph)
        
        is_feasible, feasibility_reason, assumptions, mod_cascade = self._apply_intervention(
            graph=intervention_graph,
            request=request,
            failed_node=failed_node,
            target_node=target_node,
            severity=severity
        )

        # If feasible, evaluate risks on the mutated intervention graph
        if is_feasible:
            # Re-run cascade on intervention graph with any active disconnected states
            intervention_node_risks, intervention_affected_paths = self._evaluate_risks_and_paths(
                graph=intervention_graph,
                failed_node_id=failed_node.id,
                failure_severity=severity,
                cascade_results=mod_cascade
            )
        else:
            # If infeasible, intervention outcome is identical to baseline (action could not be executed)
            intervention_node_risks = copy.deepcopy(baseline_node_risks)
            intervention_affected_paths = copy.deepcopy(baseline_affected_paths)

        # -------------------------------------------------------------
        # 3. SIDE-BY-SIDE METRICS & DELTA COMPARISONS
        # -------------------------------------------------------------
        comparisons: List[ComponentRiskComparison] = []
        newly_affected: List[str] = []
        improved: List[str] = []

        baseline_overall = sum(r["composite_risk"] for r in baseline_node_risks.values()) / len(baseline_node_risks)
        intervention_overall = sum(r["composite_risk"] for r in intervention_node_risks.values()) / len(intervention_node_risks)

        baseline_critical_affected = 0
        intervention_critical_affected = 0

        for node_id, b_risk in baseline_node_risks.items():
            i_risk = intervention_node_risks[node_id]
            node_obj = self.live_graph.get_node(node_id)
            node_type = node_obj.type if node_obj else "unknown"
            node_name = node_obj.name if node_obj else node_id
            criticality = node_obj.criticality if node_obj else 0.5

            if node_type in self.CRITICAL_SECTOR_TYPES:
                if b_risk["composite_risk"] >= 0.35:
                    baseline_critical_affected += 1
                if i_risk["composite_risk"] >= 0.35:
                    intervention_critical_affected += 1

            risk_delta = round(b_risk["composite_risk"] - i_risk["composite_risk"], 4)
            is_improved = risk_delta > 0.01
            is_new = (b_risk["composite_risk"] < 0.35) and (i_risk["composite_risk"] >= 0.35)

            if is_improved:
                improved.append(node_name)
            if is_new:
                newly_affected.append(node_name)

            # Rationale explanation for comparison
            if not is_feasible:
                reason = f"Intervention infeasible: {feasibility_reason}"
            elif is_new:
                reason = f"Collateral impact: Component lost upstream feed due to isolation of {target_node.name}."
            elif is_improved:
                reason = f"Mitigated: Risk reduced by {abs(risk_delta * 100):.1f}% via {request.intervention_type.replace('_', ' ')}."
            elif b_risk["composite_risk"] >= 0.35:
                reason = "Unmitigated: Component remains exposed to direct or alternate cascade paths."
            else:
                reason = "Nominal: Operating parameters unaffected by scenario."

            comparisons.append(ComponentRiskComparison(
                node_id=node_id,
                node_name=node_name,
                node_type=node_type,
                criticality=criticality,
                baseline_direct_risk=b_risk["direct_risk"],
                baseline_cascade_risk=b_risk["cascade_risk"],
                baseline_composite_risk=b_risk["composite_risk"],
                baseline_status=b_risk["status"],
                intervention_direct_risk=i_risk["direct_risk"],
                intervention_cascade_risk=i_risk["cascade_risk"],
                intervention_composite_risk=i_risk["composite_risk"],
                intervention_status=i_risk["status"],
                risk_delta=risk_delta,
                risk_improved=is_improved,
                is_newly_affected=is_new,
                reasoning=reason
            ))

        # Sort comparisons by baseline_composite_risk descending
        comparisons.sort(key=lambda c: c.baseline_composite_risk, reverse=True)

        overall_delta = round(baseline_overall - intervention_overall, 4)

        # -------------------------------------------------------------
        # 4. RECOMMENDATION SYNTHESIS
        # -------------------------------------------------------------
        recommendation, explanation = self._synthesize_recommendation(
            intervention_type=request.intervention_type,
            is_feasible=is_feasible,
            feasibility_reason=feasibility_reason,
            overall_delta=overall_delta,
            improved=improved,
            newly_affected=newly_affected,
            target_node_name=target_node.name
        )

        scenario_name_map = {
            "no_intervention": "Baseline (Unmitigated Failure Cascade)",
            "load_rerouting": f"Load Rerouting via Alternate Path ({target_node.name})",
            "component_isolation": f"Controlled Islanding & Isolation ({target_node.name})",
            "redundant_failover": f"Redundant Feed / Backup Failover ({target_node.name})"
        }

        return ScenarioComparisonResponse(
            scenario_name=scenario_name_map.get(request.intervention_type, request.intervention_type),
            intervention_type=request.intervention_type,
            failed_node_id=failed_node.id,
            failed_node_name=failed_node.name,
            is_feasible=is_feasible,
            feasibility_reason=feasibility_reason,
            assumptions=assumptions,
            baseline_overall_risk=round(baseline_overall, 4),
            intervention_overall_risk=round(intervention_overall, 4),
            overall_risk_delta=overall_delta,
            baseline_critical_facilities_affected=baseline_critical_affected,
            intervention_critical_facilities_affected=intervention_critical_affected,
            baseline_affected_components=baseline_affected_paths,
            intervention_affected_components=intervention_affected_paths,
            component_comparisons=comparisons,
            newly_affected_components=newly_affected,
            improved_components=improved,
            recommendation=recommendation,
            explanation=explanation
        )

    def _clone_graph(self, src: CrisisGraph) -> CrisisGraph:
        """Creates an independent CrisisGraph instance with identical topology."""
        clone = CrisisGraph()
        clone.graph = src.graph.copy()
        clone.nodes_dict = copy.deepcopy(src.nodes_dict)
        clone.edges_list = copy.deepcopy(src.edges_list)
        clone.metadata = copy.deepcopy(src.metadata)
        return clone

    def _apply_intervention(
        self,
        graph: CrisisGraph,
        request: ScenarioComparisonRequest,
        failed_node: NodeModel,
        target_node: NodeModel,
        severity: float
    ) -> Tuple[bool, Optional[str], List[str], Dict[str, Dict[str, Any]]]:
        """
        Applies counterfactual intervention rules to the cloned graph.
        Returns (is_feasible, feasibility_reason, assumptions, cascade_results).
        """
        itype = request.intervention_type

        if itype == "no_intervention":
            assumptions = [
                "No mitigation applied; failure propagates unhindered along existing dependency links.",
                "Coupling strengths and transmission damping match nominal grid equations."
            ]
            cascade = graph.simulate_cascade({failed_node.id: severity})
            return True, None, assumptions, cascade

        elif itype == "load_rerouting":
            # If target_node_id is specified and distinct from failed_node, check edges incident to target_node
            if request.target_node_id and request.target_node_id != failed_node.id:
                eligible_edges = [
                    (u, v) for u, v, d in graph.graph.edges(data=True)
                    if (v == target_node.id or (u == failed_node.id and v == target_node.id))
                    and d.get("alternative_path_exists", False)
                ]
            else:
                # General rerouting away from the failing node
                eligible_edges = [
                    (u, v) for u, v, d in graph.graph.edges(data=True)
                    if u == failed_node.id and d.get("alternative_path_exists", False)
                ]

            if not eligible_edges:
                assumptions = [
                    "Rerouting evaluation attempted.",
                    f"Component '{target_node.name}' has no verified alternative transmission path or parallel feeder."
                ]
                return False, f"Component '{target_node.name}' has no verified alternative transmission path or parallel feeder in the network topology.", assumptions, {}

            assumptions = [
                f"Load transferred away from compromised path via verified secondary parallel ties.",
                f"Rerouted links: {', '.join([f'{u} -> {v}' for u, v in eligible_edges])}.",
                "Coupling strength on rerouted paths mitigated by 75% via load diversion."
            ]

            # In the intervention graph, mitigate coupling on the alternate paths
            for u, v in eligible_edges:
                if graph.graph.has_edge(u, v):
                    graph.graph[u][v]["dependency_strength"] = round(
                        graph.graph[u][v]["dependency_strength"] * 0.20, 3
                    )

            cascade = graph.simulate_cascade({failed_node.id: severity})
            return True, None, assumptions, cascade

        elif itype == "component_isolation":
            assumptions = [
                f"Circuit breakers tripped to physically isolate '{target_node.name}' from the operational grid.",
                "Surge and thermal cascade transmission from the isolated node to downstream facilities drops to 0.0.",
                "Collateral impact: Downstream components lacking redundant feeds will suffer loss of service."
            ]

            # Sever all outgoing edges from target_node to halt surge propagation
            outgoing = list(graph.graph.successors(target_node.id))
            for succ in outgoing:
                graph.graph.remove_edge(target_node.id, succ)

            # If the isolated component is the failed node itself, it cannot propagate downstream
            if target_node.id == failed_node.id:
                cascade = {}
            else:
                cascade = graph.simulate_cascade({failed_node.id: severity})

            # Check collateral damage: any successor that now has in_degree == 0 loses upstream supply!
            for succ in outgoing:
                if graph.graph.in_degree(succ) == 0:
                    succ_node = graph.get_node(succ)
                    has_backup = succ_node.metadata.get("backup_generator", False) if succ_node else False
                    if has_backup:
                        # Powered by local generator: moderate stress
                        cascade[succ] = {
                            "node_id": succ,
                            "node_name": succ_node.name,
                            "node_type": succ_node.type,
                            "criticality": succ_node.criticality,
                            "cascade_impact": 0.35,
                            "hop_distance": 1,
                            "root_cause": target_node.id,
                            "causal_path": [target_node.id, succ],
                            "reasoning": f"Disconnected by isolation of {target_node.name}; operating on emergency on-site backup."
                        }
                    else:
                        # Complete loss of service
                        cascade[succ] = {
                            "node_id": succ,
                            "node_name": succ_node.name if succ_node else succ,
                            "node_type": succ_node.type if succ_node else "unknown",
                            "criticality": succ_node.criticality if succ_node else 0.5,
                            "cascade_impact": 0.85,
                            "hop_distance": 1,
                            "root_cause": target_node.id,
                            "causal_path": [target_node.id, succ],
                            "reasoning": f"Outage: Loss of primary feeder following isolation of {target_node.name} (no backup generator)."
                        }

            return True, None, assumptions, cascade

        elif itype == "redundant_failover":
            # Check if target_node has verified redundancy:
            meta = target_node.metadata or {}
            has_backup_gen = meta.get("backup_generator", False)
            has_dual_feed = meta.get("dual_power_feed", False)
            has_ups = meta.get("backup_ups_battery_hours", 0) > 0
            has_alt_edge = any(
                data.get("alternative_path_exists", False)
                for _, _, data in graph.graph.in_edges(target_node.id, data=True)
            )

            if not (has_backup_gen or has_dual_feed or has_ups or has_alt_edge):
                assumptions = [
                    "Redundant failover attempted.",
                    f"Component '{target_node.name}' does not possess on-site generator, dual feed, or alternate tie."
                ]
                return False, f"Component '{target_node.name}' has no registered on-site emergency generator, dual feed, or secondary redundant tie.", assumptions, {}

            assumptions = [
                f"Target facility '{target_node.name}' switched to dedicated redundant on-site power/telecom feed.",
                "Compromised incoming transmission path decoupled from failing grid.",
                "Downstream dependent infrastructure continues receiving uncompromised service."
            ]

            # Decouple incoming edges to target_node to shield it from upstream cascade
            incoming_edges = list(graph.graph.in_edges(target_node.id))
            for u, v in incoming_edges:
                graph.graph.remove_edge(u, v)

            # Re-evaluate cascade on the protected topology
            cascade = graph.simulate_cascade({failed_node.id: severity})
            return True, None, assumptions, cascade

        else:
            raise ValueError(f"Unsupported intervention type '{itype}'")

    def _evaluate_risks_and_paths(
        self,
        graph: CrisisGraph,
        failed_node_id: str,
        failure_severity: float,
        cascade_results: Dict[str, Dict[str, Any]]
    ) -> Tuple[Dict[str, Dict[str, Any]], List[CascadePathDetail]]:
        """Calculates deterministic per-node risks and compiles cascade paths."""
        node_risks: Dict[str, Dict[str, Any]] = {}
        affected_paths: List[CascadePathDetail] = []

        for node in graph.get_all_nodes():
            is_root = (node.id == failed_node_id)
            direct_risk = failure_severity if is_root else 0.0

            cascade_info = cascade_results.get(node.id)
            cascade_impact = cascade_info["cascade_impact"] if cascade_info else 0.0

            effective_stress = max(direct_risk, cascade_impact)
            composite_risk = round(min(1.0, max(0.0, node.criticality * effective_stress)), 4)

            if composite_risk >= 0.65:
                status = "critical"
            elif composite_risk >= 0.35:
                status = "warning"
            else:
                status = "nominal"

            node_risks[node.id] = {
                "direct_risk": round(direct_risk, 4),
                "cascade_risk": round(cascade_impact, 4),
                "composite_risk": composite_risk,
                "status": status
            }

            if cascade_info and cascade_impact >= 0.10:
                affected_paths.append(CascadePathDetail(
                    node_id=node.id,
                    node_name=node.name,
                    cascade_impact=round(cascade_impact, 4),
                    hop_distance=cascade_info.get("hop_distance", 1),
                    causal_path=cascade_info.get("causal_path", [node.id]),
                    reasoning=cascade_info.get("reasoning", "")
                ))

        # Sort affected paths by cascade_impact descending
        affected_paths.sort(key=lambda p: p.cascade_impact, reverse=True)

        return node_risks, affected_paths

    def _synthesize_recommendation(
        self,
        intervention_type: str,
        is_feasible: bool,
        feasibility_reason: Optional[str],
        overall_delta: float,
        improved: List[str],
        newly_affected: List[str],
        target_node_name: str
    ) -> Tuple[str, str]:
        """Produces explainable recommendation and human-readable narrative."""
        if not is_feasible:
            rec = "INADMISSIBLE: INFEASIBLE INTERVENTION"
            exp = (
                f"The proposed intervention ({intervention_type.replace('_', ' ')}) cannot be executed. "
                f"Reason: {feasibility_reason}. Select an alternative mitigation strategy."
            )
            return rec, exp

        if intervention_type == "no_intervention":
            rec = "BASELINE MONITORING ONLY"
            exp = "No mitigative action taken. Review counterfactual alternatives (Load Rerouting, Redundant Failover) to prevent downstream cascade."
            return rec, exp

        if overall_delta > 0.03:
            if not newly_affected:
                rec = "STRONGLY RECOMMENDED: HIGH NET RISK REDUCTION"
                exp = (
                    f"Counterfactual simulation confirms this intervention reduces systemic cascade risk by "
                    f"{(overall_delta * 100):.1f}% with ZERO newly compromised facilities. "
                    f"Protected components: {', '.join(improved[:4]) if improved else 'downstream facilities'}."
                )
            else:
                rec = "CONDITIONALLY RECOMMENDED: RISK REDUCED WITH TRADE-OFFS"
                exp = (
                    f"Systemic risk is reduced by {(overall_delta * 100):.1f}%, successfully protecting {len(improved)} components. "
                    f"However, isolating {target_node_name} induces localized outages for: {', '.join(newly_affected)}. "
                    "Ensure secondary emergency protocols are dispatched before execution."
                )
        elif overall_delta > 0.0:
            rec = "MARGINAL IMPROVEMENT"
            exp = (
                f"Intervention produces a minor risk reduction of {(overall_delta * 100):.1f}%. "
                f"Improved components: {', '.join(improved) if improved else 'none'}."
            )
        else:
            rec = "NOT RECOMMENDED: NO NET BENEFIT"
            exp = (
                f"Simulated intervention does not improve overall grid resilience (net delta: {(overall_delta * 100):.1f}%). "
                f"Collateral impacts on {len(newly_affected)} nodes outweigh any localized protections."
            )

        return rec, exp
