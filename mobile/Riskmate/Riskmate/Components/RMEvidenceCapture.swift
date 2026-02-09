import SwiftUI
import AVFoundation
import PhotosUI

/// Enhanced evidence capture with camera, before/during/after, and tagging
struct RMEvidenceCapture: View {
    let jobId: String
    var jobStatus: String = ""
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedPhase: EvidencePhase = .during
    @State private var selectedType: EvidenceType = .workArea
    @State private var showEvidenceTypeGrid = false // Collapsed by default (Apple trick)
    @State private var showCamera = false
    @State private var showPhotoPicker = false
    @State private var capturedImage: UIImage?
    @State private var showPermissionAlert = false
    @State private var permissionType: PermissionType = .camera
    @State private var hasCapturedPhoto = false // Progressive disclosure: show metadata after photo
    
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                        // Photo category selection (before camera/gallery — ticket: iOS Native Photo Category Selection)
                        CategorySelectionView(selectedCategory: $selectedPhase, jobStatus: jobStatus)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Permission Primer (always visible)
                        PermissionPrimerCard()
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Progressive disclosure: Show metadata only after photo is captured
                        if hasCapturedPhoto {
                            // Phase Selection - auto-expand after photo capture
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                                Text("When was this captured?")
                                    .rmSectionHeader()
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                
                                PhaseSelector(selectedPhase: $selectedPhase)
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                    .transition(.move(edge: .top).combined(with: .opacity))
                            }
                            
                            // Evidence Type Selection - reveal after phase selection
                            if showEvidenceTypeGrid {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                                    Text("Evidence Type")
                                        .rmSectionHeader()
                                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                    
                                    EvidenceTypeGrid(selectedType: $selectedType)
                                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                        .transition(.move(edge: .top).combined(with: .opacity))
                                }
                            } else {
                                // Show "More details" button to expand
                                Button {
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                        showEvidenceTypeGrid = true
                                    }
                                } label: {
                                    HStack {
                                        Text("More details")
                                            .font(RMTheme.Typography.body)
                                            .foregroundColor(RMTheme.Colors.accent)
                                        Image(systemName: "chevron.down")
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(RMTheme.Colors.accent)
                                    }
                                }
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                .transition(.opacity)
                            }
                        }
                        
                        // Capture Buttons - Primary CTA first (camera-first approach)
                        VStack(spacing: RMTheme.Spacing.md) {
                            Button {
                                requestCameraPermission()
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "camera.fill")
                                        .font(.system(size: 20, weight: .semibold))
                                    Text("Capture Photo")
                                        .font(RMTheme.Typography.bodyBold)
                                }
                                .foregroundColor(.black)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                                .background(
                                    LinearGradient(
                                        colors: [RMTheme.Colors.accent, RMTheme.Colors.accent.opacity(0.8)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                                .shadow(
                                    color: RMTheme.Colors.accent.opacity(0.3),
                                    radius: 12,
                                    x: 0,
                                    y: 4
                                )
                            }
                            
                            Button {
                                showPhotoPicker = true
                            } label: {
                                HStack {
                                    Image(systemName: "photo.on.rectangle")
                                    Text("Choose from Library")
                                }
                                .font(RMTheme.Typography.bodySmallBold)
                                .foregroundColor(RMTheme.Colors.textPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                                .background(RMTheme.Colors.surface.opacity(0.5))
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                            }
                        }
                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                    }
                    .padding(.vertical, RMTheme.Spacing.lg)
                }
            }
            .rmNavigationBar(title: "Capture Evidence")
            .sheet(isPresented: $showCamera) {
                CameraView(
                    capturedImage: $capturedImage,
                    onCapture: {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            hasCapturedPhoto = true
                        }
                    },
                    onImageCaptured: { image in
                        uploadCapturedImage(image)
                    }
                )
            }
            .sheet(isPresented: $showPhotoPicker) {
                PhotoPickerView(
                    jobId: jobId,
                    phase: selectedPhase,
                    type: selectedType,
                    onCapture: {
                        // Mark photo as captured to trigger progressive disclosure
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                            hasCapturedPhoto = true
                        }
                    }
                )
            }
            .alert("Permission Required", isPresented: $showPermissionAlert) {
                Button("Open Settings") {
                    RiskmateDesignSystem.Haptics.tap()
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                Button("Cancel", role: .cancel) {
                    RiskmateDesignSystem.Haptics.tap()
                }
            } message: {
                Text(permissionMessage)
            }
        }
    }
    
    private var permissionMessage: String {
        switch permissionType {
        case .camera:
            return "Riskmate needs camera access to capture evidence photos. We only use photos you choose and store them securely per organization."
        case .photoLibrary:
            return "Riskmate needs photo library access to select evidence photos. We only use photos you choose and store them securely per organization."
        }
    }
    
    private func requestCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            showCamera = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showCamera = true
                    } else {
                        permissionType = .camera
                        showPermissionAlert = true
                    }
                }
            }
        default:
            permissionType = .camera
            showPermissionAlert = true
        }
    }
    
    /// Upload a captured camera image with the selected photo category (phase)
    private func uploadCapturedImage(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }
        let evidenceId = "ev_\(UUID().uuidString)"
        let fileName = "evidence_\(Date().timeIntervalSince1970).jpg"
        Task {
            do {
                try await uploadManager.uploadEvidence(
                    jobId: jobId,
                    evidenceId: evidenceId,
                    fileData: data,
                    fileName: fileName,
                    mimeType: "image/jpeg",
                    phase: selectedPhase.rawValue
                )
                await MainActor.run {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        hasCapturedPhoto = true
                    }
                }
            } catch {
                print("[RMEvidenceCapture] Camera upload failed: \(error)")
            }
        }
    }
}

