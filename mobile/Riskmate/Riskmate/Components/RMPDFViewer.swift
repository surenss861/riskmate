import SwiftUI
import PDFKit

/// PDF viewer component using PDFKit
struct RMPDFViewer: UIViewRepresentable {
    let url: URL
    var autoScales: Bool = true
    var displayMode: PDFDisplayMode = .singlePageContinuous
    
    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = autoScales
        pdfView.displayMode = displayMode
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = .clear
        
        // Dark mode support
        if let document = PDFDocument(url: url) {
            pdfView.document = document
        }
        
        return pdfView
    }
    
    func updateUIView(_ pdfView: PDFView, context: Context) {
        if pdfView.document == nil {
            pdfView.document = PDFDocument(url: url)
        }
    }
}

/// Full-screen PDF viewer with toolbar, loading, and error states
struct RMPDFViewerScreen: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = true
    @State private var error: Error?
    @State private var downloadedURL: URL?
    
    var body: some View {
        ZStack {
            RMBackground()
            
            VStack(spacing: 0) {
                // Toolbar
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(RMTheme.Colors.textPrimary)
                            .frame(width: 44, height: 44)
                            .background(RMTheme.Colors.inputFill)
                            .clipShape(Circle())
                    }
                    
                    Spacer()
                    
                    if downloadedURL != nil {
                        ShareLink(item: downloadedURL!) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .frame(width: 44, height: 44)
                                .background(RMTheme.Colors.inputFill)
                                .clipShape(Circle())
                        }
                        
                        Button(action: { downloadPDF() }) {
                            Image(systemName: "arrow.down.circle")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .frame(width: 44, height: 44)
                                .background(RMTheme.Colors.inputFill)
                                .clipShape(Circle())
                        }
                    }
                }
                .padding(RMTheme.Spacing.md)
                .background(RMTheme.Colors.surface.opacity(0.5))
                
                // Content
                if let error = error {
                    // Error State
                    VStack(spacing: RMTheme.Spacing.md) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 48, weight: .light))
                            .foregroundColor(RMTheme.Colors.error)
                        
                        Text("Failed to Load PDF")
                            .font(RMTheme.Typography.title3)
                            .foregroundColor(RMTheme.Colors.textPrimary)
                        
                        Text(error.localizedDescription)
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, RMTheme.Spacing.lg)
                        
                        RMPrimaryButton(title: "Retry", action: {
                            Task {
                                await loadPDF()
                            }
                        })
                        .padding(.top, RMTheme.Spacing.sm)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if isLoading {
                    // Loading State
                    VStack(spacing: RMTheme.Spacing.md) {
                        RMLottieView(name: "loading", loopMode: .loop)
                            .frame(width: 80, height: 80)
                        
                        Text("Loading PDF...")
                            .font(RMTheme.Typography.body)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let pdfURL = downloadedURL {
                    // PDF Content
                    RMPDFViewer(url: pdfURL)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            await loadPDF()
        }
    }
    
    private func loadPDF() async {
        isLoading = true
        error = nil
        
        do {
            // Download PDF to local cache
            let (data, _) = try await URLSession.shared.data(from: url)
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("pdf")
            
            try data.write(to: tempURL)
            downloadedURL = tempURL
            isLoading = false
        } catch {
            self.error = error
            isLoading = false
        }
    }
    
    private func downloadPDF() {
        guard let pdfURL = downloadedURL else { return }
        
        let activityVC = UIActivityViewController(
            activityItems: [pdfURL],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootViewController = windowScene.windows.first?.rootViewController {
            rootViewController.present(activityVC, animated: true)
        }
    }
}

#Preview {
    // Note: Requires actual PDF URL for preview
    RMPDFViewerScreen(url: URL(string: "https://example.com/sample.pdf")!)
}
