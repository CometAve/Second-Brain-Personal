import { LOGO_EDGES, LOGO_VERTICES } from '@/shared/components/loading-logo-mesh';
import type { LogoVertex } from '@/shared/components/loading-logo-mesh';

type ProjectedVertex = { x: number; y: number; depth: number };

// At 4.5 seconds per turn, the mesh rotates about 80° in the first second,
// making its inferred depth visible during a brief loading state.
const ROTATION_SECONDS = 4.5;

function rotate([x, y, z]: LogoVertex, phase: number): LogoVertex {
  // A fixed vertical axis gives coherent rigid rotation. The earlier sinusoidal
  // pitch made the sparse sides appear to tip as they entered the front view.
  const cosine = Math.cos(phase);
  const sine = Math.sin(phase);
  return [x * cosine + z * sine, y, z * cosine - x * sine];
}

export function drawLogoFrame(context: CanvasRenderingContext2D, side: number, phase: number) {
  context.clearRect(0, 0, side, side);
  // Orthographic projection keeps the traced x/y ratios exact at the source
  // view. Depth still changes brightness and rotational parallax.
  const radius = side * 0.4;
  const points: ProjectedVertex[] = LOGO_VERTICES.map((vertex) => {
    const [x, y, z] = rotate(vertex, phase);
    return { x: side / 2 + x * radius, y: side / 2 - y * radius, depth: z };
  });
  // Every edge belongs to the same fixed closed mesh. Rotation only changes
  // projection and brightness; no angle-specific rim edges appear or disappear.
  const edges = LOGO_EDGES.map(([a, b]) => ({
    a,
    b,
    depth: (points[a].depth + points[b].depth) / 2,
  })).sort((first, second) => first.depth - second.depth);

  // The source is a bright open wire graph, not a uniformly shaded solid shell.
  // Every rear line stays visible; depth brightness separates front and rear
  // paths only after the fixed surface geometry has established its volume.
  context.lineWidth = Math.max(0.85, side * 0.009);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const { a, b, depth } of edges) {
    const light = Math.min(1, Math.max(0, (depth + 1) / 2));
    context.strokeStyle = `rgba(249, 244, 255, ${0.5 + light * 0.48})`;
    context.beginPath();
    context.moveTo(points[a].x, points[a].y);
    context.lineTo(points[b].x, points[b].y);
    context.stroke();
  }
}

/** Releases the clock and subscriptions when a loading view leaves the tree. */
export function startLogoAnimation(
  canvas: HTMLCanvasElement,
  side: number,
  onFirstFrame: () => void,
) {
  let context: CanvasRenderingContext2D | null;
  try {
    context = canvas.getContext('2d');
  } catch {
    // A blocked canvas leaves the original logo visible.
    return () => {};
  }
  if (!context) return () => {};

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(side * pixelRatio);
  canvas.height = Math.round(side * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let firstFrame = true;

  const paint = () => {
    drawLogoFrame(context, side, (elapsed / (ROTATION_SECONDS * 1000)) * Math.PI * 2);
    if (firstFrame) {
      firstFrame = false;
      onFirstFrame();
    }
  };
  const tick = (now: number) => {
    if (document.hidden || motion?.matches) return;
    // Use the display clock directly. A millisecond threshold here quantizes
    // paints into uneven refresh intervals, even when drawing is inexpensive.
    elapsed += previous === 0 ? 0 : now - previous;
    previous = now;
    paint();
    frame = requestAnimationFrame(tick);
  };
  const updateActivity = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    if (document.hidden) return;
    if (motion?.matches) paint();
    else frame = requestAnimationFrame(tick);
  };

  paint();
  document.addEventListener('visibilitychange', updateActivity);
  motion?.addEventListener('change', updateActivity);
  updateActivity();
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', updateActivity);
    motion?.removeEventListener('change', updateActivity);
  };
}
