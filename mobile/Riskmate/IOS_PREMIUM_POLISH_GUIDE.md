# iOS Premium Polish Guide - RiskMate Mobile

**Goal**: Make RiskMate iOS feel premium (better than web) while matching web brand, using only Xcode-compatible dependencies.

---

## 🎯 Core Philosophy

**Premium iOS apps don't come from stacking libraries** — they come from:
1. **Tight design system** (tokens + components)
2. **Native depth** (materials, haptics, motion, transitions)
3. **Sharp "web glass" edges** (strokes + inner highlights + controlled blur)
4. **One polished flow** (not 10 half-finished screens)

---

## ✅ Already Have (Native)

- **SwiftUI** - UI framework
- **Combine** - State management
- **URLSession** - Networking
- **Supabase Swift** - Auth, database, storage
- **Foundation** - Dates, files, JSON

---

## 📦 Essential Packages (Add These)

### 1. **Kingfisher** ⭐ (Highest Priority)
- **Why**: Image loading without this feels janky
- **Package**: `https://github.com/onevcat/Kingfisher`
- **Usage**: Job photos, thumbnails, profile images
- **Impact**: Makes lists feel smooth and premium

```swift
import Kingfisher

KFImage(URL(string: imageUrl))
    .placeholder { ProgressView().tint(.white) }
    .resizable()
    .scaledToFill()
    .frame(height: 160)
    .clipShape(RoundedRectangle(cornerRadius: 22))
```

### 2. **Swift Charts** (iOS 16+)
- **Why**: Native charts with smooth animations
- **Type**: Native framework (no package)
- **Usage**: Dashboard trends, compliance charts
- **Impact**: Professional data visualization

```swift
import Charts

Chart(data) { point in
    LineMark(
        x: .value("Date", point.date),
        y: .value("Value", point.value)
    )
    .foregroundStyle(Color(hex: "#F97316"))
}
```

### 3. **PDFKit** (Native)
- **Why**: View generated PDFs (proof packs, reports)
- **Type**: Native framework
- **Usage**: PDF viewer for proof packs
- **Impact**: Makes the app feel "real" and professional

```swift
import PDFKit

// UIViewRepresentable wrapper for SwiftUI
struct PDFKitView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        return view
    }
    
    func updateUIView(_ view: PDFView, context: Context) {
        view.document = PDFDocument(url: url)
    }
}
```

### 4. **PhotosUI** (Native)
- **Why**: Native photo picker for job photos
- **Type**: Native framework
- **Usage**: Upload job photos
- **Impact**: Native iOS feel

```swift
import PhotosUI

@State private var selectedItem: PhotosPickerItem?

PhotosPicker(selection: $selectedItem, matching: .images) {
    RMPrimaryButton(title: "Add Photos") {}
}
```

---

## 🎨 Motion & Polish (Pick One)

### Option A: **Lottie** (Simple, Fast)
- **Why**: Clean loading/empty/success animations
- **Package**: `https://github.com/airbnb/lottie-ios`
- **Usage**: Loading states, empty states, success animations
- **Best for**: Quick polish, less interactive

### Option B: **Rive** (Premium, Interactive) ⭐ Recommended
- **Why**: Interactive animations, designer-friendly
- **Package**: `https://github.com/rive-app/rive-ios`
- **Usage**: Hero animations, interactive UI elements
- **Best for**: Premium feel, complex animations

**Recommendation**: Start with Lottie (simpler), upgrade to Rive if you want more interactive polish.

---

## 🛠️ Development Tools (Recommended)

### 5. **SwiftLint** (Code Quality)
- **Why**: Keeps codebase consistent
- **Package**: `https://github.com/realm/SwiftLint`
- **Usage**: Enforce Swift style guide
- **Impact**: Professional codebase

### 6. **SwiftGen** (Code Generation)
- **Why**: Type-safe assets, colors, strings
- **Package**: `https://github.com/SwiftGen/SwiftGen`
- **Usage**: Generate typed code from assets
- **Impact**: No more hardcoded strings/colors

---

## 📋 Feature-by-Feature Implementation

### Dashboard (Operations Tab)
**Dependencies**:
- ✅ Swift Charts (native)
- ✅ Kingfisher (images)
- ✅ SwiftUI (layout)

**Components Needed**:
- `RMKpiCard` - KPI tiles with trend indicators
- `RMTrendChart` - Line chart for compliance trend
- `RMActivityRow` - Recent activity preview

### Audit Feed
**Dependencies**:
- ✅ SwiftDate (optional, for relative dates)
- ✅ Kingfisher (thumbnails)
- ✅ SwiftUI (lists)

**Components Needed**:
- `RMAuditRow` - Event row with category pill, timestamp
- `RMCategoryBadge` - Category indicator (governance/operations/access)
- `RMAuditFilter` - Filter bar

### PDF Viewer
**Dependencies**:
- ✅ PDFKit (native)
- ✅ URLSession (download)

