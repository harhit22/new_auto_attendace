import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, AdditiveBlending } from 'three';
import { OrbitControls, Stars, Float } from '@react-three/drei';
import FaceHeroImage from '../assets/humanoid_face.png';

// --- SHADER: DISPLACEMENT PARTICLES ---
// Transforms a flat image into a 3D terrain/face based on brightness
const particleVertexShader = `
uniform sampler2D uTexture;
uniform float uTime;
varying vec3 vColor;
varying vec2 vUv;

void main() {
  vUv = uv;
  
  // Sample texture for color and depth
  vec4 texColor = texture2D(uTexture, uv);
  
  // Calculate brightness for Z-displacement
  float brightness = (texColor.r + texColor.g + texColor.b) / 3.0;
  
  // Dynamic movement: Breathe effect
  float breathe = sin(uTime * 0.5) * 0.1;
  
  // Displace Z based on brightness
  vec3 pos = position;
  pos.z += brightness * 2.0 + breathe; // Extrude bright parts (face)
  
  // Wave ripple effect
  pos.x += sin(pos.y * 4.0 + uTime) * 0.05;

  vColor = texColor.rgb; // Pass color to fragment
  
  // Point size depends on depth (closer = bigger)
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = (4.0 * brightness + 2.0) * (10.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const particleFragmentShader = `
varying vec3 vColor;

void main() {
  // Circular particles
  float r = distance(gl_PointCoord, vec2(0.5));
  if (r > 0.5) discard;
  
  // Glow center
  float glow = 1.0 - (r * 2.0);
  glow = pow(glow, 1.5);

  // Tint particles to Cyan/Purple tech palette
  vec3 techColor = mix(vec3(0.2, 0.6, 1.0), vec3(0.6, 0.3, 1.0), vColor.r);
  
  gl_FragColor = vec4(techColor, glow); // Additive blending handles transparency
}
`;

const ParticleFace = () => {
    const texture = useLoader(TextureLoader, FaceHeroImage);
    const materialRef = useRef();
    const pointsRef = useRef();

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
        }
        // Subtle rotation
        if (pointsRef.current) {
            pointsRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.2;
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
        <points ref={pointsRef} position={[0, 0, 0]}>
            <planeGeometry args={[6, 7, 128, 128]} /> {/* High segment count for dense particles */}
            <shaderMaterial
                ref={materialRef}
                vertexShader={particleVertexShader}
                fragmentShader={particleFragmentShader}
                uniforms={uniforms}
                transparent={true}
                blending={AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
};

// --- DATA RINGS ---
const DataRing = ({ radius, speed, color, rotation }) => {
    const ringRef = useRef();
    useFrame((state) => {
        ringRef.current.rotation.z += speed * 0.01;
        ringRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * speed) * 0.2;
    });

    return (
        <mesh ref={ringRef} rotation={rotation}>
            <torusGeometry args={[radius, 0.02, 16, 100]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
        </mesh>
    );
};

const HolographicFace3D = () => {
    return (
        <div style={{ width: '100%', height: '700px', background: 'radial-gradient(circle at center, #1e1b4b 0%, #000 100%)' }}>
            <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
                {/* 1. The Starfield Background (Fills density) */}
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                {/* 2. Floating Elements */}
                <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>

                    {/* The Main Particle Face */}
                    <ParticleFace />

                    {/* Surrounding Tech Rings */}
                    <DataRing radius={3.5} speed={0.5} color="#60a5fa" rotation={[Math.PI / 3, 0, 0]} />
                    <DataRing radius={4.2} speed={-0.3} color="#a78bfa" rotation={[-Math.PI / 4, 0, 0]} />

                </Float>

                {/* 3. Controls for interactivity */}
                <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.5} minPolarAngle={Math.PI / 2.5} />
            </Canvas>
        </div>
    );
};

export default HolographicFace3D;
