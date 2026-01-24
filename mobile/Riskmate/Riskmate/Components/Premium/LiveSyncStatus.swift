import SwiftUI

/// Live sync status with pulsing green dot - makes reliability felt, not read
struct LiveSyncStatus: View {
    let isOnline: Bool
    let lastSync: Date?
    
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.6
    @Environment(\.scenePhase) private var scenePhase
    
    var body: some View {
        HStack(spacing: 6) {
            ZStack {
                // Pulsing background circle (only when online)
                if isOnline {
                    Circle()
                        .fill(Color.green.opacity(pulseOpacity))
                        .frame(width: 10, height: 10)
                        .scaleEffect(pulseScale)
                }
                
                // Solid dot
                Circle()
                    .fill(isOnline ? Color.green : Color.gray)
                    .frame(width: 8, height: 8)
            }
            
            Text(isOnline ? "Live" : "Offline")
                .font(RMSystemTheme.Typography.caption)
                .foregroundStyle(isOnline ? RMSystemTheme.Colors.success : RMSystemTheme.Colors.textTertiary)
        }
        .padding(.horizontal, RMSystemTheme.Spacing.sm)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(RMSystemTheme.Colors.tertiaryBackground.opacity(0.6))
        )
        .onAppear {
            if isOnline {
                startPulseAnimation()
            }
        }
        .onDisappear {
            stopPulseAnimation()
        }
        .onChange(of: isOnline) { oldValue, newValue in
            if newValue {
                startPulseAnimation()
            } else {
                stopPulseAnimation()
            }
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            // Stop animation when app backgrounds, restart when foregrounds
            if newPhase == .background || newPhase == .inactive {
                stopPulseAnimation()
            } else if newPhase == .active && isOnline {
                startPulseAnimation()
            }
        }
    }
    
    private func startPulseAnimation() {
        // Respect Reduce Motion - use fade instead of pulse
        if UIAccessibility.isReduceMotionEnabled {
            withAnimation(.linear(duration: 0.1)) {
                pulseScale = 1.0
                pulseOpacity = 0.6
            }
        } else {
            // Cancel any existing animation first
            withAnimation(.linear(duration: 0)) {
                pulseScale = 1.0
                pulseOpacity = 0.6
            }
            
            // Start new animation
            withAnimation(
                Animation.easeInOut(duration: 1.5)
                    .repeatForever(autoreverses: true)
            ) {
                pulseScale = 1.4
                pulseOpacity = 0.2
            }
        }
    }
    
    private func stopPulseAnimation() {
        // Stop animation by resetting to static state
        withAnimation(.linear(duration: 0.1)) {
            pulseScale = 1.0
            pulseOpacity = 0.6
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        LiveSyncStatus(isOnline: true, lastSync: Date())
        LiveSyncStatus(isOnline: false, lastSync: Date())
    }
    .padding()
    .background(Color.black)
}
