import SwiftUI

/// Timestamp that ticks once on open - "Anchored X seconds ago" updates
/// Stops timer when view disappears or app backgrounds
struct TickingTimestamp: View {
    let date: Date
    @State private var currentTime = Date()
    @State private var timer: Timer?
    @Environment(\.scenePhase) private var scenePhase
    
    var body: some View {
        Text("Anchored to immutable log \(relativeTime(date, relativeTo: currentTime))")
            .onAppear {
                // Update once on appear
                currentTime = Date()
                startTimer()
            }
            .onDisappear {
                stopTimer()
            }
            .onChange(of: scenePhase) { oldPhase, newPhase in
                // Stop timer when app backgrounds, restart when foregrounds
                if newPhase == .background || newPhase == .inactive {
                    stopTimer()
                } else if newPhase == .active {
                    startTimer()
                }
            }
    }
    
    private func startTimer() {
        // Invalidate existing timer first
        stopTimer()
        
        // Set up timer to update every 10 seconds (subtle, not aggressive)
        let t = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            DispatchQueue.main.async {
                currentTime = Date()
            }
        }
        RunLoop.current.add(t, forMode: .common)
        timer = t
    }
    
    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
    
    private func relativeTime(_ date: Date, relativeTo: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: relativeTo)
    }
}

#Preview {
    TickingTimestamp(date: Date().addingTimeInterval(-120))
        .padding()
        .background(Color.black)
}
