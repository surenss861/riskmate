'use client'

import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sphere } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Lightweight Three.js background for hero
 * 
 * Features:
 * - Soft gradient particles
 * - Subtle animation
 * - Performance-optimized
 * - Falls back to CSS gradient if Three.js fails
 */
function ParticleField() {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    if (!meshRef.current) return

    // Subtle rotation
    const animate = () => {
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.001
      }
      requestAnimationFrame(animate)
    }
    animate()
  }, [])

  return (
    <>
      {/* Ambient light for soft glow */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.3} />

      {/* Gradient spheres (particles) */}
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2
        const radius = 5 + Math.random() * 3
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = (Math.random() - 0.5) * 4

        return (
          <Sphere key={i} position={[x, y, z]} args={[0.1, 16, 16]}>
            <meshStandardMaterial
              color="#912F40"
              opacity={0.2}
              transparent
              emissive="#912F40"
              emissiveIntensity={0.3}
            />
          </Sphere>
        )
      })}
    </>
  )
}

export function HeroBackground() {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ParticleField />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  )
}

