import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { VaultScene, VaultSceneOptions } from '../three/VaultScene';

export interface HeroCanvasHandle {
  setProgress: (p: number) => void;
  burst: () => void;
}

interface HeroCanvasProps extends VaultSceneOptions {
  className?: string;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Mounts the Three.js VaultScene, lazy-loading three.js so first paint
 * never waits on WebGL. Pauses when off-screen or the tab is hidden, and
 * renders a single settled frame for reduced-motion users. Decorative:
 * all meaning is carried by the semantic HTML around it.
 */
export const HeroCanvas = forwardRef<HeroCanvasHandle, HeroCanvasProps>(function HeroCanvas(
  { className, ...opts },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<VaultScene | null>(null);
  const pendingProgress = useRef(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    setProgress: (p) => {
      pendingProgress.current = p;
      sceneRef.current?.setProgress(p);
      if (prefersReducedMotion()) sceneRef.current?.renderOnce();
    },
    burst: () => sceneRef.current?.burst(1.2),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!webglAvailable()) {
      setFailed(true);
      return;
    }
    let disposed = false;
    let scene: VaultScene | null = null;
    let visible = true;
    const reduced = prefersReducedMotion();
    const cleanups: Array<() => void> = [];

    import('../three/VaultScene')
      .then(({ VaultScene }) => {
        if (disposed) return;
        const narrow = window.innerWidth < 768;
        scene = new VaultScene(canvas, {
          coinCount: narrow ? 150 : 240,
          maxDpr: narrow ? 1.5 : 1.75,
          ...opts,
        });
        sceneRef.current = scene;
        scene.setProgress(pendingProgress.current);

        const sync = () => {
          if (!scene) return;
          if (reduced) {
            scene.renderOnce();
            return;
          }
          if (visible && !document.hidden) scene.start();
          else scene.stop();
        };

        const ro = new ResizeObserver(() => {
          scene?.resize();
          if (reduced) scene?.renderOnce();
        });
        ro.observe(canvas);
        cleanups.push(() => ro.disconnect());

        const io = new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true;
          sync();
        });
        io.observe(canvas);
        cleanups.push(() => io.disconnect());

        document.addEventListener('visibilitychange', sync);
        cleanups.push(() => document.removeEventListener('visibilitychange', sync));

        if (!reduced && opts.interactive !== false) {
          const onMove = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect();
            const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
            const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
            if (Math.abs(nx) <= 1.2 && Math.abs(ny) <= 1.2) scene?.setPointer(nx, ny);
            else scene?.clearPointer();
          };
          const onLeave = () => scene?.clearPointer();
          window.addEventListener('pointermove', onMove, { passive: true });
          document.documentElement.addEventListener('pointerleave', onLeave);
          cleanups.push(() => {
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
          });
        }

        sync();
        setReady(true);
      })
      .catch((err) => {
        console.error('3D scene failed to load:', err);
        setFailed(true);
      });

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      scene?.dispose();
      sceneRef.current = null;
    };
    // Scene options are fixed for the lifetime of the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className} aria-hidden="true">
      {/* Static fallback orb: shows while three.js loads and if WebGL is unavailable */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${ready && !failed ? 'opacity-0' : 'opacity-100'}`}
        style={{
          background:
            'radial-gradient(38% 42% at 64% 48%, rgba(132,125,255,0.5), transparent 70%), radial-gradient(26% 28% at 42% 64%, rgba(159,232,112,0.25), transparent 70%)',
          filter: 'blur(10px)',
        }}
      />
      {!failed && (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-1000 cursor-pointer ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
});
