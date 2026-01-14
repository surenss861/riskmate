# iOS Dependencies Guide - RiskMate Mobile App

This guide lists all Xcode-compatible dependencies needed to match the web app functionality.

## ✅ Already Integrated

### 1. **Supabase Swift SDK**
- **Purpose**: Authentication, database, storage, real-time
- **Package**: `https://github.com/supabase/supabase-swift`
- **Status**: ✅ Already added
- **Usage**: Auth, API calls, file storage

---

## 📦 Core Dependencies (Required)

### 2. **Swift Charts** (iOS 16+)
- **Purpose**: Charts and data visualization (matches web TrendChart)
- **Type**: Native Apple framework (no package needed)
- **Alternative**: [Charts](https://github.com/danielgindi/Charts) if you need iOS 15 support
- **Usage**: Dashboard charts, compliance trends, KPI visualizations

```swift
import Charts

// Example: Line chart for compliance trend
Chart {
    ForEach(data) { point in
        LineMark(
            x: .value("Date", point.date),
            y: .value("Rate", point.rate)
        )
        .foregroundStyle(Color(hex: "#F97316"))
    }
}
```

### 3. **PDFKit** (Native)
- **Purpose**: PDF generation and viewing
- **Type**: Native Apple framework
- **Usage**: Generate Risk Snapshot PDFs, view reports
- **Note**: For generation, you'll need to create PDFs similar to web's PDFKit usage

```swift
import PDFKit

// Generate PDF
let pdfDocument = PDFDocument()
// Add pages, text, images...
```

### 4. **URLSession** (Native)
- **Purpose**: HTTP requests to backend API
- **Type**: Native (already using)
- **Status**: ✅ Already implemented
- **Usage**: All API calls

---

## 🎨 UI & Design Dependencies

### 5. **SwiftUI** (Native)
- **Purpose**: UI framework
- **Type**: Native
- **Status**: ✅ Already using
- **Usage**: All views, animations, materials

### 6. **SwiftUI Charts** (iOS 16+)
- **Purpose**: Native charting (replaces web's custom SVG charts)
- **Type**: Native framework
- **Usage**: Dashboard charts, trends

### 7. **SF Symbols** (Native)
- **Purpose**: Icons
- **Type**: Native (built into iOS)
- **Status**: ✅ Already using
- **Usage**: All icons (envelope, lock, etc.)

---

## 📊 Data & State Management

### 8. **Combine** (Native)
- **Purpose**: Reactive programming, state management
- **Type**: Native framework
- **Status**: ✅ Already using (@Published, ObservableObject)
- **Usage**: Session management, data fetching

### 9. **Codable** (Native)
- **Purpose**: JSON encoding/decoding
- **Type**: Native
- **Status**: ✅ Already using
- **Usage**: API request/response models

---

## 🖼️ Image & Media

### 10. **SwiftUI Image Picker** (Native)
- **Purpose**: Photo selection from camera/library
- **Type**: Native (PHPickerViewController wrapper)
- **Usage**: Job photo uploads

```swift
import PhotosUI

@State private var selectedItem: PhotosPickerItem?
PhotosPicker(selection: $selectedItem, matching: .images)
```

### 11. **ImageIO** (Native)
- **Purpose**: Image processing, compression
- **Type**: Native framework
- **Usage**: Resize/compress photos before upload

---

## 📄 File Handling

### 12. **Foundation** (Native)
- **Purpose**: File operations, date formatting, URLs
- **Type**: Native
- **Status**: ✅ Already using
- **Usage**: File uploads, downloads, date formatting

### 13. **UniformTypeIdentifiers** (Native)
- **Purpose**: File type identification
- **Type**: Native framework
- **Usage**: Document type detection (PDF, images, etc.)

---

## 🔔 Notifications & Background

### 14. **UserNotifications** (Native)
- **Purpose**: Push notifications, local notifications
- **Type**: Native framework
- **Usage**: Job reminders, team updates, audit alerts

```swift
import UserNotifications

// Request permission
UNUserNotificationCenter.current().requestAuthorization(...)
```

### 15. **BackgroundTasks** (Native)
- **Purpose**: Background sync, data refresh
- **Type**: Native framework
- **Usage**: Sync jobs in background, refresh dashboard

---

## 🎯 Optional Enhancements (Recommended)

### 16. **Kingfisher** (Image Caching)
- **Purpose**: Async image loading, caching, placeholder
- **Package**: `https://github.com/onevcat/Kingfisher`
- **SPM**: ✅ Yes
- **Usage**: Efficient photo loading in job lists, thumbnails

```swift
import Kingfisher

KFImage(URL(string: imageUrl))
    .placeholder { ProgressView() }
    .resizable()
    .aspectRatio(contentMode: .fit)
```

### 17. **Alamofire** (Networking - Optional)
- **Purpose**: Advanced HTTP client (if URLSession becomes limiting)
- **Package**: `https://github.com/Alamofire/Alamofire`
- **SPM**: ✅ Yes
- **Note**: URLSession is usually sufficient, but Alamofire adds convenience

### 18. **SwiftDate** (Date Handling)
- **Purpose**: Advanced date parsing, formatting, timezone handling
- **Package**: `https://github.com/malcommac/SwiftDate`
- **SPM**: ✅ Yes
- **Usage**: Date formatting, relative dates ("2 days ago")

```swift
import SwiftDate

let date = "2024-01-15".toDate()
date.toRelative(style: RelativeFormatter.defaultStyle())
```

### 19. **Lottie** (Animations)
- **Purpose**: Smooth micro-animations, loading states
- **Package**: `https://github.com/airbnb/lottie-ios`
- **SPM**: ✅ Yes
- **Usage**: Loading spinners, success animations, empty states

```swift
import Lottie

LottieAnimationView(name: "loading")
    .playing(loopMode: .loop)
```

### 20. **SDWebImageSwiftUI** (Alternative to Kingfisher)
- **Purpose**: Image loading with caching
- **Package**: `https://github.com/SDWebImage/SDWebImageSwiftUI`
- **SPM**: ✅ Yes
- **Usage**: If you prefer SDWebImage over Kingfisher

---

## 📱 Advanced Features (Future)

### 21. **RealityKit** (3D/AR - Optional)
- **Purpose**: 3D visuals, AR features
- **Type**: Native framework
- **Usage**: If you want 3D hero scenes like web (Three.js equivalent)

### 22. **SceneKit** (3D - Alternative)
- **Purpose**: 3D graphics (simpler than RealityKit)
- **Type**: Native framework
- **Usage**: 3D visualizations, if needed

### 23. **Core ML** (AI/ML - Future)
- **Purpose**: On-device AI (hazard detection, risk prediction)
- **Type**: Native framework
- **Usage**: Future feature for smart hazard detection from photos

---

## 🔧 Development Tools

### 24. **SwiftLint** (Code Quality)
- **Purpose**: Enforce Swift style guide
- **Package**: `https://github.com/realm/SwiftLint`
- **SPM**: ✅ Yes (as build tool)
- **Usage**: Keep code consistent

### 25. **SwiftGen** (Code Generation)
- **Purpose**: Generate typed code for assets, strings, colors
- **Package**: `https://github.com/SwiftGen/SwiftGen`
- **SPM**: ✅ Yes (as build tool)
- **Usage**: Type-safe access to assets, avoid hardcoded strings

---

## 📋 Feature-by-Feature Dependency Map

### Dashboard
- ✅ **SwiftUI** - UI framework
- ✅ **Swift Charts** - Charts (iOS 16+)
- ✅ **Combine** - Data fetching, state
- ✅ **URLSession** - API calls

### Job Management
- ✅ **SwiftUI** - Forms, lists
- ✅ **PhotosUI** - Photo picker
- ✅ **ImageIO** - Image processing
- ✅ **URLSession** - API calls

### PDF Generation
- ✅ **PDFKit** - PDF creation
- ✅ **Core Graphics** - Drawing, layout
- ✅ **Foundation** - File operations

### File Upload/Download
- ✅ **URLSession** - HTTP upload/download
- ✅ **Foundation** - File handling
- ✅ **UniformTypeIdentifiers** - File types

### Charts & Analytics
- ✅ **Swift Charts** - Native charts (iOS 16+)
- ✅ **Charts** (alternative) - If iOS 15 support needed

### Real-time Updates
- ✅ **Supabase Swift** - Real-time subscriptions
- ✅ **Combine** - Reactive streams

### Notifications
- ✅ **UserNotifications** - Push/local notifications
- ✅ **BackgroundTasks** - Background sync

### Image Handling
- ⭐ **Kingfisher** (recommended) - Async loading, caching
- ✅ **PhotosUI** - Image picker
- ✅ **ImageIO** - Processing

### Animations
- ✅ **SwiftUI** - Native animations
- ⭐ **Lottie** (optional) - Complex animations

---

## 🚀 Quick Start: Essential Packages

### Minimum Required (Already Have)
1. ✅ Supabase Swift SDK
2. ✅ SwiftUI
3. ✅ Combine
4. ✅ URLSession

### Recommended Additions
1. ⭐ **Kingfisher** - Image loading
2. ⭐ **SwiftDate** - Date handling
3. ⭐ **Swift Charts** - Charts (iOS 16+)

### Optional (Nice to Have)
1. **Lottie** - Animations
2. **SwiftLint** - Code quality
3. **SwiftGen** - Code generation

---

## 📝 How to Add Packages in Xcode

### Via Swift Package Manager (SPM)

1. **Open Xcode** → Select your project
2. **File** → **Add Package Dependencies...**
3. **Enter URL**: `https://github.com/[owner]/[repo]`
4. **Select version**: Latest or specific
5. **Add to target**: Riskmate
6. **Click Add**

### Example: Adding Kingfisher

```
URL: https://github.com/onevcat/Kingfisher
Version: Up to Next Major (6.0.0)
Target: Riskmate
```

---

## 🎯 Feature Parity Checklist

| Web Feature | iOS Dependency | Status |
|------------|----------------|--------|
| Authentication | Supabase Swift | ✅ |
| Dashboard Charts | Swift Charts | ⚠️ Need to add |
| PDF Generation | PDFKit | ⚠️ Need to implement |
| Photo Upload | PhotosUI + ImageIO | ⚠️ Need to implement |
| File Download | URLSession | ✅ |
| Real-time Updates | Supabase Swift | ✅ |
| Notifications | UserNotifications | ⚠️ Need to implement |
| Image Caching | Kingfisher (recommended) | ⚠️ Need to add |
| Date Formatting | SwiftDate (optional) | ⚠️ Need to add |
| Animations | SwiftUI + Lottie (optional) | ✅ (SwiftUI) |

---

## 🔗 Package URLs for Quick Copy

```bash
# Essential
https://github.com/supabase/supabase-swift          # ✅ Already added

# Recommended
https://github.com/onevcat/Kingfisher              # Image loading
https://github.com/malcommac/SwiftDate             # Date handling

# Optional
https://github.com/airbnb/lottie-ios               # Animations
https://github.com/realm/SwiftLint                 # Code quality
https://github.com/SwiftGen/SwiftGen               # Code generation
```

---

## 💡 Pro Tips

1. **Start with native**: Use SwiftUI, Combine, URLSession first
2. **Add packages incrementally**: Don't add everything at once
3. **Test on device**: Some features (camera, notifications) need real device
4. **iOS version**: Target iOS 16+ for Swift Charts, or use Charts library for iOS 15
5. **Image caching**: Kingfisher is worth it for photo-heavy features

---

## 🎨 Matching Web Features

### Charts (Web: Custom SVG → iOS: Swift Charts)
- Dashboard trends
- Compliance charts
- KPI visualizations

### PDF Generation (Web: PDFKit → iOS: PDFKit)
- Risk Snapshot reports
- Audit reports
- Proof packs

### File Upload (Web: Supabase Storage → iOS: Supabase Swift + PhotosUI)
- Job photos
- Documents
- Evidence files

### Real-time (Web: Supabase Realtime → iOS: Supabase Swift)
- Job updates
- Team activity
- Audit logs

---

## 📚 Next Steps

1. **Add Kingfisher** for image loading
2. **Implement PhotosUI** for photo picker
3. **Add Swift Charts** for dashboard
4. **Implement PDFKit** for PDF generation
5. **Add UserNotifications** for push notifications

All packages listed here are Xcode-compatible via Swift Package Manager (SPM).
