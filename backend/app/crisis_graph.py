"""CrisisGraph Core Engine: NetworkX-powered dependency modeling and cascade percolation."""
import json
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional, Any
import networkx as nx

from app.models import InfrastructureData, NodeModel, EdgeModel


class CrisisGraph:
    """Manages the directed infrastructure dependency graph and analyzes failure propagation."""

    def __init__(self, data_source: Optional[Path | str | dict | InfrastructureData] = None):
        self.graph = nx.DiGraph()
        self.nodes_dict: Dict[str, NodeModel] = {}
        self.edges_list: List[EdgeModel] = []
        self.metadata: Dict[str, Any] = {}

        if data_source is not None:
            self.load(data_source)

    def load(self, data_source: Path | str | dict | InfrastructureData) -> None:
        """Loads and validates the infrastructure topology from a file, dict, or Pydantic model."""
        if isinstance(data_source, InfrastructureData):
            raw_data = data_source.model_dump()
        elif isinstance(data_source, (str, Path)):
            path = Path(data_source)
            if not path.exists():
                raise FileNotFoundError(f"Infrastructure data file not found at: {path}")
            with open(path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
        elif isinstance(data_source, dict):
            raw_data = data_source
        else:
            raise ValueError(f"Unsupported data source type: {type(data_source)}")

        # Validate with Pydantic
        infra = InfrastructureData(**raw_data)
        self.metadata = {
            "version": infra.version,
            "name": infra.name,
            "generated_for": infra.generated_for
        }

        # Reset existing graph
        self.graph.clear()
        self.nodes_dict.clear()
        self.edges_list.clear()

        # Add Nodes with validation
        node_id_set: Set[str] = set()
        for node in infra.nodes:
            if node.id in node_id_set:
                raise ValueError(f"Duplicate node ID detected in infrastructure data: '{node.id}'")
            node_id_set.add(node.id)
            self.nodes_dict[node.id] = node
            self.graph.add_node(
                node.id,
                name=node.name,
                type=node.type,
                criticality=node.criticality,
                status=node.status,
                metadata=node.metadata
            )

        # Add Edges with reference validation
        for edge in infra.edges:
            if edge.source not in node_id_set:
                raise ValueError(
                    f"Edge source '{edge.source}' does not exist in nodes set for target '{edge.target}'"
                )
            if edge.target not in node_id_set:
                raise ValueError(
                    f"Edge target '{edge.target}' does not exist in nodes set from source '{edge.source}'"
                )

            self.edges_list.append(edge)
            self.graph.add_edge(
                edge.source,
                edge.target,
                dependency_strength=edge.dependency_strength,
                dependency_type=edge.dependency_type,
                alternative_path_exists=edge.alternative_path_exists
            )

    @property
    def node_count(self) -> int:
        return self.graph.number_of_nodes()

    @property
    def edge_count(self) -> int:
        return self.graph.number_of_edges()

    def get_node(self, node_id: str) -> Optional[NodeModel]:
        return self.nodes_dict.get(node_id)

    def get_all_nodes(self) -> List[NodeModel]:
        return list(self.nodes_dict.values())

    def get_all_edges(self) -> List[EdgeModel]:
        return self.edges_list

    def get_downstream_nodes(self, source_id: str) -> List[str]:
        """Returns all nodes directly or indirectly dependent on source_id (downstream)."""
        if source_id not in self.graph:
            return []
        # In a dependency graph where source -> target means target depends on source:
        # reachable nodes via outgoing edges are downstream dependents
        return list(nx.descendants(self.graph, source_id))

    def get_upstream_dependencies(self, target_id: str) -> List[str]:
        """Returns all nodes that target_id depends on directly or indirectly (upstream)."""
        if target_id not in self.graph:
            return []
        return list(nx.ancestors(self.graph, target_id))

    def get_direct_dependents(self, source_id: str) -> List[str]:
        """Returns immediate direct successors of source_id."""
        if source_id not in self.graph:
            return []
        return list(self.graph.successors(source_id))

    def get_direct_suppliers(self, target_id: str) -> List[str]:
        """Returns immediate direct predecessors that supply target_id."""
        if target_id not in self.graph:
            return []
        return list(self.graph.predecessors(target_id))

    def find_all_cascade_paths(self, source_id: str, target_id: str) -> List[List[str]]:
        """Returns all directed dependency paths between source and target."""
        if source_id not in self.graph or target_id not in self.graph:
            return []
        try:
            return list(nx.all_simple_paths(self.graph, source=source_id, target=target_id))
        except nx.NetworkXNoPath:
            return []

    def simulate_cascade(
        self,
        failing_nodes: Dict[str, float],
        damping_factor: float = 0.85
    ) -> Dict[str, Dict[str, Any]]:
        """
        Calculates failure percolation and cascade impact across downstream dependencies.
        
        Args:
            failing_nodes: Map of node_id to anomaly/failure severity [0.0, 1.0].
            damping_factor: Hop-to-hop signal attenuation factor (default 0.85).

        Returns:
            Dictionary mapping affected node_id to cascade impact metrics and causal paths.
        """
        results: Dict[str, Dict[str, Any]] = {}

        for root_id, severity in failing_nodes.items():
            if root_id not in self.graph or severity <= 0.0:
                continue

            # BFS traversal with path tracking
            queue: List[Tuple[str, float, int, List[str]]] = [(root_id, severity, 0, [root_id])]
            visited_impact: Dict[str, float] = {root_id: severity}

            while queue:
                current_id, current_impact, depth, path = queue.pop(0)

                for successor_id in self.graph.successors(current_id):
                    edge_data = self.graph.get_edge_data(current_id, successor_id)
                    coupling = edge_data.get("dependency_strength", 0.8)
                    has_alt = edge_data.get("alternative_path_exists", False)

                    # Redundancy attenuation: having a known alternative path mitigates 40% of transmitted risk
                    redundancy_attenuation = 0.60 if has_alt else 1.0

                    # Hop-attenuated cascade impact
                    propagated_impact = (
                        current_impact * coupling * redundancy_attenuation * (damping_factor ** (depth + 1))
                    )

                    # Keep the maximum impact if reachable via multiple paths
                    if successor_id not in visited_impact or propagated_impact > visited_impact[successor_id]:
                        visited_impact[successor_id] = propagated_impact
                        new_path = path + [successor_id]
                        
                        target_node = self.nodes_dict[successor_id]
                        criticality = target_node.criticality

                        # Explainable rationale
                        alt_text = "secondary path available" if has_alt else "no alternative backup feed"
                        reason = (
                            f"Dependent on upstream '{self.nodes_dict[current_id].name}' "
                            f"(hop distance {depth + 1}, coupling {coupling:.2f}, {alt_text})."
                        )

                        results[successor_id] = {
                            "node_id": successor_id,
                            "node_name": target_node.name,
                            "node_type": target_node.type,
                            "criticality": criticality,
                            "cascade_impact": round(propagated_impact, 4),
                            "hop_distance": depth + 1,
                            "root_cause": root_id,
                            "causal_path": new_path,
                            "reasoning": reason
                        }

                        # Continue percolation if impact remains significant (> 0.05)
                        if propagated_impact > 0.05:
                            queue.append((successor_id, propagated_impact, depth + 1, new_path))

        return results
