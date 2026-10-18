"""Rule-based explainable recommendation generator for mitigating infrastructure cascade risks."""
from typing import List, Dict, Any
from app.models import NodeRisk
from app.crisis_graph import CrisisGraph


class RecommendationEngine:
    """Generates explainable preventive actions based on active risk profiles and graph topology."""

    def __init__(self, crisis_graph: CrisisGraph):
        self.graph = crisis_graph

    def generate_recommendations(self, risks: List[NodeRisk]) -> List[Dict[str, Any]]:
        """Generates ranked, transparent mitigations for any nodes experiencing elevated risk."""
        recommendations = []

        # Find critical and warning nodes
        troubled_nodes = [r for r in risks if r.composite_risk >= 0.35]
        # Sort by composite_risk descending
        troubled_nodes.sort(key=lambda r: r.composite_risk, reverse=True)

        for rank, item in enumerate(troubled_nodes[:5], start=1):
            node = self.graph.get_node(item.node_id)
            if not node:
                continue

            # Check incoming edges for alternative path availability
            direct_suppliers = self.graph.get_direct_suppliers(item.node_id)
            has_alt_path = False
            for supplier in direct_suppliers:
                edge = self.graph.graph.get_edge_data(supplier, item.node_id)
                if edge and edge.get("alternative_path_exists"):
                    has_alt_path = True
                    break

            if item.direct_risk >= 0.60:
                # Intrinsic failure recommendation
                if node.type in ["substation", "transformer"]:
                    rec = {
                        "priority": rank,
                        "action_type": "load_rerouting",
                        "title": f"Reroute Feeder Load from {node.name}",
                        "target_node": item.node_id,
                        "estimated_risk_reduction": "45% - 60%",
                        "reasoning": (
                            f"{node.name} exhibits severe internal operational stress (direct risk {item.direct_risk:.2f}). "
                            "Rerouting load to parallel distribution lines will reduce thermal load and avert breaker trips."
                        )
                    }
                else:
                    rec = {
                        "priority": rank,
                        "action_type": "component_isolation",
                        "title": f"Isolate & Engage Local Reserves for {node.name}",
                        "target_node": item.node_id,
                        "estimated_risk_reduction": "30% - 50%",
                        "reasoning": (
                            f"{node.name} telemetry reflects critical deviation. "
                            "Trigger automated failover and isolate node from common bus to protect upstream components."
                        )
                    }
            else:
                # Cascade-induced risk recommendation
                if has_alt_path:
                    rec = {
                        "priority": rank,
                        "action_type": "failover_switch",
                        "title": f"Activate Redundant Feed for {node.name}",
                        "target_node": item.node_id,
                        "estimated_risk_reduction": "60% - 80%",
                        "reasoning": (
                            f"{node.name} has elevated cascade risk ({item.cascade_risk:.2f}) from upstream "
                            f"{', '.join(item.impacted_by)}. An alternative redundant path is verified; activate switchover immediately."
                        )
                    }
                else:
                    rec = {
                        "priority": rank,
                        "action_type": "island_and_backup",
                        "title": f"Pre-emptively Island {node.name} & Dispatch On-Site Backup",
                        "target_node": item.node_id,
                        "estimated_risk_reduction": "40% - 70%",
                        "reasoning": (
                            f"{node.name} is threatened by upstream cascade without secondary transmission lines. "
                            "Initiate controlled islanding and spin up on-site emergency generation."
                        )
                    }

            recommendations.append(rec)

        if not recommendations:
            recommendations.append({
                "priority": 1,
                "action_type": "routine_monitoring",
                "title": "Maintain Continuous Grid Monitoring",
                "target_node": "all",
                "estimated_risk_reduction": "N/A",
                "reasoning": "All 16 infrastructure nodes operating within nominal risk boundaries."
            })

        return recommendations
