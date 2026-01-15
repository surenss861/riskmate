import SwiftUI
import AVFoundation
import PhotosUI

/// Enhanced evidence capture with camera, before/during/after, and tagging
struct RMEvidenceCapture: View {
    let jobId: String
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedPhase: EvidencePhase = .before
    @State private var selectedType: EvidenceType = .workArea
    @State private var showCamera = false
    @State private var showPhotoPicker = false
    @State private var capturedImage: UIImage?
    @State private var showPermissionAlert = false
    @State private var permissionType: PermissionType = .camera
    
    @StateObject private var uploadManager = BackgroundUploadManager.shared
    
    var body: some View {
        NavigationStack {
            ZStack {
                RMBackground()
                
                ScrollView(showsIndicators: false) {
                    VStack(spacing: RMTheme.Spacing.sectionSpacing) {
                        // Permission Primer
                        PermissionPrimerCard()
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        
                        // Phase Selection
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("When was this captured?")
                                .rmSectionHeader()
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            PhaseSelector(selectedPhase: $selectedPhase)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                        
                        // Evidence Type Selection
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("Evidence Type")
                                .rmSectionHeader()
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            EvidenceTypeGrid(selectedType: $selectedType)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                        }
                        
                        // Capture Buttons
                        VStack(spacing: RMTheme.Spacing.md) {
                            Button {
                                requestCameraPermission()
                            } label: {
                                HStack {
                                    Image(systemName: "camera.fill")
                                    Text("Capture Photo")
                                }
                                .font(RMTheme.Typography.bodySmallBold)
                                .foregroundColor(.black)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, RMTheme.Spacing.md)
                                .background(RMTheme.Colors.accent)
                                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
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
                CameraView(capturedImage: $capturedImage)
            }
            .sheet(isPresented: $showPhotoPicker) {
                PhotoPickerView(
                    jobId: jobId,
                    phase: selectedPhase,
                    type: selectedType
                )
            }
            .alert("Permission Required", isPresented: $showPermissionAlert) {
                Button("Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text(permissionMessage)
            }
        }
    }
    
    private var permissionMessage: String {
        switch permissionType {
        case .camera:
            return "RiskMate needs camera access to capture evidence photos. We only use photos you choose and store them securely per organization."
        case .photoLibrary:
            return "RiskMate needs photo library access to select evidence photos. We only use photos you choose and store them securely per organization."
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
}

enum EvidencePhase: String, CaseIterable {
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
                        if case .success(let data) = result, let data = data {
                            // Upload with metadata
                            Task {
                                let evidenceId = "ev_\(UUID().uuidString)"
                                let fileName = "evidence_\(Date().timeIntervalSince1970).jpg" // Default to jpg, could detect from item
                                let mimeType = "image/jpeg" // Default, could detect from item
                                
                                do {
                                    try await uploadManager.uploadEvidence(
                                        jobId: jobId,
                                        evidenceId: evidenceId,
                                        fileData: data,
                                        fileName: fileName,
                                        mimeType: mimeType
                                    )
                                } catch {
                                    print("Failed to upload evidence: \(error)")
                                }
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
