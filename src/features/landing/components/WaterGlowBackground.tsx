import React, { useEffect, useRef } from 'react';

export interface WaterGlowBackgroundProps {
  className?: string;
  /** Custom damping factor: 0.975 (calm/viscous) to 0.990 (longer ripples). Default: 0.984 */
  damping?: number;
  /** Ambient gentle raindrops when idle. Default: false (strictly cursor-driven) */
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

// 2D Wave-Equation Heightfield Simulation (Ping-Pong FBO)
const FS_SIMULATION = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_current;
uniform vec2 u_texel;
uniform vec2 u_aspect_vec;
uniform float u_damping;

// Mouse continuous wake
uniform float u_mouse_active;
uniform vec2 u_prev_cursor;
uniform vec2 u_curr_cursor;
uniform float u_mouse_radius;
uniform float u_mouse_strength;

// Click / tap splash
uniform float u_splash_active;
uniform vec2 u_splash_pos;
uniform float u_splash_radius;
uniform float u_splash_strength;

// Ambient raindrop
uniform float u_ambient_active;
uniform vec2 u_ambient_pos;
uniform float u_ambient_radius;
uniform float u_ambient_strength;

void main() {
  vec4 info = texture2D(u_current, v_uv);
  float h = info.r;
  float h_prev = info.g;

  // Isotropic 9-point Laplacian stencil (cardinals + diagonals)
  float nL = texture2D(u_current, v_uv - vec2(u_texel.x, 0.0)).r;
  float nR = texture2D(u_current, v_uv + vec2(u_texel.x, 0.0)).r;
  float nB = texture2D(u_current, v_uv - vec2(0.0, u_texel.y)).r;
  float nT = texture2D(u_current, v_uv + vec2(0.0, u_texel.y)).r;

  float nTL = texture2D(u_current, v_uv + vec2(-u_texel.x,  u_texel.y)).r;
  float nTR = texture2D(u_current, v_uv + vec2( u_texel.x,  u_texel.y)).r;
  float nBL = texture2D(u_current, v_uv + vec2(-u_texel.x, -u_texel.y)).r;
  float nBR = texture2D(u_current, v_uv + vec2( u_texel.x, -u_texel.y)).r;

  float sumNeighbors = (nL + nR + nB + nT) * 0.70710678 + (nTL + nTR + nBL + nBR) * 0.5;
  float avg = sumNeighbors / (4.0 * 0.70710678 + 4.0 * 0.5);

  // Discrete wave propagation with viscous damping
  float newH = (2.0 * avg - h_prev) * u_damping;

  // Absorbing boundary damping at edges
  float edgeDist = min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y));
  float edgeDecay = smoothstep(0.0, 0.04, edgeDist);
  newH *= (0.92 + 0.08 * edgeDecay);

  // 1. Cursor Wake Impulse (distance to continuous line segment connecting prev to curr mouse)
  if (u_mouse_active > 0.5) {
    vec2 pa = (v_uv - u_prev_cursor) * u_aspect_vec;
    vec2 ba = (u_curr_cursor - u_prev_cursor) * u_aspect_vec;
    float lenBaSq = dot(ba, ba);
    float t = clamp(dot(pa, ba) / max(lenBaSq, 0.0000001), 0.0, 1.0);
    float d = length(pa - ba * t);

    float wake = exp(-d * d / (2.0 * u_mouse_radius * u_mouse_radius * 0.65));
    newH += wake * u_mouse_strength;
  }

  // 2. Click / Tap Splash (crater depression + surrounding crown crest)
  if (u_splash_active > 0.5) {
    vec2 dP = (v_uv - u_splash_pos) * u_aspect_vec;
    float r = length(dP);
    float rNorm = r / max(u_splash_radius, 0.001);
    float splashShape = (1.0 - rNorm * rNorm) * exp(-rNorm * rNorm * 0.85);
    newH += splashShape * u_splash_strength;
  }

  // 3. Ambient Idle Drop
  if (u_ambient_active > 0.5) {
    vec2 dP = (v_uv - u_ambient_pos) * u_aspect_vec;
    float r = length(dP);
    float rNorm = r / max(u_ambient_radius, 0.001);
    float dropShape = exp(-rNorm * rNorm * 1.5);
    newH += dropShape * u_ambient_strength;
  }

  // Stability clamp
  newH = clamp(newH, -2.5, 2.5);

  // Store new height in R, current height in G
  gl_FragColor = vec4(newH, h, 0.0, 1.0);
}
`;

// Optical Liquid Refraction & Deep Obsidian Studio Shading
const FS_RENDER = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_waterMap;
uniform vec2 u_texel;
uniform vec2 u_aspect_vec;
uniform vec2 u_cursor;
uniform float u_time;
uniform float u_mouse_hover;

uniform float u_refractionStrength;
uniform float u_chromaticAberration;
uniform float u_specularShininess;
uniform float u_specularStrength;
uniform float u_fresnelSheen;

// Calm luxury studio background evaluation
vec3 evalBackground(vec2 uv) {
  // Deep dark obsidian base (#07080a)
  vec3 col = vec3(0.027, 0.031, 0.039);

  // Soft atmospheric indigo & cyan ambient clouds
  vec2 orb1 = vec2(0.40 + sin(u_time * 0.15) * 0.08, 0.50 + cos(u_time * 0.12) * 0.08);
  float d1 = length((uv - orb1) * u_aspect_vec);
  float g1 = exp(-d1 * d1 / 0.18);
  col += vec3(0.31, 0.27, 0.90) * (g1 * 0.18); // Indigo #4f46e5

  vec2 orb2 = vec2(0.68 + cos(u_time * 0.18) * 0.07, 0.55 + sin(u_time * 0.14) * 0.07);
  float d2 = length((uv - orb2) * u_aspect_vec);
  float g2 = exp(-d2 * d2 / 0.14);
  col += vec3(0.22, 0.74, 0.97) * (g2 * 0.12); // Cyan #38bdf8

  // Dynamic cursor spotlight (glow follows mouse smoothly)
  if (u_mouse_hover > 0.01) {
    float dMouse = length((uv - u_cursor) * u_aspect_vec);
    float gMouse = exp(-dMouse * dMouse / 0.09) * u_mouse_hover;
    col += vec3(0.52, 0.49, 1.0) * (gMouse * 0.22);
    col += vec3(0.22, 0.74, 0.97) * (gMouse * 0.10);
  }

  // Soft vignette
  float vig = 1.0 - smoothstep(0.35, 1.15, length((uv - 0.5) * u_aspect_vec));
  col *= (0.72 + 0.28 * vig);

  return col;
}

void main() {
  // Spatial derivative normals (central differences)
  float hL = texture2D(u_waterMap, v_uv - vec2(u_texel.x, 0.0)).r;
  float hR = texture2D(u_waterMap, v_uv + vec2(u_texel.x, 0.0)).r;
  float hB = texture2D(u_waterMap, v_uv - vec2(0.0, u_texel.y)).r;
  float hT = texture2D(u_waterMap, v_uv + vec2(0.0, u_texel.y)).r;
  float currentHeight = texture2D(u_waterMap, v_uv).r;

  float dx = (hR - hL) * 2.2;
  float dy = (hT - hB) * 2.2;

  // Surface gradient with aspect ratio correction
  vec2 gradient = vec2(-dx * u_aspect_vec.x, -dy * u_aspect_vec.y);
  vec3 normal = normalize(vec3(gradient, 0.052 / max(u_refractionStrength, 0.01)));

  // Refraction displacement with subtle chromatic dispersion
  vec2 refractOffset = -normal.xy * (0.045 * u_refractionStrength);
  vec2 uvR = clamp(v_uv + refractOffset * (1.0 - u_chromaticAberration), 0.001, 0.999);
  vec2 uvG = clamp(v_uv + refractOffset, 0.001, 0.999);
  vec2 uvB = clamp(v_uv + refractOffset * (1.0 + u_chromaticAberration), 0.001, 0.999);

  float r = evalBackground(uvR).r;
  float g = evalBackground(uvG).g;
  float b = evalBackground(uvB).b;
  vec3 color = vec3(r, g, b);

  // Lighting & Viscous Specular Highlights
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // 1. Key directional light from upper left
  vec3 lightDir1 = normalize(vec3(-0.4, 0.65, 0.75));
  vec3 half1 = normalize(lightDir1 + viewDir);
  float spec1 = pow(max(dot(normal, half1), 0.0), u_specularShininess);

  // 2. Cursor spotlight following the pointer
  vec3 lightDir2 = normalize(vec3((u_cursor.x - 0.5) * u_aspect_vec.x * 1.5, (u_cursor.y - 0.5) * 1.5, 0.6));
  vec3 half2 = normalize(lightDir2 + viewDir);
  float spec2 = pow(max(dot(normal, half2), 0.0), u_specularShininess * 0.85) * u_mouse_hover;

  float totalSpec = (spec1 * 0.72 + spec2 * 0.55) * u_specularStrength;

  // Fresnel rim reflection at grazing angles
  float NdotV = max(dot(normal, viewDir), 0.0);
  float fresnel = pow(1.0 - NdotV, 3.5) * u_fresnelSheen;

  vec3 specularColor = vec3(1.0, 1.0, 1.0) * totalSpec;
  vec3 sheenColor = vec3(0.65, 0.80, 1.0) * fresnel;
  float caustic = max(0.0, currentHeight) * 0.12;

  color += specularColor + sheenColor + vec3(caustic);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── WebGL Helpers ─────────────────────────────────────────────────────────────

function createShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
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

function createProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
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
  damping = 0.984,
  ambientRain = false,
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
            const ext1 = gl.getExtension('OES_texture_half_float');
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

        const startTime = performance.now();
        const render2d = (now: number) => {
          fallbackAnimId = requestAnimationFrame(render2d);
          const t = (now - startTime) * 0.0004;
          ctx2d.clearRect(0, 0, width, height);

          // Dark obsidian background
          ctx2d.fillStyle = '#07080a';
          ctx2d.fillRect(0, 0, width, height);

          // Subtle ambient glow
          const cx1 = width * (0.42 + Math.sin(t * 0.8) * 0.08);
          const cy1 = height * (0.50 + Math.cos(t * 0.6) * 0.08);
          const grad1 = ctx2d.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.min(width, height) * 0.45);
          grad1.addColorStop(0, 'rgba(79, 70, 229, 0.16)');
          grad1.addColorStop(0.6, 'rgba(79, 70, 229, 0.03)');
          grad1.addColorStop(1, 'rgba(7, 8, 10, 0)');
          ctx2d.fillStyle = grad1;
          ctx2d.fillRect(0, 0, width, height);

          const cx2 = width * (0.68 + Math.cos(t * 0.9) * 0.07);
          const cy2 = height * (0.55 + Math.sin(t * 0.7) * 0.07);
          const grad2 = ctx2d.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.min(width, height) * 0.38);
          grad2.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
          grad2.addColorStop(0.5, 'rgba(56, 189, 248, 0.02)');
          grad2.addColorStop(1, 'rgba(7, 8, 10, 0)');
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

      // Clear FBOs initially
      [fboA, fboB].forEach((f) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        gl.viewport(0, 0, SIM_RES, SIM_RES);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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
        u_aspect_vec: gl.getUniformLocation(simProgram, 'u_aspect_vec'),
        u_damping: gl.getUniformLocation(simProgram, 'u_damping'),
        u_mouse_active: gl.getUniformLocation(simProgram, 'u_mouse_active'),
        u_prev_cursor: gl.getUniformLocation(simProgram, 'u_prev_cursor'),
        u_curr_cursor: gl.getUniformLocation(simProgram, 'u_curr_cursor'),
        u_mouse_radius: gl.getUniformLocation(simProgram, 'u_mouse_radius'),
        u_mouse_strength: gl.getUniformLocation(simProgram, 'u_mouse_strength'),
        u_splash_active: gl.getUniformLocation(simProgram, 'u_splash_active'),
        u_splash_pos: gl.getUniformLocation(simProgram, 'u_splash_pos'),
        u_splash_radius: gl.getUniformLocation(simProgram, 'u_splash_radius'),
        u_splash_strength: gl.getUniformLocation(simProgram, 'u_splash_strength'),
        u_ambient_active: gl.getUniformLocation(simProgram, 'u_ambient_active'),
        u_ambient_pos: gl.getUniformLocation(simProgram, 'u_ambient_pos'),
        u_ambient_radius: gl.getUniformLocation(simProgram, 'u_ambient_radius'),
        u_ambient_strength: gl.getUniformLocation(simProgram, 'u_ambient_strength'),
      };

      // Render uniform locations
      const renderUniforms = {
        u_waterMap: gl.getUniformLocation(renderProgram, 'u_waterMap'),
        u_texel: gl.getUniformLocation(renderProgram, 'u_texel'),
        u_aspect_vec: gl.getUniformLocation(renderProgram, 'u_aspect_vec'),
        u_cursor: gl.getUniformLocation(renderProgram, 'u_cursor'),
        u_time: gl.getUniformLocation(renderProgram, 'u_time'),
        u_mouse_hover: gl.getUniformLocation(renderProgram, 'u_mouse_hover'),
        u_refractionStrength: gl.getUniformLocation(renderProgram, 'u_refractionStrength'),
        u_chromaticAberration: gl.getUniformLocation(renderProgram, 'u_chromaticAberration'),
        u_specularShininess: gl.getUniformLocation(renderProgram, 'u_specularShininess'),
        u_specularStrength: gl.getUniformLocation(renderProgram, 'u_specularStrength'),
        u_fresnelSheen: gl.getUniformLocation(renderProgram, 'u_fresnelSheen'),
      };

      // ── Interaction & State Tracking ─────────────────────────────────────────
      let animId = 0;
      let isVisible = true;
      let aspectX = 1.0;
      let aspectY = 1.0;

      const mouse = {
        current: { x: 0.5, y: 0.5 },
        target: { x: 0.5, y: 0.5 },
        prev: { x: 0.5, y: 0.5 },
        speed: 0,
        active: false,
        isMoving: false,
        hoverWeight: 0,
      };

      const splash = {
        active: false,
        x: 0.5,
        y: 0.5,
        strength: 0,
        radius: 0.055,
      };

      let lastAmbientDrop = performance.now();

      const resize = () => {
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        if (width <= 0 || height <= 0) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const aspect = width / height;
        if (aspect >= 1.0) {
          aspectX = aspect;
          aspectY = 1.0;
        } else {
          aspectX = 1.0;
          aspectY = 1.0 / aspect;
        }
      };

      resize();
      window.addEventListener('resize', resize, { passive: true });

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
        const v = 1.0 - (clientY - rect.top) / rect.height; // Invert for WebGL Y
        return { u, v, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
      };

      const triggerSplash = (u: number, v: number, intensity = 0.95) => {
        splash.active = true;
        splash.x = u;
        splash.y = v;
        splash.strength = intensity;
        splash.radius = 0.065;

        mouse.target.x = u;
        mouse.target.y = v;
        mouse.current.x = u;
        mouse.current.y = v;
        mouse.prev.x = u;
        mouse.prev.y = v;
        mouse.active = true;
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
            mouse.current.x = u;
            mouse.current.y = v;
            mouse.prev.x = u;
            mouse.prev.y = v;
            mouse.target.x = u;
            mouse.target.y = v;
            mouse.active = true;
          } else {
            mouse.target.x = u;
            mouse.target.y = v;
          }
        } else {
          mouse.active = false;
        }
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
          triggerSplash(u, v, 0.95);
        }
      };

      const handlePointerLeave = () => {
        mouse.active = false;
        mouse.isMoving = false;
      };

      window.addEventListener('mousemove', handlePointerMove, { passive: true });
      window.addEventListener('touchmove', handlePointerMove, { passive: true });
      container.addEventListener('pointerdown', handleClick);
      container.addEventListener('pointerleave', handlePointerLeave);

      // ── Main Simulation & Render Loop ────────────────────────────────────────
      const startTime = performance.now();

      const render = (now: number) => {
        animId = requestAnimationFrame(render);
        if (!isVisible) return;

        const elapsed = (now - startTime) * 0.001;

        // Smooth cursor hover weight and lerp
        if (mouse.active) {
          mouse.hoverWeight += (1.0 - mouse.hoverWeight) * 0.12;

          mouse.prev.x = mouse.current.x;
          mouse.prev.y = mouse.current.y;

          mouse.current.x += (mouse.target.x - mouse.current.x) * 0.32;
          mouse.current.y += (mouse.target.y - mouse.current.y) * 0.32;

          const dx = (mouse.current.x - mouse.prev.x) * aspectX;
          const dy = (mouse.current.y - mouse.prev.y) * aspectY;
          mouse.speed = Math.hypot(dx, dy);
          mouse.isMoving = mouse.speed > 0.0006;
        } else {
          mouse.hoverWeight += (0.0 - mouse.hoverWeight) * 0.05;
          mouse.isMoving = false;
          mouse.speed = 0;
        }

        // Ambient idle drop
        let ambientActive = false;
        let ambientX = 0.5;
        let ambientY = 0.5;

        if (ambientRain && !mouse.active && !reducedMotion) {
          if (now - lastAmbientDrop > 2200) {
            lastAmbientDrop = now;
            ambientActive = true;
            ambientX = 0.2 + Math.random() * 0.6;
            ambientY = 0.2 + Math.random() * 0.6;
          }
        }

        // ── Pass 1: Fluid Simulation Pass (ping-pong to fboB) ───────────────────
        if (!reducedMotion) {
          gl.useProgram(simProgram);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
          gl.uniform1i(simUniforms.u_current, 0);

          gl.uniform2f(simUniforms.u_texel, 1.0 / SIM_RES, 1.0 / SIM_RES);
          gl.uniform2f(simUniforms.u_aspect_vec, aspectX, aspectY);
          gl.uniform1f(simUniforms.u_damping, damping);

          // Mouse wake injection
          gl.uniform1f(simUniforms.u_mouse_active, mouse.isMoving ? 1.0 : 0.0);
          gl.uniform2f(simUniforms.u_prev_cursor, mouse.prev.x, mouse.prev.y);
          gl.uniform2f(simUniforms.u_curr_cursor, mouse.current.x, mouse.current.y);
          gl.uniform1f(simUniforms.u_mouse_radius, 0.038);
          gl.uniform1f(simUniforms.u_mouse_strength, Math.min(0.65, 0.12 + mouse.speed * 6.0));

          // Click splash injection
          gl.uniform1f(simUniforms.u_splash_active, splash.active ? 1.0 : 0.0);
          gl.uniform2f(simUniforms.u_splash_pos, splash.x, splash.y);
          gl.uniform1f(simUniforms.u_splash_radius, splash.radius);
          gl.uniform1f(simUniforms.u_splash_strength, splash.strength);
          splash.active = false; // Consumed

          // Ambient raindrop injection
          gl.uniform1f(simUniforms.u_ambient_active, ambientActive ? 1.0 : 0.0);
          gl.uniform2f(simUniforms.u_ambient_pos, ambientX, ambientY);
          gl.uniform1f(simUniforms.u_ambient_radius, 0.030);
          gl.uniform1f(simUniforms.u_ambient_strength, 0.40);

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

        // ── Pass 2: Optical Liquid Render Pass (draw to screen) ────────────────
        gl.useProgram(renderProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
        gl.uniform1i(renderUniforms.u_waterMap, 0);

        gl.uniform2f(renderUniforms.u_texel, 1.0 / SIM_RES, 1.0 / SIM_RES);
        gl.uniform2f(renderUniforms.u_aspect_vec, aspectX, aspectY);
        gl.uniform2f(renderUniforms.u_cursor, mouse.current.x, mouse.current.y);
        gl.uniform1f(renderUniforms.u_time, elapsed);
        gl.uniform1f(renderUniforms.u_mouse_hover, mouse.hoverWeight);

        gl.uniform1f(renderUniforms.u_refractionStrength, 0.85);
        gl.uniform1f(renderUniforms.u_chromaticAberration, 0.035);
        gl.uniform1f(renderUniforms.u_specularShininess, 40.0);
        gl.uniform1f(renderUniforms.u_specularStrength, 0.55);
        gl.uniform1f(renderUniforms.u_fresnelSheen, 0.32);

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
        container.removeEventListener('pointerleave', handlePointerLeave);
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