enum EvidencePhase: String, CaseIterable, Codable {
    case before = "before"
    case during = "during"
    case after = "after"
    
    var displayName: String {
        switch self {
        case .before: return "Before"
        case .during: return "During"
        case .after: return "After"
        }
    }
    
    var icon: String {
        switch self {
        case .before: return "circle.lefthalf.filled"
        case .during: return "circle.fill"
        case .after: return "checkmark.circle.fill"
        }
    }
    
    /// Emoji icon for category picker (ticket spec)
    var categoryIcon: String {
        switch self {
        case .before: return "📸"
        case .during: return "🔧"
        case .after: return "✅"
        }
    }
    
    var description: String {
        switch self {
        case .before: return "Pre-job site conditions"
        case .during: return "Work in progress"
        case .after: return "Completed work"
        }
    }
}

/// Default photo category based on job status (ticket: auto-select)
func getDefaultCategory(jobStatus: String) -> EvidencePhase {
    switch jobStatus.lowercased() {
    case "draft":
        return .before
    case "completed", "archived":
        return .after
    default:
        return .during
    }
}

// MARK: - Category Selection (ticket: iOS Native Photo Category Selection)

struct CategorySelectionView: View {
    @Binding var selectedCategory: EvidencePhase
    let jobStatus: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Photo Category")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
            
            VStack(spacing: 0) {
                ForEach([EvidencePhase.before, .during, .after], id: \.self) { category in
                    CategoryRow(
                        category: category,
                        isSelected: selectedCategory == category,
                        onTap: { selectedCategory = category }
                    )
                }
            }
            .background(Color(.systemBackground))
            .cornerRadius(10)
        }
        .onAppear {
            selectedCategory = getDefaultCategory(jobStatus: jobStatus)
        }
    }
}

struct CategoryRow: View {
    let category: EvidencePhase
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Text(category.categoryIcon)
                    .font(.title2)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(category.displayName)
                        .font(.body)
                        .fontWeight(.medium)
                    
                    Text(category.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(.blue)
                }
            }
            .padding(14)
        }
        .buttonStyle(.plain)
        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
    }
}

enum EvidenceType: String, CaseIterable {
    case permit = "permit"
    case ppe = "ppe"
    case workArea = "work_area"
    case lockout = "lockout"
    case ladder = "ladder"
    case electrical = "electrical"
    case other = "other"
    
    var displayName: String {
        switch self {
        case .permit: return "Permit"
        case .ppe: return "PPE"
        case .workArea: return "Work Area"
        case .lockout: return "Lockout"
        case .ladder: return "Ladder"
        case .electrical: return "Electrical"
        case .other: return "Other"
        }
    }
    
    var icon: String {
        switch self {
        case .permit: return "doc.text.fill"
        case .ppe: return "person.fill.checkmark"
        case .workArea: return "square.grid.2x2.fill"
        case .lockout: return "lock.fill"
        case .ladder: return "ladder.vertical"
        case .electrical: return "bolt.fill"
        case .other: return "ellipsis.circle.fill"
        }
    }
}

