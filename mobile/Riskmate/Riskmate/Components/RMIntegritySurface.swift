import SwiftUI

/// Integrity surface - shows ledger status, last recorded, proof pack count
struct RMIntegritySurface: View {
    let jobId: String
    @State private var integrity: IntegrityStatus?
    @State private var isLoading = true
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Image(systemName: "checkmark.shield.fill")
                        .foregroundColor(RMTheme.Colors.categoryGovernance)
                        .font(.system(size: 20))
                    
                    Text("Integrity Status")
                        .rmSectionHeader()
                    
                    Spacer()
                }
                
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, RMTheme.Spacing.sm)
                } else if let integrity = integrity {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                        IntegrityRow(
                            label: "Ledger Status",
                            value: integrity.ledgerStatus.rawValue,
                            status: integrity.ledgerStatus
                        )
                        
                        IntegrityRow(
                            label: "Last Recorded",
                            value: formatDate(integrity.lastRecorded),
                            status: nil
                        )
                        
                        IntegrityRow(
                            label: "Proof Packs Generated",
                            value: "\(integrity.proofPackCount)",
                            status: nil
                        )
                    }
                } else {
                    Text("Unable to load integrity status")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            }
        }
        .task {
            await loadIntegrity()
        }
    }
    
    private func loadIntegrity() async {
        isLoading = true
        defer { isLoading = false }
        
        // TODO: Replace with real API call
        try? await Task.sleep(nanoseconds: 500_000_000)
        
        integrity = IntegrityStatus(
            ledgerStatus: .verified,
            lastRecorded: Date().addingTimeInterval(-3600),
            proofPackCount: 3
        )
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct IntegrityRow: View {
    let label: String
    let value: String
    let status: LedgerStatus?
    
    var body: some View {
        HStack {
            Text(label)
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
            
            Spacer()
            
            if status != nil {
                HStack(spacing: 4) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 6, height: 6)
                    
                    Text(value)
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(statusColor)
                }
            } else {
                Text(value)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
        }
    }
    
    private var statusColor: Color {
        switch status {
        case .verified:
            return RMTheme.Colors.success
        case .pending:
            return RMTheme.Colors.warning
        case .mismatch:
            return RMTheme.Colors.error
        case .none:
            return RMTheme.Colors.textPrimary
        }
    }
}

struct IntegrityStatus {
    let ledgerStatus: LedgerStatus
    let lastRecorded: Date
    let proofPackCount: Int
}

enum LedgerStatus: String {
    case verified = "Verified"
    case pending = "Pending"
    case mismatch = "Mismatch"
}

#Preview {
    RMIntegritySurface(jobId: "1")
        .padding()
        .background(RMBackground())
}
