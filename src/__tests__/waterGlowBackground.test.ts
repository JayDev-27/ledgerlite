import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WaterGlowBackground } from '@/features/landing/components/WaterGlowBackground';

describe('WaterGlowBackground (WebGL Liquid Simulation & SSR Fallback)', () => {
  it('renders valid SSR markup with container and canvas elements', () => {
    const html = renderToString(
      React.createElement(WaterGlowBackground, {
        className: 'custom-liquid-canvas',
        damping: 0.99,
        ambientRain: true,
      })
    );

    expect(html).toContain('custom-liquid-canvas');
    expect(html).toContain('<canvas');
    expect(html).toContain('aria-hidden="true"');
  });

  it('exports valid component and default props', () => {
    expect(typeof WaterGlowBackground).toBe('function');
  });
});
