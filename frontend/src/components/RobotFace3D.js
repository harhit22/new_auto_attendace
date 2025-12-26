import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Color } from 'three';
import FaceHeroImage from '../assets/humanoid_face.png';

// --- GLSL SHADERS ---
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform sampler2D uTexture;
varying vec2 vUv;

// Pseudo-random function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  
  // 1. Holographic Glitch / Waviness
  float glitchIntensity = 0.002;
  uv.x += (random(vec2(uv.y * 100.0, uTime)) - 0.5) * glitchIntensity * sin(uTime * 10.0);

  // Load Base Texture
  vec4 texColor = texture2D(uTexture, uv);
  
  // 2. Scan Beam (Top to Bottom)
  // Scan cycle: 3 seconds. mod(uTime, 3.0). 
  // We want it to move from y=1.2 to y=-0.2 to clear the image.
  float scanCycle = mod(uTime * 0.8, 3.0); 
  float scanPos = 1.2 - scanCycle; 
  
  float beamWidth = 0.08;
  // Calculate distance from current pixel y to scan position
  float dist = abs(uv.y - scanPos);
  
  // Gaussian-like glow for beam
  float beam = smoothstep(beamWidth, 0.0, dist);
  
  // 3. Digital Grid Overlay (Only reveals near the beam)
  float gridDensity = 40.0;
  float gridX = step(0.97, mod(uv.x * gridDensity, 1.0));
  float gridY = step(0.97, mod(uv.y * gridDensity, 1.0));
  float grid = max(gridX, gridY);
  
  // Overlay grid only where beam is strong
  float meshReveal = grid * beam * 2.0;
  
  // 4. Color Composition
  vec3 scanColor = vec3(0.0, 0.6, 1.0); // Cyan/Blue
  vec3 meshColor = vec3(1.0, 1.0, 1.0); // White
  
  vec3 finalColor = texColor.rgb;
  
  // Add Beam Glow
  finalColor += scanColor * beam * 0.6;
  
  // Add Mesh
  finalColor += meshColor * meshReveal;

  // 5. Tech Border / Scan Line Edge
  float lineEdge = smoothstep(0.01, 0.0, abs(uv.y - scanPos));
  finalColor += vec3(0.5, 0.8, 1.0) * lineEdge * 2.0; // Bright leading edge

  // 6. Alpha/Transparency handling (for PNG transparency)
  gl_FragColor = vec4(finalColor, texColor.a);
}
`;

const ScanPlane = () => {
    // Load texture
    const texture = useLoader(TextureLoader, FaceHeroImage);
    const materialRef = useRef();

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
        }
    });

    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uTexture: { value: texture },
        }),
        [texture]
    );

    return (
        <mesh position={[0, 0, 0]}>
            <planeGeometry args={[5, 6]} /> {/* Aspect ratio based on image approximately */}
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent={true}
            />
        </mesh>
    );
};

const RobotFace3D = () => {
    return (
        <div style={{ width: '100%', height: '500px' }}>
            <Canvas camera={{ position: [0, 0, 4] }}>
                <ambientLight intensity={0.5} />
                <ScanPlane />
            </Canvas>
        </div>
    );
};

export default RobotFace3D;
