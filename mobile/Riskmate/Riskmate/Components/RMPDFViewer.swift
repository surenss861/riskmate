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

/// Full-screen PDF viewer with toolbar
struct RMPDFViewerScreen: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        ZStack {
            RMBackground()
            
            VStack(spacing: 0) {
                // Toolbar
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                            .background(Color.white.opacity(0.1))
                            .clipShape(Circle())
                    }
                    
                    Spacer()
                    
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 44, height: 44)
                            .background(Color.white.opacity(0.1))
                            .clipShape(Circle())
                    }
                }
                .padding()
                
                // PDF Content
                RMPDFViewer(url: url)
            }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    // Note: Requires actual PDF URL for preview
    RMPDFViewerScreen(url: URL(string: "https://example.com/sample.pdf")!)
}
