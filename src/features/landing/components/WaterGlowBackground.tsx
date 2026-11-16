import React, { useEffect, useRef } from 'react';

export interface WaterGlowBackgroundProps {
  className?: string;
  /** Custom damping factor: 0.98 (calm water) to 0.995 (longer ripples). Default: 0.988 */
  damping?: number;
  /** Ambient gentle raindrops when idle. Default: true */
  ambientRain?: boolean;
}

export interface WaterGlowBackgroundHandle {
  splash: (x: number, y: number, strength?: number) => void;
  perturb: (strength?: number) => void;
}

// ── WebGL Shaders ─────────────────────────────────────────────────────────────

const VS_QUAD = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Heightfield Wave Equation Simulation Fragment Shader
const FS_SIMULATION = `
precision highp float;

uniform sampler2D u_current;
uniform vec2 u_texel;
uniform vec2 u_aspect;
uniform float u_damping;

// Mouse wake interaction
uniform float u_mouse_active;
uniform vec2 u_mouse_pos;
uniform vec2 u_mouse_prev;
uniform float u_mouse_radius;
uniform float u_mouse_strength;

// Click splash interaction
uniform float u_click_active;
uniform vec2 u_click_pos;
uniform float u_click_radius;
uniform float u_click_strength;

// Scroll wave perturbation
uniform float u_scroll_active;
uniform float u_scroll_y;
uniform float u_scroll_strength;
uniform float u_scroll_phase;

// Ambient gentle raindrop
uniform float u_drop_active;
uniform vec2 u_drop_pos;
uniform float u_drop_radius;
uniform float u_drop_strength;

varying vec2 v_uv;

void main() {
  vec4 info = texture2D(u_current, v_uv);
  float h = info.r;
  float h_prev = info.g;

  // Cardinal neighbors
  float hL = texture2D(u_current, v_uv - vec2(u_texel.x, 0.0)).r;
  float hR = texture2D(u_current, v_uv + vec2(u_texel.x, 0.0)).r;
  float hB = texture2D(u_current, v_uv - vec2(0.0, u_texel.y)).r;
  float hT = texture2D(u_current, v_uv + vec2(0.0, u_texel.y)).r;

  // Diagonal neighbors (isotropy)
  float hBL = texture2D(u_current, v_uv + vec2(-u_texel.x, -u_texel.y)).r;
  float hBR = texture2D(u_current, v_uv + vec2( u_texel.x, -u_texel.y)).r;
  float hTL = texture2D(u_current, v_uv + vec2(-u_texel.x,  u_texel.y)).r;
  float hTR = texture2D(u_current, v_uv + vec2( u_texel.x,  u_texel.y)).r;

  // Discrete 2D wave equation with isotropic 9-point Laplacian averaging:
  float cardinals = hL + hR + hB + hT;
  float diagonals = hBL + hBR + hTL + hTR;
  float average = (cardinals * 0.65 + diagonals * 0.35) * 0.5;

  float h_next = (average - h_prev) * u_damping;

  // Gentle absorbing boundary at edges to prevent harsh reflective artifacts
  vec2 edgeDist = min(v_uv, 1.0 - v_uv);
  float borderDamp = smoothstep(0.0, 0.035, min(edgeDist.x, edgeDist.y));
  h_next *= borderDamp;

  // 1. Mouse drag wake disturbance along movement segment
  if (u_mouse_active > 0.5) {
    vec2 pa = (v_uv - u_mouse_prev) * u_aspect;
    vec2 ba = (u_mouse_pos - u_mouse_prev) * u_aspect;
    float lenBaSq = max(dot(ba, ba), 0.000001);
    float t = clamp(dot(pa, ba) / lenBaSq, 0.0, 1.0);
    float dist = length(pa - ba * t);
    float r = u_mouse_radius;
    if (dist < r * 2.5) {
      float w = exp(-dist * dist / (2.0 * r * r));
      h_next += u_mouse_strength * w;
    }
  }

  // 2. Click splash (hydrodynamic droplet crater + splash crown crest)
  if (u_click_active > 0.5) {
    vec2 diff = (v_uv - u_click_pos) * u_aspect;
    float dist = length(diff);
    float r = u_click_radius;
    if (dist < r * 3.5) {
      float crater = -exp(-dist * dist / (r * r * 0.35)) * 0.75;
      float crown = exp(-pow(dist - r * 1.1, 2.0) / (r * r * 0.22)) * 0.95;
      h_next += u_click_strength * (crater + crown);
    }
  }

  // 3. Scroll vertical fluid wave perturbation
  if (u_scroll_active > 0.5) {
    float dy = abs(v_uv.y - u_scroll_y);
    if (dy < 0.22) {
      float waveProfile = exp(-dy * dy / 0.008) * sin(v_uv.x * 20.0 + u_scroll_phase);
      h_next += u_scroll_strength * waveProfile;
    }
  }

  // 4. Ambient gentle raindrop
  if (u_drop_active > 0.5) {
    vec2 diff = (v_uv - u_drop_pos) * u_aspect;
    float dist = length(diff);
    float r = u_drop_radius;
    if (dist < r * 3.0) {
      float drop = sin(dist / r * 3.14159) * exp(-dist / (r * 1.15));
      h_next += u_drop_strength * drop;
    }
  }

  // Prevent numerical divergence
  h_next = clamp(h_next, -2.5, 2.5);

  gl_FragColor = vec4(h_next, h, 0.0, 1.0);
}
`;

