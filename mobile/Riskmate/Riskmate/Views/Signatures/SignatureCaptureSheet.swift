import SwiftUI
import UIKit

// MARK: - Signature data (matches web SignatureCapture output)

struct SignatureCaptureData {
    var signatureSvg: String
    var signerName: String
    var signerTitle: String
    var attestationText: String
}

/// Attestation statement shown to and accepted by the signer; sent to API and stored for proof.
private let attestationStatement = "I attest this report is accurate to the best of my knowledge."

// MARK: - Signature Capture Sheet

/// iOS sheet for capturing a team signature: draw pad, signer name/title, attestation, and save/cancel.
/// Use with a report run context (reportRunId, optional hash/createdAt) when saving to the API.
struct SignatureCaptureSheet: View {
    let role: SignatureRole
    var reportRunId: String?
    var reportRunHash: String?
    var reportRunCreatedAt: String?
    let onSave: (SignatureCaptureData) -> Void
    let onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var signerName: String = ""
    @State private var signerTitle: String = ""
    @State private var attestationAccepted: Bool = false
    @State private var paths: [[CGPoint]] = []
    @State private var currentPath: [CGPoint] = []
    @State private var isDrawing: Bool = false
    @State private var canvasSize: CGSize = .zero
    @State private var copiedHash: Bool = false
    @State private var errorMessage: String?
    @State private var isSubmitting: Bool = false

    /// Paths with at least two points (valid strokes). Single-point paths are discarded to avoid degenerate SVG rejected by backend.
    private var allPaths: [[CGPoint]] {
        let validPaths = paths.filter { $0.count >= 2 }
        let validCurrent = (currentPath.count >= 2) ? [currentPath] : [] as [[CGPoint]]
        return validPaths + validCurrent
    }

    private var hasSignature: Bool {
        !allPaths.isEmpty
    }

