import SwiftUI

/// Quick capture bar for one-hand evidence capture - with hierarchy (larger common types)
struct EvidenceQuickBar: View {
    @Binding var selectedType: EvidenceType
    @State private var lastUsedType: EvidenceType = .photo
    @State private var showMoreOptions = false
    
    enum EvidenceType: String, CaseIterable {
        case photo = "Photo"
        case video = "Video"
        case note = "Note"
        case file = "File"
        
        var icon: String {
            switch self {
            case .photo: return "camera.fill"
            case .video: return "video.fill"
            case .note: return "note.text"
            case .file: return "doc.fill"
            }
        }
        
        // Most used types (larger)
        var isCommon: Bool {
            self == .photo || self == .video
        }
    }
    
    // Primary types (most used - larger)
    private var primaryTypes: [EvidenceType] {
        [.photo, .video]
    }
    
    // Secondary types (less used - smaller, or under "More")
    private var secondaryTypes: [EvidenceType] {
        [.note, .file]
    }
    
    var body: some View {
        VStack(spacing: RMSystemTheme.Spacing.sm) {
            // Primary types (larger, prominent)
            HStack(spacing: RMSystemTheme.Spacing.sm) {
                ForEach(primaryTypes, id: \.self) { type in
                    Button {
                        Haptics.impact(.medium)
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            selectedType = type
                            lastUsedType = type
                        }
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: type.icon)
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundStyle(selectedType == type ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textSecondary)
                            
                            Text(type.rawValue)
                                .font(RMSystemTheme.Typography.caption.weight(.semibold))
                                .foregroundStyle(selectedType == type ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textTertiary)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 72) // Larger for primary types
                        .background(
                            RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md)
                                .fill(selectedType == type ? RMSystemTheme.Colors.accent.opacity(0.15) : RMSystemTheme.Colors.secondaryBackground)
                                .overlay(
                                    RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md)
                                        .stroke(
                                            selectedType == type ? RMSystemTheme.Colors.accent.opacity(0.4) : Color.clear,
                                            lineWidth: selectedType == type ? 2 : 0
                                        )
                                )
                        )
                        .scaleEffect(selectedType == type ? 1.02 : 1.0)
                        .shadow(
                            color: selectedType == type ? RMSystemTheme.Colors.accent.opacity(0.2) : Color.clear,
                            radius: selectedType == type ? 8 : 0
                        )
                    }
                    .buttonStyle(.plain)
                }
                
                // Secondary types (smaller, or "More" button)
                if !showMoreOptions {
                    Button {
                        Haptics.tap()
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            showMoreOptions = true
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                            
                            Text("More")
                                .font(RMSystemTheme.Typography.caption2)
                                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 60)
                        .background(
                            RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md)
                                .fill(RMSystemTheme.Colors.secondaryBackground)
                        )
                    }
                    .buttonStyle(.plain)
                } else {
                    // Show secondary types when expanded
                    ForEach(secondaryTypes, id: \.self) { type in
                        Button {
                            Haptics.tap()
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                selectedType = type
                                lastUsedType = type
                                showMoreOptions = false
                            }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: type.icon)
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundStyle(selectedType == type ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textSecondary)
                                
                                Text(type.rawValue)
                                    .font(RMSystemTheme.Typography.caption2)
                                    .foregroundStyle(selectedType == type ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textTertiary)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 60)
                            .background(
                                RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md)
                                    .fill(selectedType == type ? RMSystemTheme.Colors.accent.opacity(0.1) : RMSystemTheme.Colors.secondaryBackground)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .padding(.vertical, RMSystemTheme.Spacing.sm)
        .onAppear {
            selectedType = lastUsedType
        }
    }
}