// Optical Liquid Rendering Fragment Shader (Refraction, Caustics, Iridescence, Specular)
const FS_RENDER = `
precision highp float;

uniform sampler2D u_heights;
uniform vec2 u_texel;
uniform vec2 u_aspect;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse_glow;
uniform float u_mouse_hover;
uniform float u_normal_scale;

varying vec2 v_uv;

// Procedural deep water background evaluation with chromatic dispersion
vec3 evalBackground(vec2 uv) {
  // Base dark background (#0B0C0D)
  vec3 col = vec3(0.043, 0.047, 0.051);

  // Undulating deep water caustic orb 1 — Violet Iris (#847DFF)
  vec2 orb1 = vec2(0.5 + sin(u_time * 0.22) * 0.16, 0.55 + cos(u_time * 0.18) * 0.14);
  float d1 = length((uv - orb1) * u_aspect);
  float g1 = exp(-d1 * d1 / 0.16);
  col += vec3(0.518, 0.490, 1.0) * (g1 * 0.24);

  // Undulating caustic orb 2 — Electric Cyan (#38bdf8) & Lime Voltage (#9FE870)
  vec2 orb2 = vec2(0.62 + cos(u_time * 0.26) * 0.15, 0.6 + sin(u_time * 0.2) * 0.12);
  float d2 = length((uv - orb2) * u_aspect);
  float g2 = exp(-d2 * d2 / 0.12);
  col += vec3(0.220, 0.741, 0.973) * (g2 * 0.14);
  col += vec3(0.624, 0.910, 0.439) * (g2 * 0.05);

  // Cursor glowing spotlight (follows pointer with smooth inertia)
  if (u_mouse_hover > 0.01) {
    float dMouse = length((uv - u_mouse_glow) * u_aspect);
    float gMouse = exp(-dMouse * dMouse / 0.11) * u_mouse_hover;
    col += vec3(0.518, 0.490, 1.0) * (gMouse * 0.32);
    col += vec3(0.220, 0.741, 0.973) * (gMouse * 0.18);
    col += vec3(0.624, 0.910, 0.439) * (gMouse * 0.06);
  }

  // Radial vignette
  float vig = 1.0 - smoothstep(0.4, 1.3, length((uv - 0.5) * u_aspect));
  col *= (0.75 + 0.25 * vig);

  return col;
}

void main() {
  float h = texture2D(u_heights, v_uv).r;
  float hL = texture2D(u_heights, v_uv - vec2(u_texel.x, 0.0)).r;
  float hR = texture2D(u_heights, v_uv + vec2(u_texel.x, 0.0)).r;
  float hB = texture2D(u_heights, v_uv - vec2(0.0, u_texel.y)).r;
  float hT = texture2D(u_heights, v_uv + vec2(0.0, u_texel.y)).r;

  // Surface gradient & normal vector with aspect ratio correction
  vec2 grad = vec2(hR - hL, (hT - hB) * (u_aspect.y / u_aspect.x)) * u_normal_scale;
  vec3 normal = normalize(vec3(-grad.x, -grad.y, 1.0));

  // 1. Optical Refraction & Prismatic Chromatic Dispersion
  vec2 refractOffset = normal.xy * 0.038;
  vec2 uvR = v_uv + refractOffset * 1.07;
  vec2 uvG = v_uv + refractOffset * 1.00;
  vec2 uvB = v_uv + refractOffset * 0.93;

  float rChannel = evalBackground(uvR).r;
  float gChannel = evalBackground(uvG).g;
  float bChannel = evalBackground(uvB).b;
  vec3 waterColor = vec3(rChannel, gChannel, bChannel);

  // 2. Caustic light focusing (surface curvature / divergence of normal)
  float curvature = (hR + hL + hT + hB - 4.0 * h) * 48.0;
  float caustic = clamp(curvature, 0.0, 1.0);
  waterColor += vec3(0.68, 0.82, 1.0) * (caustic * 0.22);

  // 3. Iridescent Sheen on Wave Crests (#847DFF, #38bdf8, #9FE870, #D1C9FF)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float NdotV = max(dot(normal, viewDir), 0.0);
  float fresnel = pow(1.0 - NdotV, 3.0);

  float wavePhase = h * 16.0 + (normal.x + normal.y) * 2.2 + u_time * 0.45;
  vec3 iris = vec3(0.518, 0.490, 1.000);   // #847DFF
  vec3 cyan = vec3(0.220, 0.741, 0.973);   // #38bdf8
  vec3 lime = vec3(0.624, 0.910, 0.439);   // #9FE870

  vec3 irid = mix(iris, cyan, sin(wavePhase) * 0.5 + 0.5);
  irid = mix(irid, lime, clamp(sin(wavePhase * 1.35 + 1.1), 0.0, 1.0));

  float waveSlope = length(grad);
  float sheenIntensity = (fresnel * 0.75 + waveSlope * 0.55) * smoothstep(0.01, 0.16, abs(h) + waveSlope * 0.1);
  waterColor += irid * clamp(sheenIntensity, 0.0, 0.88);

  // 4. Specular Highlights from Spotlight & Overhead Studio Light
  // Cursor spotlight specular
  vec3 lightPos1 = vec3(u_mouse_glow.x, u_mouse_glow.y, 0.42);
  vec3 lightDir1 = normalize(vec3(lightPos1.xy - v_uv, lightPos1.z));
  vec3 halfDir1 = normalize(lightDir1 + viewDir);
  float spec1 = pow(max(dot(normal, halfDir1), 0.0), 36.0) * u_mouse_hover;

  // Overhead soft studio light
  vec3 lightDir2 = normalize(vec3(0.12, 0.65, 0.75));
  vec3 halfDir2 = normalize(lightDir2 + viewDir);
  float spec2 = pow(max(dot(normal, halfDir2), 0.0), 56.0);

  vec3 specular = vec3(1.0, 1.0, 1.0) * (spec1 * 0.95 + spec2 * 0.5);
  specular += iris * (spec1 * 0.35);

  vec3 finalColor = waterColor + specular;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ── WebGL Helpers ─────────────────────────────────────────────────────────────

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

interface FBOBundle {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
}

function createFBO(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  isWebGL2: boolean,
  hasFloat: boolean,
  size: number
): FBOBundle | null {
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!texture || !fbo) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);

  let internalFormat: number = gl.RGBA;
  let format: number = gl.RGBA;
  let type: number = gl.UNSIGNED_BYTE;

  if (isWebGL2 && hasFloat) {
    const gl2 = gl as WebGL2RenderingContext;
    internalFormat = gl2.RGBA16F;
    format = gl2.RGBA;
    type = gl2.HALF_FLOAT;
  } else if (!isWebGL2 && hasFloat) {
    const extHalf = gl.getExtension('OES_texture_half_float');
    if (extHalf) {
      type = (extHalf as { HALF_FLOAT_OES: number }).HALF_FLOAT_OES;
    }
  }

  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, size, size, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    // Fallback to RGBA8 unsigned byte
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, fbo };
}

// ── WaterGlowBackground Component ─────────────────────────────────────────────

export const WaterGlowBackground: React.FC<WaterGlowBackgroundProps> = ({
  className = '',
  damping = 0.988,
  ambientRain = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Attempt WebGL Initialization ─────────────────────────────────────────
    let gl: (WebGL2RenderingContext | WebGLRenderingContext) | null = null;
    let isWebGL2 = false;
    let hasFloat = false;

    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      }) as WebGL2RenderingContext | null;

      if (gl) {
        isWebGL2 = true;
        hasFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));
      } else {
        gl = (canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
        }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

        if (gl) {
          const ext1 = gl.getExtension('OES_texture_float');
          const ext2 = gl.getExtension('EXT_color_buffer_half_float');
          hasFloat = Boolean(ext1 || ext2);
        }
      }
    } catch {
      gl = null;
    }

    // ── Graceful Fallback if WebGL is unavailable ────────────────────────────
    if (!gl) {
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      let fallbackAnimId = 0;
      let width = 0;
      let height = 0;

      const resize2d = () => {
        const rect = container.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resize2d();
      window.addEventListener('resize', resize2d);

      let startTime = performance.now();
      const render2d = (now: number) => {
        fallbackAnimId = requestAnimationFrame(render2d);
        const t = (now - startTime) * 0.0004;
        ctx2d.clearRect(0, 0, width, height);

        const cx1 = width * (0.5 + Math.sin(t * 0.8) * 0.16);
        const cy1 = height * (0.55 + Math.cos(t * 0.6) * 0.14);
        const grad1 = ctx2d.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.min(width, height) * 0.48);
        grad1.addColorStop(0, 'rgba(132, 125, 255, 0.22)');
        grad1.addColorStop(0.5, 'rgba(132, 125, 255, 0.06)');
        grad1.addColorStop(1, 'rgba(11, 12, 13, 0)');
        ctx2d.fillStyle = grad1;
        ctx2d.fillRect(0, 0, width, height);

        const cx2 = width * (0.64 + Math.cos(t * 0.9) * 0.14);
        const cy2 = height * (0.62 + Math.sin(t * 0.7) * 0.12);
        const grad2 = ctx2d.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.min(width, height) * 0.38);
        grad2.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
        grad2.addColorStop(0.4, 'rgba(159, 232, 112, 0.07)');
        grad2.addColorStop(1, 'rgba(11, 12, 13, 0)');
        ctx2d.fillStyle = grad2;
        ctx2d.fillRect(0, 0, width, height);
      };

      fallbackAnimId = requestAnimationFrame(render2d);
      return () => {
        cancelAnimationFrame(fallbackAnimId);
        window.removeEventListener('resize', resize2d);
      };
    }

    // ── Setup WebGL Liquid Simulation ────────────────────────────────────────
    const SIM_RES = 384;
    const initialFboA = createFBO(gl, isWebGL2, hasFloat, SIM_RES);
    const initialFboB = createFBO(gl, isWebGL2, hasFloat, SIM_RES);

    if (!initialFboA || !initialFboB) return;

    let fboA: FBOBundle = initialFboA;
    let fboB: FBOBundle = initialFboB;

    const simProgram = createProgram(gl, VS_QUAD, FS_SIMULATION);
    const renderProgram = createProgram(gl, VS_QUAD, FS_RENDER);

    if (!simProgram || !renderProgram) return;

    // Fullscreen quad buffer
    const quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    // Simulation uniform locations
    const simUniforms = {
      u_current: gl.getUniformLocation(simProgram, 'u_current'),
      u_texel: gl.getUniformLocation(simProgram, 'u_texel'),
      u_aspect: gl.getUniformLocation(simProgram, 'u_aspect'),
      u_damping: gl.getUniformLocation(simProgram, 'u_damping'),
      u_mouse_active: gl.getUniformLocation(simProgram, 'u_mouse_active'),
      u_mouse_pos: gl.getUniformLocation(simProgram, 'u_mouse_pos'),
      u_mouse_prev: gl.getUniformLocation(simProgram, 'u_mouse_prev'),
      u_mouse_radius: gl.getUniformLocation(simProgram, 'u_mouse_radius'),
      u_mouse_strength: gl.getUniformLocation(simProgram, 'u_mouse_strength'),
      u_click_active: gl.getUniformLocation(simProgram, 'u_click_active'),
      u_click_pos: gl.getUniformLocation(simProgram, 'u_click_pos'),
      u_click_radius: gl.getUniformLocation(simProgram, 'u_click_radius'),
      u_click_strength: gl.getUniformLocation(simProgram, 'u_click_strength'),
      u_scroll_active: gl.getUniformLocation(simProgram, 'u_scroll_active'),
      u_scroll_y: gl.getUniformLocation(simProgram, 'u_scroll_y'),
      u_scroll_strength: gl.getUniformLocation(simProgram, 'u_scroll_strength'),
      u_scroll_phase: gl.getUniformLocation(simProgram, 'u_scroll_phase'),
      u_drop_active: gl.getUniformLocation(simProgram, 'u_drop_active'),
      u_drop_pos: gl.getUniformLocation(simProgram, 'u_drop_pos'),
      u_drop_radius: gl.getUniformLocation(simProgram, 'u_drop_radius'),
      u_drop_strength: gl.getUniformLocation(simProgram, 'u_drop_strength'),
    };

    // Render uniform locations
    const renderUniforms = {
      u_heights: gl.getUniformLocation(renderProgram, 'u_heights'),
      u_texel: gl.getUniformLocation(renderProgram, 'u_texel'),
      u_aspect: gl.getUniformLocation(renderProgram, 'u_aspect'),
      u_resolution: gl.getUniformLocation(renderProgram, 'u_resolution'),
      u_time: gl.getUniformLocation(renderProgram, 'u_time'),
      u_mouse_glow: gl.getUniformLocation(renderProgram, 'u_mouse_glow'),
      u_mouse_hover: gl.getUniformLocation(renderProgram, 'u_mouse_hover'),
      u_normal_scale: gl.getUniformLocation(renderProgram, 'u_normal_scale'),
    };

    // ── Interaction & State Tracking ─────────────────────────────────────────
    let animId = 0;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let aspectX = 1;
    let aspectY = 1;

    const mouse = {
      x: 0.5,
      y: 0.5,
      prevX: 0.5,
      prevY: 0.5,
      glowX: 0.5,
      glowY: 0.5,
      speed: 0,
      active: false,
      hoverWeight: 0,
    };

    const splash = {
      active: false,
      x: 0.5,
      y: 0.5,
      strength: 0,
      radius: 0.045,
    };

    const scrollState = {
      active: false,
      y: 0.5,
      strength: 0,
      phase: 0,
      lastScrollY: typeof window !== 'undefined' ? window.scrollY : 0,
      lastScrollTime: performance.now(),
    };

    const drop = {
      active: false,
      x: 0.5,
      y: 0.5,
      strength: 0,
      radius: 0.038,
      lastDropTime: performance.now(),
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width <= 0 || height <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      aspectX = width >= height ? width / height : 1.0;
      aspectY = height > width ? height / width : 1.0;
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

    // ── Pointer Handlers ─────────────────────────────────────────────────────
    const getContainerCoords = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const u = (clientX - rect.left) / rect.width;
      const v = 1.0 - (clientY - rect.top) / rect.height; // Invert for GL UV
      return { u, v, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
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

      const { u, v, inside } = getContainerCoords(clientX, clientY);

      if (inside) {
        if (!mouse.active) {
          mouse.prevX = u;
          mouse.prevY = v;
          mouse.glowX = u;
          mouse.glowY = v;
          mouse.active = true;
        }

        const dx = (u - mouse.prevX) * aspectX;
        const dy = (v - mouse.prevY) * aspectY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        mouse.speed = dist;

        mouse.x = u;
        mouse.y = v;
      } else {
        mouse.active = false;
      }
    };

    const triggerSplash = (u: number, v: number, intensity = 1.2) => {
      splash.active = true;
      splash.x = u;
      splash.y = v;
      splash.strength = intensity;
      splash.radius = 0.042 * Math.min(1.5, Math.max(0.7, intensity));

      // Hydrodynamic droplet rebound after-splash (65ms later)
      setTimeout(() => {
        if (!isVisible) return;
        splash.active = true;
        splash.x = u + (Math.random() - 0.5) * 0.01;
        splash.y = v + (Math.random() - 0.5) * 0.01;
        splash.strength = intensity * 0.65;
        splash.radius = 0.035;
      }, 65);
    };

    const handleClick = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
          clientX = touch.clientX;
          clientY = touch.clientY;
        }
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      const { u, v, inside } = getContainerCoords(clientX, clientY);
      if (inside) {
        triggerSplash(u, v, 1.45);
      }
    };

    // ── Scroll Fluid Wave Perturbations ──────────────────────────────────────
    const handleScroll = () => {
      if (!isVisible || reducedMotion) return;
      const now = performance.now();
      const dt = Math.max(1, now - scrollState.lastScrollTime);
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - scrollState.lastScrollY;
      const velocity = delta / dt;

      scrollState.lastScrollY = currentScrollY;
      scrollState.lastScrollTime = now;

      if (Math.abs(velocity) > 0.06) {
        scrollState.active = true;
        scrollState.y = delta > 0 ? 0.8 : 0.2; // Propagate in scroll direction
        scrollState.strength = Math.min(Math.abs(velocity) * 0.65, 0.5) * Math.sign(velocity);
        scrollState.phase += 0.45;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!isVisible || reducedMotion) return;
      const velocity = e.deltaY;
      if (Math.abs(velocity) > 12) {
        scrollState.active = true;
        scrollState.y = velocity > 0 ? 0.85 : 0.15;
        scrollState.strength = Math.min(Math.abs(velocity) * 0.003, 0.45) * Math.sign(velocity);
        scrollState.phase += 0.55;
      }
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    container.addEventListener('pointerdown', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    // ── Main Simulation & Render Loop ────────────────────────────────────────
    let startTime = performance.now();

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      if (!isVisible) return;

      const elapsed = (now - startTime) * 0.001;

      // Smooth cursor hover weight and glow lerp
      if (mouse.active) {
        mouse.hoverWeight += (1.0 - mouse.hoverWeight) * 0.08;
      } else {
        mouse.hoverWeight += (0.0 - mouse.hoverWeight) * 0.04;
      }
      mouse.glowX += (mouse.x - mouse.glowX) * 0.09;
      mouse.glowY += (mouse.y - mouse.glowY) * 0.09;

      // Idle ambient gentle raindrop
      if (ambientRain && !mouse.active && !reducedMotion) {
        if (now - drop.lastDropTime > 2400) {
          drop.lastDropTime = now;
          drop.active = true;
          drop.x = 0.2 + Math.random() * 0.6;
          drop.y = 0.2 + Math.random() * 0.6;
          drop.strength = 0.65 + Math.random() * 0.35;
          drop.radius = 0.035;
        }
      }

      // ── Step 1: Fluid Simulation Pass (ping-pong to fboB) ───────────────────
      if (!reducedMotion) {
        gl.useProgram(simProgram);

        // Bind source texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
        gl.uniform1i(simUniforms.u_current, 0);

        gl.uniform2f(simUniforms.u_texel, 1.0 / SIM_RES, 1.0 / SIM_RES);
        gl.uniform2f(simUniforms.u_aspect, aspectX, aspectY);
        gl.uniform1f(simUniforms.u_damping, damping);

        // Mouse wake injection
        const mouseMoved = mouse.active && mouse.speed > 0.002;
        gl.uniform1f(simUniforms.u_mouse_active, mouseMoved ? 1.0 : 0.0);
        gl.uniform2f(simUniforms.u_mouse_pos, mouse.x, mouse.y);
        gl.uniform2f(simUniforms.u_mouse_prev, mouse.prevX, mouse.prevY);
        gl.uniform1f(simUniforms.u_mouse_radius, 0.036);
        gl.uniform1f(simUniforms.u_mouse_strength, Math.min(0.65, 0.15 + mouse.speed * 4.5));

        // Click splash injection
        gl.uniform1f(simUniforms.u_click_active, splash.active ? 1.0 : 0.0);
        gl.uniform2f(simUniforms.u_click_pos, splash.x, splash.y);
        gl.uniform1f(simUniforms.u_click_radius, splash.radius);
        gl.uniform1f(simUniforms.u_click_strength, splash.strength);
        splash.active = false; // Consumed

        // Scroll wave perturbation injection
        gl.uniform1f(simUniforms.u_scroll_active, scrollState.active ? 1.0 : 0.0);
        gl.uniform1f(simUniforms.u_scroll_y, scrollState.y);
        gl.uniform1f(simUniforms.u_scroll_strength, scrollState.strength);
        gl.uniform1f(simUniforms.u_scroll_phase, scrollState.phase);
        scrollState.active = false; // Consumed

        // Ambient raindrop injection
        gl.uniform1f(simUniforms.u_drop_active, drop.active ? 1.0 : 0.0);
        gl.uniform2f(simUniforms.u_drop_pos, drop.x, drop.y);
        gl.uniform1f(simUniforms.u_drop_radius, drop.radius);
        gl.uniform1f(simUniforms.u_drop_strength, drop.strength);
        drop.active = false; // Consumed

        // Update previous mouse coordinates
        mouse.prevX = mouse.x;
        mouse.prevY = mouse.y;

        // Render simulation to FBO B
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
        gl.viewport(0, 0, SIM_RES, SIM_RES);

        const posAttrSim = gl.getAttribLocation(simProgram, 'a_position');
        gl.enableVertexAttribArray(posAttrSim);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
        gl.vertexAttribPointer(posAttrSim, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Swap ping-pong FBOs (fboB becomes source for render pass)
        const temp = fboA;
        fboA = fboB;
        fboB = temp;
      }

      // ── Step 2: Optical Liquid Render Pass (draw to screen) ────────────────
      gl.useProgram(renderProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
      gl.uniform1i(renderUniforms.u_heights, 0);

      gl.uniform2f(renderUniforms.u_texel, 1.0 / SIM_RES, 1.0 / SIM_RES);
      gl.uniform2f(renderUniforms.u_aspect, aspectX, aspectY);
      gl.uniform2f(renderUniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(renderUniforms.u_time, elapsed);
      gl.uniform2f(renderUniforms.u_mouse_glow, mouse.glowX, mouse.glowY);
      gl.uniform1f(renderUniforms.u_mouse_hover, mouse.hoverWeight);
      gl.uniform1f(renderUniforms.u_normal_scale, 14.0);

      const posAttrRender = gl.getAttribLocation(renderProgram, 'a_position');
      gl.enableVertexAttribArray(posAttrRender);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
      gl.vertexAttribPointer(posAttrRender, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    animId = requestAnimationFrame(render);

    // ── Teardown & Resource Cleanup ──────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      container.removeEventListener('pointerdown', handleClick);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
      observer.disconnect();

      if (gl) {
        if (fboA) {
          gl.deleteTexture(fboA.texture);
          gl.deleteFramebuffer(fboA.fbo);
        }
        if (fboB) {
          gl.deleteTexture(fboB.texture);
          gl.deleteFramebuffer(fboB.fbo);
        }
        if (simProgram) gl.deleteProgram(simProgram);
        if (renderProgram) gl.deleteProgram(renderProgram);
        if (quadVbo) gl.deleteBuffer(quadVbo);
      }
    };
  }, [damping, ambientRain]);

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