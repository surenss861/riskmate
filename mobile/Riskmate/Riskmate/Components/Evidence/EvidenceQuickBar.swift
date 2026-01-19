import SwiftUI

/// Quick capture bar for one-hand evidence capture
struct EvidenceQuickBar: View {
    @Binding var selectedType: EvidenceType
    @State private var lastUsedType: EvidenceType = .photo
    
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
    }
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            ForEach(EvidenceType.allCases, id: \.self) { type in
                Button {
                    Haptics.tap()
                    selectedType = type
                    lastUsedType = type
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: type.icon)
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(selectedType == type ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textSecondary)
                        
                        Text(type.rawValue)
                            .font(RMSystemTheme.Typography.caption2)
                            .foregroundStyle(selectedType == type ? RMSystemTheme.Colors.accent : RMSystemTheme.Colors.textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 60) // 44pt + padding
                    .background(
                        RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md)
                            .fill(selectedType == type ? RMSystemTheme.Colors.accent.opacity(0.1) : RMSystemTheme.Colors.secondaryBackground)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .padding(.vertical, RMSystemTheme.Spacing.sm)
        .onAppear {
            selectedType = lastUsedType
        }
    }
}
