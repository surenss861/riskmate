import SwiftUI
import PhotosUI

/// Multi-select photo picker for job photos
struct RMPhotoPicker: View {
    @Binding var selectedItems: [PhotosPickerItem]
    @Binding var images: [UIImage]
    var maxSelection: Int = 10
    
    var body: some View {
        PhotosPicker(
            selection: $selectedItems,
            maxSelectionCount: maxSelection,
            matching: .images
        ) {
            RMPrimaryButton(title: "Select Photos") {}
        }
        .onChange(of: selectedItems) { _, newItems in
            Task {
                await loadImages(from: newItems)
            }
        }
    }
    
    private func loadImages(from items: [PhotosPickerItem]) async {
        var loadedImages: [UIImage] = []
        
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                loadedImages.append(image)
            }
        }
        
        await MainActor.run {
            images = loadedImages
        }
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
