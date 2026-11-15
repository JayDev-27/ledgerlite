import React, { useEffect, useRef } from 'react';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
  decay: number;
  color: string;
  ringCount: number;
}

export const WaterGlowBackground: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Smooth cursor tracking with fluid inertia
    const mouse = {
      x: -9999,
      y: -9999,
      prevX: -9999,
      prevY: -9999,
      glowX: -9999,
      glowY: -9999,
      isHovered: false,
      speed: 0,
    };

    const ripples: Ripple[] = [];
    const colorPalette = [
      'rgba(132, 125, 255, ', // Gallery Iris (#847DFF)
      'rgba(56, 189, 248, ',  // Electric Cyan (#38bdf8)
      'rgba(159, 232, 112, ', // Lime Voltage (#9FE870)
      'rgba(209, 201, 255, ', // Pale Iris (#D1C9FF)
    ];

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = Boolean(entry?.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const createRipple = (x: number, y: number, intensity = 1) => {
      const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)] || colorPalette[0] || 'rgba(132, 125, 255, ';
      ripples.push({
        x,
        y,
        radius: 8,
        maxRadius: Math.min(width, height) * 0.35 * intensity + 80,
        speed: 2.2 + Math.random() * 1.4,
        opacity: Math.min(0.65 * intensity, 0.85),
        decay: 0.007 + Math.random() * 0.004,
        color: randomColor,
        ringCount: intensity > 1.2 ? 3 : 2,
      });

      // Keep ripple array bounded for 60fps performance
      if (ripples.length > 28) {
        ripples.shift();
      }
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = container.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      const firstTouch = 'touches' in e && e.touches.length > 0 ? e.touches[0] : undefined;
      if (firstTouch) {
        clientX = firstTouch.clientX;
        clientY = firstTouch.clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (!mouse.isHovered) {
        mouse.x = x;
        mouse.y = y;
        mouse.glowX = x;
        mouse.glowY = y;
        mouse.prevX = x;
        mouse.prevY = y;
        mouse.isHovered = true;
        createRipple(x, y, 1.2);
        return;
      }

      mouse.x = x;
      mouse.y = y;

      const dx = mouse.x - mouse.prevX;
      const dy = mouse.y - mouse.prevY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      mouse.speed = dist;

      // Drop ripples when pointer moves across the liquid surface
      if (dist > 18) {
        createRipple(x, y, Math.min(1.4, 0.6 + dist * 0.02));
        mouse.prevX = mouse.x;
        mouse.prevY = mouse.y;
      }
    };

    const handlePointerLeave = () => {
      mouse.isHovered = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Splash burst on click
      createRipple(x, y, 1.8);
      setTimeout(() => createRipple(x, y, 1.3), 70);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    container.addEventListener('mouseleave', handlePointerLeave);
    container.addEventListener('click', handleClick);

    // Occasional gentle ambient raindrops to keep the surface alive when idle
    let lastAmbientTime = 0;
    const triggerAmbientDrop = (now: number) => {
      if (now - lastAmbientTime > 2600 && !mouse.isHovered && ripples.length < 5) {
        lastAmbientTime = now;
        const x = width * (0.2 + Math.random() * 0.6);
        const y = height * (0.2 + Math.random() * 0.6);
        createRipple(x, y, 0.9);
      }
    };

    let startTime = performance.now();

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      if (!isVisible) return;

      const elapsed = (now - startTime) * 0.001;
      triggerAmbientDrop(now);

      ctx.clearRect(0, 0, width, height);

      // ── 1. Ambient undulating deep water caustic orbs ──────────────────
      const t = elapsed * 0.4;
      const orb1X = width * (0.5 + Math.sin(t * 0.8) * 0.18);
      const orb1Y = height * (0.55 + Math.cos(t * 0.6) * 0.14);
      const orb1R = Math.min(width, height) * (0.42 + Math.sin(t * 1.2) * 0.05);

      const grad1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, orb1R);
      grad1.addColorStop(0, 'rgba(132, 125, 255, 0.18)');
      grad1.addColorStop(0.45, 'rgba(132, 125, 255, 0.07)');
      grad1.addColorStop(1, 'rgba(132, 125, 255, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = width * (0.62 + Math.cos(t * 0.9) * 0.16);
      const orb2Y = height * (0.68 + Math.sin(t * 0.7) * 0.12);
      const orb2R = Math.min(width, height) * (0.32 + Math.cos(t * 1.1) * 0.04);

      const grad2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, orb2R);
      grad2.addColorStop(0, 'rgba(159, 232, 112, 0.10)');
      grad2.addColorStop(0.5, 'rgba(56, 189, 248, 0.04)');
      grad2.addColorStop(1, 'rgba(159, 232, 112, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // ── 2. Fluid cursor glowing spotlight (follows mouse with inertia) ─
      if (mouse.glowX > -1000 && mouse.isHovered) {
        // Smooth lerp toward mouse
        mouse.glowX += (mouse.x - mouse.glowX) * 0.085;
        mouse.glowY += (mouse.y - mouse.glowY) * 0.085;

        const pulse = 1 + Math.sin(elapsed * 3) * 0.06;
        const spotRadius = Math.min(width, height) * 0.38 * pulse;

        const spotGrad = ctx.createRadialGradient(
          mouse.glowX,
          mouse.glowY,
          0,
          mouse.glowX,
          mouse.glowY,
          spotRadius
        );
        spotGrad.addColorStop(0, 'rgba(132, 125, 255, 0.22)');
        spotGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.12)');
        spotGrad.addColorStop(0.7, 'rgba(159, 232, 112, 0.03)');
        spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, width, height);
      }

      if (reducedMotion) return;

      // ── 3. Concentric water ripple waves ───────────────────────────────
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        if (!r) continue;

        r.radius += r.speed;
        r.opacity -= r.decay;

        if (r.opacity <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.lineWidth = 1.75;

        // Draw primary wave crest + trailing sub-ripples
        for (let ring = 0; ring < r.ringCount; ring++) {
          const ringOffset = ring * 14;
          const currentRadius = r.radius - ringOffset;
          if (currentRadius <= 0) continue;

          const ringAlpha = r.opacity * (1 - ring * 0.35);
          if (ringAlpha <= 0) continue;

          ctx.beginPath();
          ctx.arc(r.x, r.y, currentRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `${r.color}${ringAlpha.toFixed(3)})`;
          ctx.stroke();
        }

        // Soft luminous wave sheen fill inside the primary ripple
        if (r.radius < r.maxRadius * 0.6) {
          const innerSheen = ctx.createRadialGradient(
            r.x,
            r.y,
            Math.max(0, r.radius - 20),
            r.x,
            r.y,
            r.radius
          );
          innerSheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
          innerSheen.addColorStop(0.7, `${r.color}${(r.opacity * 0.14).toFixed(3)})`);
          innerSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = innerSheen;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);
      container.removeEventListener('click', handleClick);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-auto overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};