**Components Needed**:
- `RMPDFViewer` - Full-screen PDF viewer
- `RMPDFToolbar` - Share, download, close buttons

### Photo Upload
**Dependencies**:
- ✅ PhotosUI (native)
- ✅ ImageIO (native, compression)
- ✅ Supabase Swift (upload)

**Components Needed**:
- `RMPhotoPicker` - Multi-select photo picker
- `RMPhotoGrid` - Thumbnail grid with delete
- `RMUploadProgress` - Upload progress indicator

---

## 🚀 Implementation Priority

### Phase 1: Core Polish (Do First)
1. ✅ **Kingfisher** - Add for all image loading
2. ✅ **Swift Charts** - Dashboard trend chart
3. ✅ **PDFKit** - Proof pack viewer
4. ✅ **PhotosUI** - Photo picker

### Phase 2: Motion (Add After Core)
5. ⭐ **Lottie** OR **Rive** - Loading/empty states
6. ✅ **SwiftUI Animations** - Transitions, matchedGeometryEffect

### Phase 3: Developer Experience
7. ✅ **SwiftLint** - Code quality
8. ✅ **SwiftGen** - Type-safe assets

---

## 🎯 "Premium Feel" Checklist

### Design System ✅
- [x] DesignSystem.swift with tokens
- [x] RMGlassCard component
- [x] RMAuthTextField component
- [x] RMPrimaryButton component
- [ ] RMTopNav component
- [ ] RMListRow component

### Native Depth
- [x] Material blur (.ultraThinMaterial)
- [x] Haptic feedback on buttons
- [x] Focus rings on inputs
- [ ] Skeleton loading states
- [ ] Pull-to-refresh
- [ ] Smooth page transitions

### Sharp Web Glass
- [x] Dark tint overlay
- [x] Crisp outer border
- [x] Inner glass highlight
- [x] Tight shadows

### Real Screens (Not Placeholders)
- [ ] Dashboard with real KPIs + chart
- [ ] Audit feed with real events
- [ ] Account page with org editing
- [ ] PDF viewer for proof packs

---

## 📝 Quick Start: Add Packages

### In Xcode:

1. **File** → **Add Package Dependencies...**

2. **Add Kingfisher**:
   ```
   URL: https://github.com/onevcat/Kingfisher
   Version: Up to Next Major (6.0.0)
   ```

3. **Add Lottie** (or Rive):
   ```
   URL: https://github.com/airbnb/lottie-ios
   Version: Up to Next Major (4.0.0)
   ```

4. **Add SwiftLint** (as build tool):
   ```
   URL: https://github.com/realm/SwiftLint
   Version: Latest
   ```

---

## 🎨 What NOT to Add (Yet)

**Skip for now**:
- ❌ Alamofire (URLSession is fine)
- ❌ Heavy 3D libraries (SceneKit/RealityKit) - not needed
- ❌ Complex animation frameworks - SwiftUI is enough
- ❌ State management libraries - Combine is fine

**Add later if needed**:
- SwiftDate (only if date formatting becomes complex)
- SwiftUI-Introspect (only if you need to style TabBar beyond SwiftUI limits)

---

## 💡 Pro Tips

1. **Start with native**: Use SwiftUI, Combine, URLSession first
2. **Add packages incrementally**: Don't add everything at once
3. **One polished flow**: Focus on Login → Dashboard → Audit → PDF viewer
4. **Test on device**: Camera, notifications, haptics need real device
5. **iOS 16+**: Target iOS 16+ for Swift Charts (or use Charts library for iOS 15)

---

## 🎯 Next Steps

1. **Add Kingfisher** (5 minutes)
2. **Build DashboardView** with Swift Charts (30 minutes)
3. **Build AuditFeedView** with real data (30 minutes)
4. **Add PDFKit viewer** for proof packs (20 minutes)
5. **Add Lottie** for loading states (15 minutes)

**Total**: ~2 hours to go from "placeholder" to "real product feel"

---

## 📚 Package URLs (Copy-Paste Ready)

```bash
# Essential
https://github.com/onevcat/Kingfisher

# Motion (pick one)
https://github.com/airbnb/lottie-ios
https://github.com/rive-app/rive-ios

# Dev Tools
https://github.com/realm/SwiftLint
https://github.com/SwiftGen/SwiftGen
```

---

## 🎨 Matching Web Features

| Web Feature | iOS Solution | Package |
|------------|--------------|---------|
| Charts | Swift Charts | Native (iOS 16+) |
| PDF Viewing | PDFKit | Native |
| Image Loading | Kingfisher | SPM |
| Photo Picker | PhotosUI | Native |
| Animations | SwiftUI + Lottie | Native + SPM |
| Date Formatting | Foundation/SwiftDate | Native/Optional |
| State Management | Combine | Native |
| Networking | URLSession | Native |

---

**Remember**: Premium comes from **polish + consistency**, not library count. Focus on one complete flow first (Login → Dashboard → Audit → PDF), then expand.
