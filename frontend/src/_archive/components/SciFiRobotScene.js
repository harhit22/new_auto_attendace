import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, Color, Vector3 } from 'three';
import { OrbitControls, Stars, Float, PerspectiveCamera } from '@react-three/drei';
import FaceHeroImage from '../assets/sleek_robot.png';

// --- CLEAN HOLOGRAPHIC ROBOT (No Ugly Displacement) ---
const RobotHeadv2 = () => {
    const texture = useLoader(TextureLoader, FaceHeroImage);
    const meshRef = useRef();

    // Instead of vertex displacement (which tears the mesh), 
    // we use the texture as a bump map for surface detail only.
    // The "3D" feel comes from the Perspective Camera + Rotation.

    useFrame((state) => {
        const { mouse } = state;
        const t = state.clock.getElapsedTime();

        // Smooth Mouse Parallax (Tilting the card)
        // Lerp rotation for smoothness
        const targetRotX = (mouse.y * 0.5);
        const targetRotY = (mouse.x * 0.5);

        meshRef.current.rotation.x += (targetRotX - meshRef.current.rotation.x) * 0.1;
        meshRef.current.rotation.y += (targetRotY - meshRef.current.rotation.y) * 0.1;

        // Gentle float
        meshRef.current.position.y = Math.sin(t * 1) * 0.1;
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 0]}>
            <planeGeometry args={[5, 5]} /> {/* Standard Plane - Clean Edges */}
            <meshStandardMaterial
                map={texture}
                // Use texture as bump map for surface detail, but keep geometry flat
                bumpMap={texture}
                bumpScale={0.02}    // Very subtle surface detail

                // Holographic Material Settings
                color="#ffffff"
                emissive="#60a5fa"
                emissiveIntensity={0.1}
                emissiveMap={texture}

                metalness={0.9}
                roughness={0.2}
                transparent={true}
                opacity={1}         // Full visibility
                alphaTest={0.5}     // Sharp cutout
            />
        </mesh>
    );
};

// --- SCANNING LASER BEAM (Visual Only) ---
const ScanningBeam = () => {
    const laserRef = useRef();
    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        // Move beam up and down
        laserRef.current.position.y = Math.sin(t * 0.8) * 2.2;
    });

    return (
        <mesh ref={laserRef} rotation={[0, 0, 0]}>
            <planeGeometry args={[6, 0.05]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.8} />
            <pointLight distance={4} intensity={2} color="#00ffff" />
        </mesh>
    );
}

const SciFiRobotScene = () => {
    return (
        <div style={{ width: '100%', height: '100%', minHeight: '400px', background: 'transparent' }}>
            <Canvas gl={{ alpha: true }}>
                <PerspectiveCamera makeDefault position={[0, 0, 5]} />

                {/* 1. Cinematic Lighting (Crucial for 2.5D look) */}
                <ambientLight intensity={0.5} color="#1e1b4b" />

                {/* Dynamic Blue/Purple Lights that reflect off the bump map */}
                <pointLight position={[5, 2, 5]} intensity={2} color="#60a5fa" distance={10} />
                <pointLight position={[-5, -2, 5]} intensity={2} color="#c084fc" distance={10} />

                {/* 2. The Clean Robot Head */}
                <RobotHeadv2 />

                {/* 3. The Scanner */}
                <ScanningBeam />

                {/* 4. Background Elements */}
                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade />
            </Canvas>
        </div>
    );
};

export default SciFiRobotScene;
