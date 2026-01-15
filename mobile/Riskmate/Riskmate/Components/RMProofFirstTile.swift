import SwiftUI

/// Proof-first tile for Executive view - tap for deep detail
struct ProofFirstTile: View {
    let title: String
    let status: ProofTileStatus
    let count: Int
    let total: Int?
    let icon: String
    let color: Color
    var subtitle: String? = nil
    let action: () -> Void
    
    var body: some View {
        Button {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            action()
        } label: {
            RMGlassCard {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                    HStack {
                        Image(systemName: icon)
                            .foregroundColor(color)
                            .font(.system(size: 24))
                        
                        Spacer()
                        
                        StatusIndicator(status: status)
                    }
                    
                    Text(title)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    if let total = total {
                        Text("\(count)/\(total) verified")
                            .font(RMTheme.Typography.title3)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    } else {
                        Text("\(count)")
                            .font(RMTheme.Typography.title3)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    
                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
            }
            .frame(width: 160)
        }
        .accessibilityLabel("\(title): \(count) items")
        .accessibilityHint("Tap to view details")
    }
}

enum ProofTileStatus {
    case verified
    case pending
    case degraded
    case ready
    case blocked
    
    var icon: String {
        switch self {
        case .verified, .ready: return "checkmark.circle.fill"
        case .pending: return "clock.fill"
        case .degraded: return "exclamationmark.triangle.fill"
        case .blocked: return "xmark.circle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .verified, .ready: return RMTheme.Colors.success
        case .pending: return RMTheme.Colors.warning
        case .degraded, .blocked: return RMTheme.Colors.error
        }
    }
}

struct StatusIndicator: View {
    let status: ProofTileStatus
    
    var body: some View {
        Image(systemName: status.icon)
            .foregroundColor(status.color)
            .font(.system(size: 16))
    }
}

/// Narrative timeline - tells a story, not just events
struct NarrativeTimelineView: View {
    let events: [CustodyEvent]
    @State private var selectedStory: NarrativeStory?
    
    var body: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("System of Record")
                .rmSectionHeader()
            
            if events.isEmpty {
                RMEmptyState(
                    icon: "clock",
                    title: "No Activity",
                    message: "Work record activity will appear here"
                )
            } else {
                // Group events into narrative stories
                ForEach(narrativeStories) { story in
                    NarrativeStoryCard(story: story) {
                        selectedStory = story
                    }
                }
            }
        }
    }
    
    private var narrativeStories: [NarrativeStory] {
        // Group events by job and create narrative
        var stories: [NarrativeStory] = []
        
        // Group by job
        let grouped = Dictionary(grouping: events) { $0.jobId ?? "system" }
        
        for (jobId, jobEvents) in grouped {
            if jobId == "system" {
                // System-level events
                for event in jobEvents {
                    stories.append(NarrativeStory(
                        id: event.id.uuidString,
                        title: narrativeTitle(for: event),
                        events: [event],
                        jobId: nil,
                        jobTitle: nil
                    ))
                }
            } else {
                // Job-specific narrative
                let sortedEvents = jobEvents.sorted { $0.timestamp > $1.timestamp }
                let jobTitle = sortedEvents.first?.jobTitle ?? "Job #\(jobId)"
                
                stories.append(NarrativeStory(
                    id: jobId,
                    title: narrativeTitle(for: sortedEvents),
                    events: sortedEvents,
                    jobId: jobId,
                    jobTitle: jobTitle
                ))
            }
        }
        
        return stories.sorted { $0.events.first?.timestamp ?? Date() > $1.events.first?.timestamp ?? Date() }
    }
    
    private func narrativeTitle(for event: CustodyEvent) -> String {
        switch event.type {
        case .controlSealed:
            return "Controls sealed and verified"
        case .evidencePending:
            return "Evidence captured, pending sync"
        case .actionBlocked:
            return "Policy enforcement blocked action"
        case .proofPackGenerated:
            return "Proof Pack generated and sealed"
        case .accessChanged:
            return "Access permissions updated"
        case .policyEnforced:
            return "Policy rule enforced"
        }
    }
    
    private func narrativeTitle(for events: [CustodyEvent]) -> String {
        // Create a narrative from multiple events
        let sorted = events.sorted { $0.timestamp < $1.timestamp }
        var parts: [String] = []
        
        for event in sorted {
            switch event.type {
            case .controlSealed:
                parts.append("controls triggered")
            case .evidencePending:
                parts.append("evidence attached")
            case .proofPackGenerated:
                parts.append("pack exported")
            case .actionBlocked:
                parts.append("action blocked")
            default:
                break
            }
        }
        
        if parts.isEmpty {
            return "Work record activity"
        }
        
        return parts.joined(separator: " → ")
    }
}

struct NarrativeStory: Identifiable {
    let id: String
    let title: String
    let events: [CustodyEvent]
    let jobId: String?
    let jobTitle: String?
}

struct NarrativeStoryCard: View {
    let story: NarrativeStory
    let action: () -> Void
    
    var body: some View {
        Button {
            action()
        } label: {
            RMGlassCard {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                    if let jobTitle = story.jobTitle {
                        Text(jobTitle)
                            .font(RMTheme.Typography.bodySmallBold)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    
                    Text(story.title)
                        .font(RMTheme.Typography.body)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    HStack {
                        ForEach(story.events.prefix(3)) { event in
                            Image(systemName: event.type.icon)
                                .foregroundColor(event.outcome == .allowed ? RMTheme.Colors.success : RMTheme.Colors.error)
                                .font(.system(size: 12))
                        }
                        
                        if story.events.count > 3 {
                            Text("+\(story.events.count - 3)")
                                .font(RMTheme.Typography.caption)
                                .foregroundColor(RMTheme.Colors.textTertiary)
                        }
                        
                        Spacer()
                        
                        Text(formatRelativeTime(story.events.first?.timestamp ?? Date()))
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
            }
        }
    }
    
    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
