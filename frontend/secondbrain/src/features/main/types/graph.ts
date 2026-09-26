// 3D 시각화 데이터
export interface GraphNode {
  created_at: string;
  id: number;
  title: string;
}

/** PostgreSQL is the source of truth for which saved notes belong on the graph. */
export interface SavedGraphNode {
  noteId: number;
  title: string;
  createdAt: string;
}

export interface GraphLink {
  score: number;
  source: number;
  target: number;
}

export interface GraphVisualizationResponse {
  user_id: number;
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    total_nodes: number;
    total_links: number;
    avg_connections: number;
  } | null;
}

// 이웃 노드 조회
export interface GraphNeighbor {
  center_id: number;
  center_title: string;
  neighbor_id: number;
  neighbor_title: string;
  distance: number;
}

export interface GraphNeighborRequest {
  node_id: number;
  depth: number;
}

export interface GraphNeighborResponse {
  center_note_id: number;
  neighbors: GraphNeighbor[];
}

// 통계
export interface GraphStatsResponse {
  user_id: number;
  total_notes: number;
  total_relationships: number;
  avg_connections: number;
}
