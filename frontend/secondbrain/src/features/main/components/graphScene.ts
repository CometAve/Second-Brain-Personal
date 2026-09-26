import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { GraphLink, GraphNode } from '@/features/main/types/graph';

interface NodeVisual {
  object: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  label: CSS2DObject | null;
  title: string;
  linked: boolean;
}

export interface GraphScene {
  labelRenderer: CSS2DRenderer;
  objects: Map<number, NodeVisual>;
  getNodeObject: (node: GraphNode) => THREE.Group;
  updateHighlights: (highlightedIds: ReadonlySet<number>, activeId: number | null) => void;
  dispose: () => void;
}

const CORE_RADIUS = 4.5;
const LABEL_LIMIT = 8;
const SEARCH_LABEL_LIMIT = 5;

function createLabel(title: string): CSS2DObject {
  const element = document.createElement('div');
  element.textContent = title.trim() || '제목 없는 노트';
  element.style.cssText =
    'max-width:156px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 9px;border:1px solid rgba(184,193,213,.2);border-radius:9px;background:rgba(16,21,31,.86);color:#e8edf7;font:400 12px/1.35 var(--font-sans);box-shadow:0 6px 22px rgba(0,0,0,.22);pointer-events:none;';
  const label = new CSS2DObject(element);
  label.position.y = 10;
  return label;
}

function endpointId(endpoint: GraphLink['source'] | GraphNode): number {
  return typeof endpoint === 'number' ? endpoint : endpoint.id;
}

export function createGraphScene(
  nodes: GraphNode[],
  links: GraphLink[],
  labelRenderer = new CSS2DRenderer(),
): GraphScene {
  const linkedIds = new Set<number>();
  for (const link of links) {
    linkedIds.add(endpointId(link.source));
    linkedIds.add(endpointId(link.target));
  }

  const geometry = new THREE.SphereGeometry(CORE_RADIUS, 20, 16);
  const materials = {
    note: new THREE.MeshStandardMaterial({
      color: 0xb4a4f6,
      roughness: 0.36,
      metalness: 0.22,
      emissive: 0x554490,
      emissiveIntensity: 0.26,
    }),
    linked: new THREE.MeshStandardMaterial({
      color: 0x83d4cc,
      roughness: 0.31,
      metalness: 0.3,
      emissive: 0x246d71,
      emissiveIntensity: 0.32,
    }),
    active: new THREE.MeshStandardMaterial({
      color: 0xf3e7ff,
      roughness: 0.26,
      metalness: 0.28,
      emissive: 0xb4a4f6,
      emissiveIntensity: 0.65,
    }),
    muted: new THREE.MeshStandardMaterial({
      color: 0x526071,
      roughness: 0.65,
      metalness: 0.08,
      emissive: 0x202a37,
      emissiveIntensity: 0.1,
    }),
    halo: new THREE.MeshBasicMaterial({
      color: 0xb4a4f6,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    }),
    activeHalo: new THREE.MeshBasicMaterial({
      color: 0xdacbff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.29,
      depthWrite: false,
    }),
  };

  labelRenderer.domElement.style.pointerEvents = 'none';
  const objects = new Map<number, NodeVisual>();

  for (const node of nodes) {
    const linked = linkedIds.has(node.id);
    const object = new THREE.Group();
    const core = new THREE.Mesh(geometry, linked ? materials.linked : materials.note);
    const halo = new THREE.Mesh(geometry, materials.halo);
    halo.scale.setScalar(1.42);
    object.add(core, halo);

    objects.set(node.id, { object, core, halo, label: null, title: node.title, linked });
  }

  function updateHighlights(highlightedIds: ReadonlySet<number>, activeId: number | null) {
    const hasSearch = highlightedIds.size > 0;
    const visibleSearchIds = new Set(Array.from(highlightedIds).slice(0, SEARCH_LABEL_LIMIT));
    for (const [id, visual] of objects) {
      const active = id === activeId || highlightedIds.has(id);
      visual.core.material = active
        ? materials.active
        : hasSearch
          ? materials.muted
          : visual.linked
            ? materials.linked
            : materials.note;
      visual.halo.material = active ? materials.activeHalo : materials.halo;
      visual.halo.visible = active || (!hasSearch && nodes.length <= 120);
      visual.object.scale.setScalar(active ? 1.18 : 1);
      const showLabel =
        id === activeId || (hasSearch ? visibleSearchIds.has(id) : nodes.length <= LABEL_LIMIT);
      if (showLabel && !visual.label) {
        visual.label = createLabel(visual.title);
        visual.object.add(visual.label);
      } else if (!showLabel && visual.label) {
        visual.object.remove(visual.label);
        visual.label.element.remove();
        visual.label = null;
      }
      if (visual.label) {
        visual.label.element.style.borderColor = active
          ? 'rgba(196,178,255,.72)'
          : 'rgba(184,193,213,.2)';
      }
    }
  }

  updateHighlights(new Set(), null);

  return {
    labelRenderer,
    objects,
    getNodeObject: (node) => {
      const object = objects.get(node.id)?.object;
      if (!object) throw new Error(`그래프 노드 ${node.id}의 렌더링 객체가 없습니다.`);
      return object;
    },
    updateHighlights,
    dispose: () => {
      for (const visual of objects.values()) {
        visual.object.clear();
        visual.label?.element.remove();
      }
      objects.clear();
      geometry.dispose();
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
