import { z } from 'zod';
import { apiClient, fastApiClient } from '@/api/client';
import { parseSuccessEnvelope } from '@/shared/api/responseSchemas';
import type {
  GraphVisualizationResponse,
  GraphNeighborRequest,
  GraphNeighborResponse,
  GraphStatsResponse,
  GraphLink,
  GraphNode,
  SavedGraphNode,
} from '@/features/main/types/graph';

const SAVED_GRAPH_NODES_SCHEMA = z.array(
  z.object({
    noteId: z.int().positive(),
    title: z.string(),
    createdAt: z.iso.datetime({ local: true, offset: true }),
  }),
);

const GRAPH_SCHEMA = z.object({
  user_id: z.int().positive(),
  nodes: z.array(z.object({ id: z.int().positive(), title: z.string(), created_at: z.string() })),
  links: z.array(
    z.object({
      source: z.int().positive(),
      target: z.int().positive(),
      score: z.number().min(0).max(1),
    }),
  ),
  stats: z
    .object({
      total_nodes: z.int().nonnegative(),
      total_links: z.int().nonnegative(),
      avg_connections: z.number().nonnegative(),
    })
    .nullable(),
});
const NEIGHBORS_SCHEMA = z.object({
  center_note_id: z.int().positive(),
  neighbors: z.array(
    z.object({
      center_id: z.int().positive(),
      center_title: z.string(),
      neighbor_id: z.int().positive(),
      neighbor_title: z.string(),
      distance: z.int().positive(),
    }),
  ),
});
const STATS_SCHEMA = z.object({
  user_id: z.int().positive(),
  total_notes: z.int().nonnegative(),
  total_relationships: z.int().nonnegative(),
  avg_connections: z.number().nonnegative(),
});

export function parseGraphVisualization(input: unknown): GraphVisualizationResponse {
  return GRAPH_SCHEMA.parse(input);
}

export function parseSavedGraphNodes(input: unknown): SavedGraphNode[] {
  return parseSuccessEnvelope(input, (data) => SAVED_GRAPH_NODES_SCHEMA.parse(data));
}

/** Keep saved notes visible even while the separate AI graph is unavailable or behind. */
export function mergeSavedNotesWithGraph(
  savedNotes: SavedGraphNode[],
  aiGraph: GraphVisualizationResponse | undefined,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes = savedNotes.map((note) => ({
    id: note.noteId,
    title: note.title,
    created_at: note.createdAt,
  }));
  const savedIds = new Set(nodes.map((node) => node.id));
  const links =
    aiGraph?.links.filter((link) => savedIds.has(link.source) && savedIds.has(link.target)) ?? [];
  return { nodes, links };
}

export const savedGraphNodesAPI = {
  async getSavedGraphNodes(sessionEpoch: number, signal?: AbortSignal): Promise<SavedGraphNode[]> {
    const response = await apiClient.get<unknown>('/api/notes/graph-nodes', {
      sessionEpoch,
      signal,
    });
    return parseSavedGraphNodes(response.data);
  },
};

export const graphAPI = {
  async getGraphVisualization(
    sessionEpoch: number,
    signal?: AbortSignal,
  ): Promise<GraphVisualizationResponse> {
    const response = await fastApiClient.get<unknown>('/graph/visualization', {
      sessionEpoch,
      signal,
    });
    return parseGraphVisualization(response.data);
  },

  async getGraphNeighbors(
    request: GraphNeighborRequest,
    sessionEpoch: number,
    signal?: AbortSignal,
  ): Promise<GraphNeighborResponse> {
    const nodeId = z.int().positive().parse(request.node_id);
    const depth = z.int().min(1).max(3).parse(request.depth);
    const response = await fastApiClient.get<unknown>(`/graph/neighbors/${nodeId}`, {
      params: { depth },
      sessionEpoch,
      signal,
    });
    return NEIGHBORS_SCHEMA.parse(response.data);
  },

  async getGraphStats(sessionEpoch: number, signal?: AbortSignal): Promise<GraphStatsResponse> {
    const response = await fastApiClient.get<unknown>('/stats', { sessionEpoch, signal });
    return STATS_SCHEMA.parse(response.data);
  },
};
