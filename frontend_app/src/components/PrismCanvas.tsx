// PrismCanvas — a tiny WebGL canvas that renders a refracting diamond/prism
// shape with slow ambient rotation and subtle color shifting. Designed to
// replace the static SVG prism mark on the StillFreshHero card.
//
// Zero dependencies — uses raw WebGL2 (falls back to invisible if unsupported).
// The entire shader is ~40 lines of GLSL. Canvas size is intentionally small
// (120x120 CSS px) to keep GPU cost negligible on mobile.

import { useRef, useEffect } from 'react';

const VERT = `#version 300 es
precision mediump float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;

// Signed distance to a rhombus (diamond shape)
float sdRhombus(vec2 p, vec2 b) {
  vec2 q = abs(p);
  float h = clamp((-2.0*q.x*b.x + q.y*b.y) / dot(b,b), -1.0, 1.0);
  float d = length(q - 0.5*b*vec2(1.0-h, 1.0+h));
  return d * sign(q.x*b.y + q.y*b.x - b.x*b.y);
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;

  // Slow rotation
  float a = u_time * 0.15;
  float c = cos(a), s = sin(a);
  p = mat2(c, -s, s, c) * p;

  // Two nested diamonds at different scales
  float d1 = sdRhombus(p, vec2(0.55, 0.85));
  float d2 = sdRhombus(p, vec2(0.35, 0.55));

  // Edge glow — warm copper shifting to champagne over time
  float edge1 = smoothstep(0.02, 0.0, abs(d1)) * 0.7;
  float edge2 = smoothstep(0.015, 0.0, abs(d2)) * 0.5;

  // Interior refraction — subtle color bands that shift
  float interior = smoothstep(0.0, -0.3, d1) * 0.12;
  float band = sin(d1 * 28.0 + u_time * 0.8) * 0.04 * smoothstep(0.0, -0.2, d1);

  // Color: copper base, champagne highlights
  vec3 copper = vec3(0.77, 0.57, 0.37);
  vec3 champagne = vec3(0.95, 0.89, 0.66);
  float shift = sin(u_time * 0.3) * 0.5 + 0.5;
  vec3 edgeColor = mix(copper, champagne, shift);

  vec3 col = edgeColor * (edge1 + edge2) + vec3(0.95, 0.90, 0.75) * (interior + band);
  float alpha = edge1 + edge2 + interior + abs(band);

  fragColor = vec4(col, clamp(alpha, 0.0, 0.55));
}`;

interface Props {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function PrismCanvas({ size = 120, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    function compileShader(src: string, type: number) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const vs = compileShader(VERT, gl.VERTEX_SHADER);
    const fs = compileShader(FRAG, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    gl.useProgram(prog);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const start = performance.now();

    function frame() {
      const t = (performance.now() - start) / 1000;
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1f(uTime, t);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(frame);
    }

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    />
  );
}