    private var canSubmit: Bool {
        hasSignature
            && !signerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !signerTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && attestationAccepted
            && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                    if let reportRunId = reportRunId, reportRunHash != nil || reportRunCreatedAt != nil {
                        runInfoSection(reportRunId: reportRunId)
                    }

                    attestationSection
                    signaturePadSection
                    signerFieldsSection
                }
                .padding(RMTheme.Spacing.pagePadding)
            }
            .background(RMTheme.Colors.background)
            .navigationTitle("Sign as \(role.displayTitle)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        Haptics.tap()
                        onCancel()
                        dismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign & Lock") {
                        submitSignature()
                    }
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(canSubmit ? .black : RMTheme.Colors.textTertiary)
                    .disabled(!canSubmit)
                }
            }
            .alert("Signature", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                if let msg = errorMessage {
                    Text(msg)
                }
            }
        }
    }

    // MARK: - Run info (optional)

    private func runInfoSection(reportRunId: String) -> some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text("Run Information")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textPrimary)

            if let created = reportRunCreatedAt {
                Text("Created: \(created)")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }

            if let hash = reportRunHash {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Integrity Hash (SHA-256)")
                            .font(RMTheme.Typography.captionSmall)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                        Text(shortHash(hash))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(RMTheme.Colors.textPrimary)
                    }
                    Spacer()
                    Button {
                        UIPasteboard.general.string = hash
                        copiedHash = true
                        Haptics.success()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copiedHash = false }
                    } label: {
                        Label(copiedHash ? "Copied" : "Copy", systemImage: copiedHash ? "checkmark" : "doc.on.doc")
                            .font(RMTheme.Typography.caption)
                    }
                    .foregroundColor(RMTheme.Colors.accent)
                }
            }

            Text("This signature applies only to this run. The run data is frozen and immutable.")
                .font(RMTheme.Typography.captionSmall)
                .foregroundColor(RMTheme.Colors.textTertiary)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                .stroke(RMTheme.Colors.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
    }

    private func shortHash(_ hash: String) -> String {
        guard hash.count > 14 else { return hash }
        return "\(hash.prefix(8))…\(hash.suffix(6))"
    }

    // MARK: - Attestation

    private var attestationSection: some View {
        HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
            Button {
                Haptics.tap()
                attestationAccepted.toggle()
            } label: {
                Image(systemName: attestationAccepted ? "checkmark.square.fill" : "square")
                    .font(.system(size: 22))
                    .foregroundColor(attestationAccepted ? RMTheme.Colors.accent : RMTheme.Colors.textTertiary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 4) {
                Text(attestationStatement)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                Text("By signing, you confirm the information in this report run reflects the conditions observed and documented.")
                    .font(RMTheme.Typography.caption)
                    .foregroundColor(RMTheme.Colors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(RMTheme.Spacing.md)
        .background(RMTheme.Colors.info.opacity(0.12))
        .overlay(
            RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                .stroke(RMTheme.Colors.info.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
    }

    // MARK: - Signature pad

    private var signaturePadSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
            Text("Signature")
                .font(RMTheme.Typography.bodySmallBold)
                .foregroundColor(RMTheme.Colors.textPrimary)
            Text("Draw in the box below")
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textTertiary)

            SignaturePadView(
                paths: $paths,
                currentPath: $currentPath,
                isDrawing: $isDrawing,
                canvasSize: $canvasSize
            )
            .frame(height: 180)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                    .stroke(RMTheme.Colors.border, lineWidth: 2)
            )

            if hasSignature {
                Button("Clear signature") {
                    Haptics.tap()
                    paths = []
                    currentPath = []
                }
                .font(RMTheme.Typography.caption)
                .foregroundColor(RMTheme.Colors.textSecondary)
            }
        }
    }

    // MARK: - Signer fields

    private var signerFieldsSection: some View {
        VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Full Legal Name")
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                TextField("", text: $signerName, prompt: Text("John Doe").foregroundColor(RMTheme.Colors.textPlaceholder))
                    .textContentType(.name)
                    .autocapitalization(.words)
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.inputFill)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                            .stroke(RMTheme.Colors.inputStroke, lineWidth: 1)
                    )
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Title / Role")
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                TextField("", text: $signerTitle, prompt: Text("Site Supervisor").foregroundColor(RMTheme.Colors.textPlaceholder))
                    .textContentType(.jobTitle)
                    .autocapitalization(.words)
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.inputFill)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous)
                            .stroke(RMTheme.Colors.inputStroke, lineWidth: 1)
                    )
            }
        }
    }

    // MARK: - Submit

    private func submitSignature() {
        guard canSubmit else { return }

        let name = signerName.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = signerTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !title.isEmpty else {
            errorMessage = "Please enter your full legal name and title."
            return
        }

        let validPaths = allPaths
        guard !validPaths.isEmpty else {
            errorMessage = "Please draw a signature with at least one stroke of two or more points."
            return
        }

        let width = canvasSize.width > 0 ? canvasSize.width : 400
        let height = canvasSize.height > 0 ? canvasSize.height : 180
        let svg = exportPathsToSvg(paths: validPaths, width: width, height: height)
        guard !svg.isEmpty else {
            errorMessage = "Could not generate signature."
            return
        }

        let data = SignatureCaptureData(
            signatureSvg: svg,
            signerName: name,
            signerTitle: title,
            attestationText: attestationStatement
        )
        Haptics.success()
        onSave(data)
        dismiss()
    }

    private func exportPathsToSvg(paths: [[CGPoint]], width: CGFloat, height: CGFloat) -> String {
        let validPaths = paths.filter { $0.count >= 2 }
        guard !validPaths.isEmpty else { return "" }
        let w = Int(width)
        let h = Int(height)
        var pathElements: String = ""
        for path in validPaths {
            var d = "M \(path[0].x) \(path[0].y)"
            for i in 1..<path.count {
                d += " L \(path[i].x) \(path[i].y)"
            }
            pathElements += "<path d=\"\(d)\" fill=\"none\" stroke=\"#000000\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"
        }
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\(w)\" height=\"\(h)\" viewBox=\"0 0 \(w) \(h)\">\(pathElements)</svg>"
    }
}

// MARK: - Signature pad (drawing)

private struct SignaturePadView: View {
    @Binding var paths: [[CGPoint]]
    @Binding var currentPath: [CGPoint]
    @Binding var isDrawing: Bool
    @Binding var canvasSize: CGSize

    var body: some View {
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                Color.white
                signaturePathsView(allPaths: paths + (currentPath.isEmpty ? [] : [currentPath]), size: size)
                    .allowsHitTesting(false)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let loc = value.location
                        if !isDrawing {
                            isDrawing = true
                            currentPath = [loc]
                        } else {
                            currentPath.append(loc)
                        }
                    }
                    .onEnded { _ in
                        if !currentPath.isEmpty {
                            paths.append(currentPath)
                            currentPath = []
                        }
                        isDrawing = false
                    }
            )
            .onAppear {
                canvasSize = size
            }
            .onChange(of: geo.size) {
                canvasSize = geo.size
            }
        }
    }

    private func signaturePathsView(allPaths: [[CGPoint]], size: CGSize) -> some View {
        Canvas { context, canvasSize in
            for path in allPaths where path.count >= 2 {
                var p = Path()
                p.move(to: path[0])
                for i in 1..<path.count {
                    p.addLine(to: path[i])
                }
                context.stroke(
                    p,
                    with: .color(.black),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                )
            }
        }
        .frame(width: size.width, height: size.height)
    }
}

// MARK: - Preview

#Preview {
    SignatureCaptureSheet(
        role: .preparedBy,
        reportRunId: nil,
        reportRunHash: nil,
        reportRunCreatedAt: nil,
        onSave: { _ in },
        onCancel: { }
    )
}