enum PermissionType {
    case camera
    case photoLibrary
}

struct PermissionPrimerCard: View {
    var body: some View {
        RMGlassCard {
            HStack(spacing: RMTheme.Spacing.md) {
                Image(systemName: "lock.shield.fill")
                    .foregroundColor(RMTheme.Colors.accent)
                    .font(.system(size: 24))
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Privacy First")
                        .font(RMTheme.Typography.bodySmallBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                    
                    Text("We only use photos you choose. Stored securely per organization.")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                }
            }
        }
    }
}

struct PhaseSelector: View {
    @Binding var selectedPhase: EvidencePhase
    
    var body: some View {
        HStack(spacing: RMTheme.Spacing.sm) {
            ForEach(EvidencePhase.allCases, id: \.self) { phase in
                Button {
                    selectedPhase = phase
                } label: {
                    VStack(spacing: RMTheme.Spacing.xs) {
                        Image(systemName: phase.icon)
                            .font(.system(size: 24))
                            .foregroundColor(selectedPhase == phase ? .black : RMTheme.Colors.textPrimary)
                        
                        Text(phase.displayName)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(selectedPhase == phase ? .black : RMTheme.Colors.textPrimary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.sm)
                    .background(
                        selectedPhase == phase ? RMTheme.Colors.accent : RMTheme.Colors.surface.opacity(0.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
    }
}

struct EvidenceTypeGrid: View {
    @Binding var selectedType: EvidenceType
    
    let columns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    var body: some View {
        LazyVGrid(columns: columns, spacing: RMTheme.Spacing.sm) {
            ForEach(EvidenceType.allCases, id: \.self) { type in
                Button {
                    selectedType = type
                } label: {
                    VStack(spacing: RMTheme.Spacing.xs) {
                        Image(systemName: type.icon)
                            .font(.system(size: 20))
                            .foregroundColor(selectedType == type ? .black : RMTheme.Colors.textPrimary)
                        
                        Text(type.displayName)
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(selectedType == type ? .black : RMTheme.Colors.textPrimary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RMTheme.Spacing.sm)
                    .background(
                        selectedType == type ? RMTheme.Colors.accent : RMTheme.Colors.surface.opacity(0.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
    }
}

struct CameraView: UIViewControllerRepresentable {
    @Binding var capturedImage: UIImage?
    let onCapture: () -> Void
    var onImageCaptured: ((UIImage) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView
        
        init(_ parent: CameraView) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.capturedImage = image
                parent.onImageCaptured?(image)
                parent.onCapture()
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

struct PhotoPickerView: View {
    let jobId: String
    let phase: EvidencePhase
    let type: EvidenceType
    let onCapture: () -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedItems: [PhotosPickerItem] = []
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    var body: some View {
        NavigationStack {
            PhotosPicker(
                selection: $selectedItems,
                maxSelectionCount: 10,
                matching: .images
            ) {
                Text("Select Photos")
            }
            .onChange(of: selectedItems) { (oldItems: [PhotosPickerItem], newItems: [PhotosPickerItem]) in
                // Process all new items (PhotosPickerItem doesn't conform to Equatable)
                // Only process if we have new items
                guard newItems.count > oldItems.count else { return }
                
                let addedCount = newItems.count - oldItems.count
                let addedItems = Array(newItems.suffix(addedCount))
                
                for item in addedItems {
                    item.loadTransferable(type: Data.self) { result in
                        guard case .success(let rawData) = result, let rawData = rawData else { return }
                        // Load into UIImage and re-encode as JPEG so HEIC (and other formats) upload correctly
                        guard let image = UIImage(data: rawData),
                              let jpegData = image.jpegData(compressionQuality: 0.8) else { return }
                        Task {
                            let evidenceId = "ev_\(UUID().uuidString)"
                            let fileName = "evidence_\(Date().timeIntervalSince1970).jpg"
                            let mimeType = "image/jpeg"
                            do {
                                try await uploadManager.uploadEvidence(
                                    jobId: jobId,
                                    evidenceId: evidenceId,
                                    fileData: jpegData,
                                    fileName: fileName,
                                    mimeType: mimeType,
                                    phase: phase.rawValue
                                )
                                DispatchQueue.main.async {
                                    onCapture()
                                }
                            } catch {
                                print("Failed to upload evidence: \(error)")
                            }
                        }
                    }
                }
                dismiss()
            }
            .rmNavigationBar(title: "Select Photos")
        }
    }
}
