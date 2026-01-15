import SwiftUI

/// Trust UX component - shows "Ledger recorded" toast after key actions
struct RMTrustToast: View {
    let message: String
    let icon: String
    @Binding var isPresented: Bool
    
    var body: some View {
        if isPresented {
            VStack {
                Spacer()
                
                HStack(spacing: RMTheme.Spacing.sm) {
                    Image(systemName: icon)
                        .foregroundColor(RMTheme.Colors.success)
                        .font(.system(size: 16, weight: .semibold))
                    
                    Text(message)
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                }
                .padding(.horizontal, RMTheme.Spacing.md)
                .padding(.vertical, RMTheme.Spacing.sm)
                .background(RMTheme.Colors.surface)
                .overlay {
                    RoundedRectangle(cornerRadius: RMTheme.Radius.sm)
                        .stroke(RMTheme.Colors.success.opacity(0.3), lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                .themeShadow(RMTheme.Shadow.small)
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                .padding(.bottom, RMTheme.Spacing.lg)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            .animation(RMTheme.Animation.spring, value: isPresented)
            .onAppear {
                // Auto-dismiss after 3 seconds
                Task {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    withAnimation {
                        isPresented = false
                    }
                }
            }
        }
    }
}

/// Integrity badge - shows on exports/PDFs
struct RMIntegrityBadge: View {
    let hash: String?
    let verified: Bool
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.xs) {
            Image(systemName: verified ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                .foregroundColor(verified ? RMTheme.Colors.success : RMTheme.Colors.warning)
                .font(.system(size: 12, weight: .semibold))
            
            Text(verified ? "Hash Verified" : "Unverified")
                .font(RMTheme.Typography.captionBold)
                .foregroundColor(verified ? RMTheme.Colors.success : RMTheme.Colors.warning)
            
            if let hash = hash {
                Text("•")
                    .foregroundColor(RMTheme.Colors.textTertiary)
                
                Text(hash.prefix(8))
                    .font(RMTheme.Typography.captionSmall)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                    .monospacedDigit()
            }
        }
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background(RMTheme.Colors.inputFill)
        .clipShape(Capsule())
    }
}

/// Trust receipt strip - shows "who/when/why" on job updates
struct RMTrustReceiptStrip: View {
    let actor: String
    let timestamp: Date
    let action: String
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.xs) {
            Text("\(actor) • \(formatDate(timestamp)) • \(action)")
                .font(RMTheme.Typography.captionSmall)
                .foregroundColor(RMTheme.Colors.textTertiary)
            
            Spacer()
            
            Image(systemName: "lock.fill")
                .font(.system(size: 10))
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(.horizontal, RMTheme.Spacing.sm)
        .padding(.vertical, RMTheme.Spacing.xs)
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.xs))
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

/// View modifier to show trust toast
extension View {
    func trustToast(
        message: String,
        icon: String = "checkmark.circle.fill",
        isPresented: Binding<Bool>
    ) -> some View {
        ZStack {
            self
            RMTrustToast(message: message, icon: icon, isPresented: isPresented)
        }
    }
}

#Preview {
    ZStack {
        RMBackground()
        
        VStack(spacing: RMTheme.Spacing.lg) {
            RMIntegrityBadge(hash: "a1b2c3d4", verified: true)
            
            RMIntegrityBadge(hash: nil, verified: false)
            
            RMTrustReceiptStrip(
                actor: "John Doe",
                timestamp: Date(),
                action: "Updated job status"
            )
        }
        .padding()
    }
}
