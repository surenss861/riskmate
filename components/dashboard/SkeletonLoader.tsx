'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface SkeletonLoaderProps {
  className?: string
  variant?: 'text' | 'card' | 'table-row' | 'circular' | 'rectangular'
  width?: string
  height?: string
  lines?: number
}

export function SkeletonLoader({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonLoaderProps) {
  const baseClasses = 'bg-white/5 rounded-lg animate-pulse'

  if (variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-4 ${baseClasses}`}
            style={{
              width: i === lines - 1 && lines > 1 ? '75%' : width || '100%',
            }}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <motion.div
        className={`${baseClasses} p-6 ${className}`}
        style={{ width, height: height || '200px' }}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="space-y-3">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="h-20 bg-white/10 rounded" />
        </div>
      </motion.div>
    )
  }

  if (variant === 'table-row') {
    return (
      <motion.div
        className={`${baseClasses} h-16 ${className}`}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-4 bg-white/10 rounded w-1/4" />
        </div>
      </motion.div>
    )
  }

  if (variant === 'circular') {
    return (
      <motion.div
        className={`${baseClasses} rounded-full ${className}`}
        style={{
          width: width || '40px',
          height: height || '40px',
        }}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    )
  }

  return (
    <motion.div
      className={`${baseClasses} ${className}`}
      style={{ width: width || '100%', height: height || '20px' }}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="relative mx-auto max-w-7xl px-6 py-14">
        {/* Hero Section Skeleton */}
        <div className="mb-12">
          <SkeletonLoader variant="card" height="180px" />
        </div>

        {/* KPI Grid Skeleton */}
        <div className="mb-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLoader key={i} variant="card" height="150px" />
          ))}
        </div>

        {/* Chart Skeleton */}
        <div className="mb-10">
          <SkeletonLoader variant="card" height="400px" />
        </div>

        {/* Jobs List Skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} variant="table-row" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function JobListSkeleton() {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonLoader key={i} variant="table-row" />
      ))}
    </div>
  )
}

