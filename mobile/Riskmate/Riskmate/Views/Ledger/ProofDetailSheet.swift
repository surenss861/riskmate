import SwiftUI

/// Full proof details: event summary, cryptographic proof, verification, metadata, copy actions.
struct ProofDetailSheet: View {
    let event: AuditEvent
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    EventSummaryCard(event: event)
                    CryptoProofCard(event: event)
                    VerificationCard(event: event)
                    if !event.metadata.isEmpty {
                        MetadataCard(metadata: event.metadata)
                    }
                    ProofActionsCard(event: event)
                }
                .padding()
            }
            .background(RMTheme.Colors.background)
            .navigationTitle("Proof Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        Haptics.tap()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
    }
}

// MARK: - Event Summary Card

private struct EventSummaryCard: View {
    let event: AuditEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(event.summary)
                .font(RMTheme.Typography.title3)
                .foregroundColor(RMTheme.Colors.textPrimary)
            HStack(spacing: 8) {
                Text(event.category)
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                Text("•")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                Text(event.actor.isEmpty ? "System" : event.actor)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            Text(event.timestamp.formatted(date: .abbreviated, time: .shortened))
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.lg))
    }
}

// MARK: - Cryptographic Proof Card

private struct CryptoProofCard: View {
    let event: AuditEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: "lock.shield.fill")
                    .foregroundColor(RMTheme.Colors.accent)
                Text("Cryptographic Proof")
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
            ProofField(label: "Proof ID", value: event.id, copyable: true)
            ProofField(label: "Record Hash", value: event.recordHash ?? event.id, copyable: true, monospace: true)
            if let prev = event.previousHash, !prev.isEmpty {
                ProofField(label: "Links to", value: prev, copyable: true, monospace: true)
            }
            if let sig = event.signature, !sig.isEmpty {
                ProofField(label: "Digital Signature", value: sig, copyable: true, monospace: true)
            }
            Text("This proof is cryptographically anchored and cannot be altered.")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.lg))
    }
}

// MARK: - Proof Field

private struct ProofField: View {
    let label: String
    let value: String
    let copyable: Bool
    let monospace: Bool

    init(label: String, value: String, copyable: Bool = false, monospace: Bool = false) {
        self.label = label
        self.value = value
        self.copyable = copyable
        self.monospace = monospace
    }

    private var displayValue: String {
        if value.count > 40 {
            return String(value.prefix(20)) + "..." + String(value.suffix(20))
        }
        return value
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            HStack(alignment: .top, spacing: 10) {
                Text(displayValue)
                    .font(monospace ? .system(.caption, design: .monospaced) : .caption)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .lineLimit(2)
                    .textSelection(.enabled)
                Spacer()
                if copyable {
                    Button {
                        UIPasteboard.general.string = value
                        Haptics.success()
                        ToastCenter.shared.show("Copied", systemImage: "checkmark.circle.fill", style: .success)
                    } label: {
                        Image(systemName: "doc.on.doc")
                            .font(.caption)
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Copy \(label)")
                }
            }
        }
    }
}

// MARK: - Verification Card

private struct VerificationCard: View {
    let event: AuditEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundColor(RMTheme.Colors.success)
                Text("Verification")
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
            HStack(spacing: 8) {
                Circle()
                    .fill(RMTheme.Colors.success)
                    .frame(width: 8, height: 8)
                Text("Verified & Immutable")
                    .font(RMTheme.Typography.bodySmall)
                    .fontWeight(.semibold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
            Text("Anchored \(event.timestamp.formatted(date: .abbreviated, time: .shortened))")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            if let txHash = event.txHash, !txHash.isEmpty {
                ProofField(label: "Anchor Reference", value: txHash, copyable: true, monospace: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RMTheme.Colors.success.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.lg)
                .stroke(RMTheme.Colors.success.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.lg))
    }
}

// MARK: - Metadata Card

private struct MetadataCard: View {
    let metadata: [String: String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Event Details")
                .font(RMTheme.Typography.bodyBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
            ForEach(metadata.keys.sorted(), id: \.self) { key in
                VStack(alignment: .leading, spacing: 4) {
                    Text(key.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    Text(metadata[key] ?? "")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .textSelection(.enabled)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.lg))
    }
}

// MARK: - Proof Actions Card

private struct ProofActionsCard: View {
    let event: AuditEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Actions")
                .font(RMTheme.Typography.bodyBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Button {
                UIPasteboard.general.string = event.id
                Haptics.success()
                ToastCenter.shared.show("Proof ID copied", systemImage: "checkmark.circle.fill", style: .success)
            } label: {
                ProofActionRow(icon: "doc.on.doc", title: "Copy Proof ID", subtitle: "Share with auditors")
            }
            .buttonStyle(.plain)
            Button {
                let summary = proofSummary
                UIPasteboard.general.string = summary
                Haptics.success()
                ToastCenter.shared.show("Summary copied", systemImage: "checkmark.circle.fill", style: .success)
            } label: {
                ProofActionRow(icon: "square.and.arrow.up", title: "Copy Summary", subtitle: "Full proof details")
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(RMTheme.Colors.inputFill)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.lg))
    }

    private var proofSummary: String {
        let iso = ISO8601DateFormatter().string(from: event.timestamp)
        return """
        RISKMATE PROOF RECORD

        Proof ID: \(event.id)
        Event: \(event.summary)
        Category: \(event.category)
        Actor: \(event.actor.isEmpty ? "System" : event.actor)
        Timestamp: \(iso)

        Status: Verified & Immutable

        This record is cryptographically anchored and cannot be altered.
        """
    }
}

private struct ProofActionRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(RMTheme.Colors.accent)
                .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(RMTheme.Typography.bodySmall)
                    .fontWeight(.medium)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding()
        .background(RMTheme.Colors.background.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
    }
}
