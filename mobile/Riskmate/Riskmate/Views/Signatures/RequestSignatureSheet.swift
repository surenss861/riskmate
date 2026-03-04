import SwiftUI

/// Guided 3-step flow: Select signer(s) → Choose what to sign → Confirm & send. Package 7.
struct RequestSignatureSheet: View {
    let members: [TeamMember]
    let onDismiss: () -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var step = 1
    @State private var selectedMemberIds: Set<String> = []
    @State private var signContext: SignContext = .job
    @State private var isSending = false
    
    private let totalSteps = 3
    
    enum SignContext: String, CaseIterable {
        case job = "Job"
        case proofPack = "Proof pack"
        case general = "General"
    }
    
    var body: some View {
        RMSheetShell(
            title: "Request signature",
            subtitle: stepSubtitle,
            currentStep: step,
            totalSteps: totalSteps,
            onClose: { onDismiss(); dismiss() }
        ) {
            contentForStep
        }
    }
    
    private var stepSubtitle: String {
        switch step {
        case 1: return "Select who will sign"
        case 2: return "Choose what they're signing"
        case 3: return "Confirm and send"
        default: return ""
        }
    }
    
    @ViewBuilder
    private var contentForStep: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                switch step {
                case 1:
                    step1SelectSigners
                case 2:
                    step2ChooseWhat
                case 3:
                    step3Confirm
                default:
                    EmptyView()
                }
            }
            .padding(RMTheme.Spacing.pagePadding)
            .padding(.bottom, RMTheme.Spacing.xxl)
        }
    }
    
    private var step1SelectSigners: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("Team members")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textSecondary)
            VStack(spacing: RMTheme.Spacing.sm) {
                ForEach(members.filter { $0.role != .owner }) { member in
                    let isSelected = selectedMemberIds.contains(member.id)
                    Button {
                        Haptics.impact(.light)
                        if isSelected {
                            selectedMemberIds.remove(member.id)
                        } else {
                            selectedMemberIds.insert(member.id)
                        }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(member.fullName ?? member.email)
                                    .font(RMTheme.Typography.bodyBold)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                Text(member.email)
                                    .font(RMTheme.Typography.caption)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                .font(.title3)
                                .foregroundColor(isSelected ? RMTheme.Colors.accent : RMTheme.Colors.textTertiary)
                        }
                        .padding(RMTheme.Spacing.md)
                        .background(RMTheme.Colors.surface.opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            primaryButton(
                title: "Continue",
                disabled: selectedMemberIds.isEmpty
            ) {
                step = 2
            }
        }
    }
    
    private var step2ChooseWhat: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            Text("What are they signing?")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textSecondary)
            VStack(spacing: RMTheme.Spacing.sm) {
                ForEach(SignContext.allCases, id: \.rawValue) { ctx in
                    let isSelected = signContext == ctx
                    Button {
                        Haptics.impact(.light)
                        signContext = ctx
                    } label: {
                        HStack {
                            Text(ctx.rawValue)
                                .font(RMTheme.Typography.body)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                            Spacer()
                            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(isSelected ? RMTheme.Colors.accent : RMTheme.Colors.textTertiary)
                        }
                        .padding(RMTheme.Spacing.md)
                        .background(RMTheme.Colors.surface.opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            primaryButton(title: "Continue") {
                step = 3
            }
        }
    }
    
    private var step3Confirm: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                Text("Signers")
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                Text(selectedNames)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                Text("Document type")
                    .font(RMTheme.Typography.captionBold)
                    .foregroundColor(RMTheme.Colors.textTertiary)
                Text(signContext.rawValue)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(RMTheme.Colors.textPrimary)
            }
            primaryButton(
                title: isSending ? "Sending…" : "Send request",
                disabled: isSending
            ) {
                Task { await sendRequest() }
            }
        }
    }
    
    private var selectedNames: String {
        members
            .filter { selectedMemberIds.contains($0.id) }
            .map { $0.fullName ?? $0.email }
            .joined(separator: ", ")
    }
    
    private func primaryButton(title: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button {
            action()
        } label: {
            Text(title)
                .font(RMTheme.Typography.bodyBold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RMTheme.Spacing.md)
        }
        .background(RMTheme.Colors.accent)
        .foregroundColor(.black)
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md, style: .continuous))
        .disabled(disabled)
    }
    
    @MainActor
    private func sendRequest() async {
        isSending = true
        defer { isSending = false }
        // TODO: Wire to API when backend supports "request signature" to users
        try? await Task.sleep(nanoseconds: 400_000_000)
        Haptics.success()
        ToastCenter.shared.show("Request sent", systemImage: "checkmark.circle.fill", style: .success)
        onDismiss()
        dismiss()
    }
}

#Preview {
    RequestSignatureSheet(
        members: [
            TeamMember(id: "1", email: "a@test.com", fullName: "Alice", role: .admin, createdAt: "", mustResetPassword: false),
            TeamMember(id: "2", email: "b@test.com", fullName: "Bob", role: .member, createdAt: "", mustResetPassword: false)
        ],
        onDismiss: {}
    )
}
