import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Maximize2, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import { createGraphScene } from '@/features/main/components/graphScene';
import type { GraphScene } from '@/features/main/components/graphScene';
import {
  useGraphVisualization,
  useSavedGraphNodes,
} from '@/features/main/hooks/useGraphVisualization';
import { mergeSavedNotesWithGraph } from '@/features/main/services/graphService';
import { useGraphStore } from '@/features/main/stores/graphStore';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import type { GraphLink, GraphNode } from '@/features/main/types/graph';
import { useAuthStore } from '@/stores/authStore';

interface GraphProps {
  onReady: () => void;
}

type PositionedGraphNode = GraphNode & {
  x?: number;
  y?: number;
  z?: number;
};

interface RendererData {
  nodes: PositionedGraphNode[];
  links: GraphLink[];
}
interface ActiveScene {
  sessionEpoch: number;
  data: RendererData;
  visuals: GraphScene;
}

const IDLE_DELAY_MS = 2400;
const INITIAL_LAYOUT_TICKS = 80;
const MIN_CAMERA_DISTANCE = 35;
const DEFAULT_MAX_CAMERA_DISTANCE = 1400;
const MAX_FIT_DISTANCE_MULTIPLIER = 2;
const EMPTY_RENDERER_DATA: RendererData = { nodes: [], links: [] };
const linkWidth = (link: GraphLink) => 0.35 + link.score * 0.65;
const linkColor = (link: GraphLink) => (link.score >= 0.7 ? '#5b8b98' : '#405061');

