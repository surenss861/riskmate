'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useRef, useMemo } from 'react'

function Particles() {
  const ref = useRef<THREE.Points>(null)
  
  const sphere = useMemo(() => {
    const points = []
    for (let i = 0; i < 4000; i++) {
      const r = 3 + Math.random() * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      points.push(r * Math.sin(phi) * Math.cos(theta))
      points.push(r * Math.sin(phi) * Math.sin(theta))
      points.push(r * Math.cos(phi))
    }
    return new Float32Array(points)
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.0015
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.15
    }
  })

  return (
    <Points ref={ref} positions={sphere} stride={3}>
      <PointMaterial
        size={0.03}
        transparent
        color="#00B4FF"
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </Points>
  )
}

export default function HeroScene() {
  return (
    <div className="fixed inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
        <Particles />
      </Canvas>
    </div>
  )
}

