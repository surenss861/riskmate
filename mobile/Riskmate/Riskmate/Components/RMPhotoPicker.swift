import SwiftUI
import PhotosUI

/// Multi-select photo picker for job photos with background upload
struct RMPhotoPicker: View {
    let jobId: String
    /// Photo category (before/during/after). Defaults to "during" when used without category selection.
    var phase: String = "during"
    @Environment(\.dismiss) private var dismiss
    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var isUploading = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: RMTheme.Spacing.lg) {
                PhotosPicker(
                    selection: $selectedItems,
                    maxSelectionCount: 10,
                    matching: .images
                ) {
                    HStack {
                        Image(systemName: "photo.on.rectangle")
                        Text("Select Photos")
                    }
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.md)
                    .background(RMTheme.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
                .disabled(isUploading)
                
                if isUploading {
                    ProgressView("Uploading...")
                        .padding()
                }
            }
            .padding(RMTheme.Spacing.pagePadding)
            .background(RMBackground())
            .navigationTitle("Add Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onChange(of: selectedItems) { _, newItems in
                Task {
                    await uploadImages(from: newItems)
                }
            }
        }
    }
    
    private func uploadImages(from items: [PhotosPickerItem]) async {
        isUploading = true
        defer { isUploading = false }
        
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data),
                  let jpegData = image.jpegData(compressionQuality: 0.8) else {
                continue
            }
            
            let evidenceId = UUID().uuidString
            let fileName = "evidence-\(evidenceId).jpg"
            
            do {
                try await BackgroundUploadManager.shared.uploadEvidence(
                    jobId: jobId,
                    evidenceId: evidenceId,
                    fileData: jpegData,
                    fileName: fileName,
                    mimeType: "image/jpeg",
                    phase: phase
                )
            } catch {
                print("[RMPhotoPicker] Upload failed: \(error)")
            }
        }
        
        // Dismiss after uploads are queued
        dismiss()
    }
}

/// Photo grid with thumbnails
struct RMPhotoGrid: View {
    let images: [UIImage]
    let onDelete: (Int) -> Void
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(images.indices, id: \.self) { index in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: images[index])
                            .resizable()
                            .scaledToFill()
                            .frame(width: 84, height: 84)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        
                        Button(action: { onDelete(index) }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.white)
                                .background(Color.black.opacity(0.5))
                                .clipShape(Circle())
                        }
                        .padding(4)
                    }
                }
            }
            .padding(.horizontal)
        }
    }
}

#Preview {
    RMPhotoGrid(images: [], onDelete: { _ in })
        .background(RMBackground())
}