export function Graph({ onReady }: GraphProps) {
  const navigate = useNavigate();
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const savedNodesQuery = useSavedGraphNodes();
  const aiGraphQuery = useGraphVisualization((savedNodesQuery.data?.length ?? 0) > 0);
  const highlightedNodeIds = useSearchPanelStore((state) => state.highlightedNodeIds);
  const isSearchOpen = useSearchPanelStore((state) => state.isOpen);
  const isPaused = useGraphStore((state) => state.isPaused);
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fittedSessionRef = useRef<number | null>(null);
  const fitDistanceRef = useRef<number | null>(null);
  const readySessionRef = useRef<number | null>(null);
  const fitFrameRef = useRef<number | null>(null);
  const readyFrameRef = useRef<number | null>(null);
  const engineSettledRef = useRef(false);
  const activeSceneRef = useRef<ActiveScene | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [scene, setScene] = useState<ActiveScene | null>(null);
  const [forcesReadyScene, setForcesReadyScene] = useState<ActiveScene | null>(null);
  const isGraphReady = container !== null && size.width > 0 && size.height > 0;

  const graphData = useMemo(
    () =>
      savedNodesQuery.data
        ? mergeSavedNotesWithGraph(savedNodesQuery.data, aiGraphQuery.data)
        : null,
    [savedNodesQuery.data, aiGraphQuery.data],
  );
  // D3 mutates positions and link endpoints. Query cache records stay immutable.
  const nextRendererData = useMemo<RendererData | null>(
    () =>
      graphData
        ? {
            nodes: graphData.nodes.map((node) => ({ ...node })),
            links: graphData.links.map((link) => ({ ...link })),
          }
        : null,
    [graphData],
  );
  const analyzedIds = new Set(aiGraphQuery.data?.nodes.map((node) => node.id) ?? []);
  const hasNotesWithoutAnalysis =
    savedNodesQuery.data?.some((note) => !analyzedIds.has(note.noteId)) ?? false;
  const activeNode = graphData?.nodes.find((node) => node.id === activeNodeId);
  const currentScene = scene?.sessionEpoch === sessionEpoch ? scene : null;
  const rendererData = currentScene?.data;
  const forcesReady = forcesReadyScene === currentScene;
  const noCanvasOutcome =
    (savedNodesQuery.isError && (!graphData || graphData.nodes.length === 0)) ||
    graphData?.nodes.length === 0;

  useEffect(() => {
    if (!noCanvasOutcome || readySessionRef.current === sessionEpoch) return;
    if (readyFrameRef.current !== null) cancelAnimationFrame(readyFrameRef.current);
    readyFrameRef.current = null;
    readySessionRef.current = sessionEpoch;
    onReady();
  }, [noCanvasOutcome, onReady, sessionEpoch]);

  useEffect(
    () => () => {
      if (fitFrameRef.current !== null) cancelAnimationFrame(fitFrameRef.current);
      if (readyFrameRef.current !== null) cancelAnimationFrame(readyFrameRef.current);
      fitFrameRef.current = null;
      readyFrameRef.current = null;
    },
    [nextRendererData, sessionEpoch],
  );

  useEffect(() => {
    if (!container) return;
    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    if (nextRendererData?.nodes.length) return;
    fittedSessionRef.current = null;
    fitDistanceRef.current = null;
  }, [nextRendererData]);

  const attachContainer = useCallback(
    (node: HTMLDivElement | null) => {
      setContainer(node);
      if (!node || !nextRendererData || nextRendererData.nodes.length === 0) return;
      // A data refresh may add links while the user is looking at the graph.
      // Keep the established positions of unchanged notes instead of restarting
      // every node at a new random position. D3 owns these mutable copies only.
      const previousScene = activeSceneRef.current;
      if (previousScene?.sessionEpoch === sessionEpoch) {
        const previousNodes = new Map(previousScene.data.nodes.map((node) => [node.id, node]));
        if (!nextRendererData.nodes.some((node) => previousNodes.has(node.id))) {
          fittedSessionRef.current = null;
          fitDistanceRef.current = null;
        }
        for (const node of nextRendererData.nodes) {
          const previous = previousNodes.get(node.id);
          if (previous?.x !== undefined && Number.isFinite(previous.x)) node.x = previous.x;
          if (previous?.y !== undefined && Number.isFinite(previous.y)) node.y = previous.y;
          if (previous?.z !== undefined && Number.isFinite(previous.z)) node.z = previous.z;
        }
      }
      const visuals = createGraphScene(
        nextRendererData.nodes,
        nextRendererData.links,
        previousScene?.visuals.labelRenderer,
      );
      engineSettledRef.current = false;
      const nextScene = { sessionEpoch, data: nextRendererData, visuals };
      activeSceneRef.current = nextScene;
      setScene(nextScene);
      return () => visuals.dispose();
    },
    [nextRendererData, sessionEpoch],
  );

  useEffect(
    () => () => {
      activeSceneRef.current?.visuals.labelRenderer.domElement.remove();
    },
    [],
  );

  const attachGraphHost = useCallback(
    (host: HTMLDivElement | null) => {
      const fg = fgRef.current;
      if (!host || !fg || !currentScene) return;
      const linkForce = fg.d3Force('link') as { distance: (distance: number) => void } | undefined;
      linkForce?.distance(90);
      const chargeForce = fg.d3Force('charge') as
        { strength: (strength: number) => void } | undefined;
      chargeForce?.strength(-185);
      setForcesReadyScene(currentScene);
    },
    [currentScene],
  );

  const stopIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);
  const scheduleIdlePause = useCallback(() => {
    stopIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      fgRef.current?.pauseAnimation();
      idleTimerRef.current = null;
    }, IDLE_DELAY_MS);
  }, [stopIdleTimer]);
  const resumeForInteraction = useCallback(() => {
    if (isPaused || document.visibilityState === 'hidden') return;
    fgRef.current?.resumeAnimation();
    if (engineSettledRef.current) scheduleIdlePause();
  }, [isPaused, scheduleIdlePause]);

  useEffect(() => {
    if (!currentScene) return;
    currentScene.visuals.updateHighlights(highlightedNodeIds, activeNodeId);
    fgRef.current?.refresh();
    resumeForInteraction();
  }, [currentScene, highlightedNodeIds, activeNodeId, resumeForInteraction]);

  useEffect(() => {
    if (!currentScene) return;
    const syncVisibility = () => {
      if (isPaused || document.visibilityState === 'hidden') {
        stopIdleTimer();
        fgRef.current?.pauseAnimation();
      } else {
        resumeForInteraction();
      }
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      stopIdleTimer();
    };
  }, [currentScene, isPaused, resumeForInteraction, stopIdleTimer]);

  const fitInitialView = () => {
    const fg = fgRef.current;
    if (!fg || !rendererData?.nodes.length || fittedSessionRef.current === sessionEpoch) return;
    fittedSessionRef.current = sessionEpoch;
    if (rendererData.nodes.length > 1) fg.zoomToFit(0, 100);
    else fg.cameraPosition({ x: 0, y: 0, z: 115 }, { x: 0, y: 0, z: 0 }, 0);
    fitDistanceRef.current = fg.camera().position.length();
  };
  const handleEngineTick = () => {
    if (!forcesReady || !currentScene || currentScene.data !== nextRendererData) return;
    if (
      (fittedSessionRef.current === sessionEpoch && readySessionRef.current === sessionEpoch) ||
      fitFrameRef.current !== null ||
      readyFrameRef.current !== null
    )
      return;
    // The library calls onEngineTick before copying D3 positions to Three
    // objects. zoomToFit reads the Three objects, so fit on the next frame.
    fitFrameRef.current = requestAnimationFrame(() => {
      fitFrameRef.current = null;
      fitInitialView();
      if (readySessionRef.current === sessionEpoch) return;
      readyFrameRef.current = requestAnimationFrame(() => {
        readyFrameRef.current = null;
        readySessionRef.current = sessionEpoch;
        onReady();
      });
    });
  };
  const handleEngineStop = () => {
    handleEngineTick();
    if (!forcesReady || isPaused || document.visibilityState === 'hidden') return;
    engineSettledRef.current = true;
    scheduleIdlePause();
  };
  const zoom = (factor: number) => {
    const fg = fgRef.current;
    if (!fg) return;
    resumeForInteraction();
    const currentDistance = fg.camera().position.length();
    if (!Number.isFinite(currentDistance) || currentDistance === 0) return;
    const maxDistance = Math.max(
      DEFAULT_MAX_CAMERA_DISTANCE,
      (fitDistanceRef.current ?? DEFAULT_MAX_CAMERA_DISTANCE) * MAX_FIT_DISTANCE_MULTIPLIER,
    );
    const nextDistance =
      factor < 1
        ? Math.max(MIN_CAMERA_DISTANCE, currentDistance * factor)
        : Math.min(maxDistance, currentDistance * factor);
    // A wheel gesture may have crossed a button limit. Permit steps back
    // toward the valid range without snapping the camera to the boundary.
    if (
      (factor < 1 && nextDistance >= currentDistance) ||
      (factor > 1 && nextDistance <= currentDistance)
    )
      return;
    const position = fg
      .camera()
      .position.clone()
      .multiplyScalar(nextDistance / currentDistance);
    fg.cameraPosition({ x: position.x, y: position.y, z: position.z }, undefined, 0);
  };
  const openNote = (nodeId: number) => {
    void navigate({ to: '/notes/$noteId', params: { noteId: String(nodeId) } });
  };

  if (savedNodesQuery.isPending && !savedNodesQuery.data) return null;
  if (savedNodesQuery.isError && (!graphData || graphData.nodes.length === 0)) {
    return (
      <div
        className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-[#10151f] px-6 text-center text-[#eef1f6]"
        role="alert"
      >
        <p className="text-sm">저장된 노트를 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => void savedNodesQuery.refetch()}
          className="rounded-xl border border-white/20 px-5 py-2.5 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4a4f6]"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (graphData?.nodes.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#10151f] px-6 text-center">
        <p className="text-sm text-[#9da8bb]" role="status">
          저장된 노트가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={attachContainer}
      className="relative size-full min-h-0 overflow-hidden bg-[#10151f] text-[#eef1f6]"
      onPointerMove={resumeForInteraction}
      onPointerDown={resumeForInteraction}
      onWheel={resumeForInteraction}
    >
      <div className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(circle_at_52%_44%,rgba(101,99,153,0.10),transparent_48%)]" />
      {isGraphReady && currentScene && rendererData && (
        <div ref={attachGraphHost}>
          <ForceGraph3D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={forcesReady ? rendererData : EMPTY_RENDERER_DATA}
            extraRenderers={[currentScene.visuals.labelRenderer]}
            nodeLabel={(node) => node.title.trim() || '제목 없는 노트'}
            nodeThreeObject={currentScene.visuals.getNodeObject}
            linkWidth={linkWidth}
            linkColor={linkColor}
            linkOpacity={0.48}
            linkDirectionalParticles={0}
            backgroundColor="#10151f"
            onNodeHover={(node) => {
              if (node) setActiveNodeId(node.id);
            }}
            onNodeClick={(node) => openNote(node.id)}
            onBackgroundClick={() => setActiveNodeId(null)}
            onEngineTick={handleEngineTick}
            onEngineStop={handleEngineStop}
            enableNodeDrag={false}
            showNavInfo={false}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.5}
            warmupTicks={INITIAL_LAYOUT_TICKS}
            cooldownTime={5000}
          />
        </div>
      )}
      <section
        aria-label="지식 지도 정보"
        className={`pointer-events-none absolute top-6 z-10 max-w-sm ${isSearchOpen ? 'hidden' : 'left-5 sm:left-8'}`}
      >
        <h1 className="text-lg font-medium sm:text-xl">지식 지도</h1>
        <p className="mt-2 text-xs text-[#9da8bb]">
          저장된 노트 {graphData?.nodes.length ?? 0}개 · 분석된 연결 {graphData?.links.length ?? 0}
          개
        </p>
      </section>
      {(savedNodesQuery.isError ||
        aiGraphQuery.isError ||
        aiGraphQuery.isPending ||
        hasNotesWithoutAnalysis) && (
        <div
          className={`absolute top-28 right-5 z-10 max-w-[min(20rem,calc(100%-2.5rem))] rounded-2xl border border-white/10 bg-[#171d29]/90 px-4 py-3 text-xs leading-5 text-[#b8c3d2] shadow-xl shadow-black/10 backdrop-blur-sm sm:right-8 lg:top-6 ${isSearchOpen ? 'hidden sm:block' : ''}`}
          role={savedNodesQuery.isError || aiGraphQuery.isError ? 'alert' : 'status'}
        >
          {savedNodesQuery.isError ? (
            <>
              노트 갱신에 실패했습니다. 표시된 내용이 최신이 아닐 수 있습니다.{' '}
              <button
                type="button"
                onClick={() => void savedNodesQuery.refetch()}
                className="ml-2 font-medium text-[#c8bcff] underline underline-offset-2"
              >
                다시 시도
              </button>
            </>
          ) : aiGraphQuery.isError ? (
            <>
              노트 연결을 불러오지 못했습니다.{' '}
              <button
                type="button"
                onClick={() => void aiGraphQuery.refetch()}
                disabled={aiGraphQuery.isFetching}
                className="ml-2 font-medium text-[#c8bcff] underline underline-offset-2 disabled:opacity-50"
              >
                다시 시도
              </button>
            </>
          ) : aiGraphQuery.isPending ? (
            '노트 연결을 불러오는 중'
          ) : (
            '연결 분석 대기 중'
          )}
        </div>
      )}
      {activeNode && !isSearchOpen && (
        <div className="absolute right-5 bottom-24 z-10 w-[min(19rem,calc(100%-2.5rem))] rounded-2xl border border-[#b4a4f6]/25 bg-[#171d29]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-sm sm:right-8">
          <p className="text-xs text-[#9da8bb]">선택한 노트</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 font-medium">
            {activeNode.title.trim() || '제목 없는 노트'}
          </p>
          <button
            type="button"
            onClick={() => openNote(activeNode.id)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#c8bcff] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4a4f6]"
          >
            노트 열기 <ArrowUpRight aria-hidden="true" size={14} />
          </button>
        </div>
      )}
      <div
        role="group"
        aria-label="지도 확대 및 보기"
        className="absolute right-5 bottom-6 z-10 flex items-center gap-1 rounded-xl border border-white/10 bg-[#171d29]/95 p-1 shadow-xl shadow-black/20 sm:right-8"
      >
        <button
          type="button"
          onClick={() => zoom(0.78)}
          aria-label="지도 확대"
          title="확대"
          className="rounded-lg p-2.5 text-[#d6dce7] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#b4a4f6]"
        >
          <Plus aria-hidden="true" size={17} />
        </button>
        <button
          type="button"
          onClick={() => zoom(1.28)}
          aria-label="지도 축소"
          title="축소"
          className="rounded-lg p-2.5 text-[#d6dce7] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#b4a4f6]"
        >
          <Minus aria-hidden="true" size={17} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/10" aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            resumeForInteraction();
            const fg = fgRef.current;
            fg?.zoomToFit(0, 100);
            if (fg) fitDistanceRef.current = fg.camera().position.length();
          }}
          aria-label="모든 노트 보기"
          title="전체 보기"
          className="rounded-lg p-2.5 text-[#d6dce7] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#b4a4f6]"
        >
          <Maximize2 aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
