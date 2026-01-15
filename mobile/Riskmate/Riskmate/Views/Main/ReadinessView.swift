import SwiftUI
import SwiftDate

/// Audit Readiness View - Actionable checklist for audit-ready governance
struct ReadinessView: View {
    @State private var readinessData: ReadinessResponse?
    @State private var isLoading = true
    @State private var selectedCategory: ReadinessCategory? = nil
    @State private var selectedSeverity: ReadinessSeverity? = nil
    @State private var showingFixQueue = false
    @State private var fixQueueItems: [ReadinessItem] = []
    
    var filteredItems: [ReadinessItem] {
        guard let data = readinessData else { return [] }
        var items = data.items
        
        if let category = selectedCategory {
            items = items.filter { $0.category == category }
        }
        
        if let severity = selectedSeverity {
            items = items.filter { $0.severity == severity }
        }
        
        return items
    }
    
    var categoryCounts: [ReadinessCategory: Int] {
        guard let data = readinessData else { return [:] }
        return Dictionary(grouping: data.items, by: { $0.category })
            .mapValues { $0.count }
    }
    
    var body: some View {
        RMBackground()
            .overlay {
                if isLoading {
                    ScrollView {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            RMSkeletonCard()
                            RMSkeletonCard()
                            RMSkeletonList(count: 5)
                        }
                        .padding(RMTheme.Spacing.md)
                    }
                } else if let data = readinessData {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: RMTheme.Spacing.lg) {
                            // Header
                            VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                                Text("Audit Readiness")
                                    .font(RMTheme.Typography.largeTitle)
                                    .foregroundColor(RMTheme.Colors.textPrimary)
                                
                                Text("What's missing for audit?")
                                    .font(RMTheme.Typography.bodySmall)
                                    .foregroundColor(RMTheme.Colors.textSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, RMTheme.Spacing.md)
                            .padding(.top, RMTheme.Spacing.md)
                            
                            // Score Card
                            ReadinessScoreCard(data: data)
                                .padding(.horizontal, RMTheme.Spacing.md)
                            
                            // Category Tabs
                            CategoryTabsView(
                                selectedCategory: $selectedCategory,
                                counts: categoryCounts
                            )
                            .padding(.horizontal, RMTheme.Spacing.md)
                            
                            // Severity Filter
                            if !filteredItems.isEmpty {
                                SeverityFilterView(selectedSeverity: $selectedSeverity)
                                    .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Readiness Items List
                            if filteredItems.isEmpty {
                                RMEmptyState(
                                    icon: "checkmark.shield.fill",
                                    title: "All Clear",
                                    message: "No readiness items found for the selected filters"
                                )
                                .padding(.horizontal, RMTheme.Spacing.md)
                            } else {
                                VStack(spacing: RMTheme.Spacing.sm) {
                                    ForEach(filteredItems) { item in
                                        ReadinessItemRow(
                                            item: item,
                                            onAddToQueue: {
                                                if !fixQueueItems.contains(where: { $0.id == item.id }) {
                                                    fixQueueItems.append(item)
                                                    let generator = UINotificationFeedbackGenerator()
                                                    generator.notificationOccurred(.success)
                                                }
                                            }
                                        )
                                    }
                                }
                                .padding(.horizontal, RMTheme.Spacing.md)
                            }
                            
                            // Footer CTAs
                            if data.criticalBlockers > 0 {
                                FooterCTAs(
                                    criticalCount: data.criticalBlockers,
                                    onViewLedger: {
                                        // Navigate to audit ledger
                                    },
                                    onGeneratePack: {
                                        // Generate proof pack
                                    }
                                )
                                .padding(.horizontal, RMTheme.Spacing.md)
                                .padding(.bottom, RMTheme.Spacing.lg)
                            }
                        }
                    }
                } else {
                    RMEmptyState(
                        icon: "exclamationmark.triangle",
                        title: "Failed to Load",
                        message: "Unable to load readiness data"
                    )
                }
            }
            .navigationTitle("Audit Readiness")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if !fixQueueItems.isEmpty {
                        Button {
                            showingFixQueue = true
                        } label: {
                            ZStack(alignment: .topTrailing) {
                                Image(systemName: "list.bullet.rectangle")
                                    .font(.system(size: 18))
                                
                                Text("\(fixQueueItems.count)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(4)
                                    .background(RMTheme.Colors.accent)
                                    .clipShape(Circle())
                                    .offset(x: 8, y: -8)
                            }
                        }
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                }
            }
            .task {
                await loadReadiness()
            }
            .refreshable {
                await loadReadiness()
            }
            .sheet(isPresented: $showingFixQueue) {
                FixQueueSheet(items: $fixQueueItems)
            }
    }
    
    private func loadReadiness() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            readinessData = try await APIClient.shared.getReadiness()
        } catch {
            print("[ReadinessView] Failed to load: \(error)")
            // TODO: Show error toast
        }
    }
}

// MARK: - Score Card

struct ReadinessScoreCard: View {
    let data: ReadinessResponse
    
    var scoreColor: Color {
        if data.score >= 80 { return RMTheme.Colors.success }
        if data.score >= 60 { return RMTheme.Colors.warning }
        return RMTheme.Colors.error
    }
    
    var body: some View {
        RMGlassCard {
            VStack(spacing: RMTheme.Spacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: RMTheme.Spacing.xs) {
                        Text("Audit-Ready Score")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                        
                        HStack(alignment: .firstTextBaseline, spacing: RMTheme.Spacing.xs) {
                            Text("\(data.score)")
                                .font(RMTheme.Typography.largeTitle)
                                .foregroundColor(scoreColor)
                            
                            Text("/ 100")
                                .font(RMTheme.Typography.title3)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                        }
                    }
                    
                    Spacer()
                }
                
                // Metrics Grid
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: RMTheme.Spacing.md) {
                    MetricCell(title: "Total Items", value: "\(data.totalItems)")
                    MetricCell(title: "Critical", value: "\(data.criticalBlockers)", color: RMTheme.Colors.error)
                    MetricCell(title: "Material", value: "\(data.materialItems)", color: RMTheme.Colors.warning)
                }
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: RMTheme.Radius.xl)
                .stroke(scoreColor.opacity(0.3), lineWidth: 2)
        }
    }
}

struct MetricCell: View {
    let title: String
    let value: String
    var color: Color = RMTheme.Colors.textPrimary
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.xs) {
            Text(value)
                .font(RMTheme.Typography.title3)
                .foregroundColor(color)
            
            Text(title)
                .font(RMTheme.Typography.captionSmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Category Tabs

struct CategoryTabsView: View {
    @Binding var selectedCategory: ReadinessCategory?
    let counts: [ReadinessCategory: Int]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RMTheme.Spacing.sm) {
                // All tab
                CategoryTab(
                    title: "All",
                    count: counts.values.reduce(0, +),
                    isSelected: selectedCategory == nil
                ) {
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    selectedCategory = nil
                }
                
                ForEach(ReadinessCategory.allCases, id: \.self) { category in
                    CategoryTab(
                        title: category.rawValue,
                        count: counts[category] ?? 0,
                        isSelected: selectedCategory == category
                    ) {
                        let generator = UIImpactFeedbackGenerator(style: .light)
                        generator.impactOccurred()
                        selectedCategory = category
                    }
                }
            }
        }
    }
}

struct CategoryTab: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: RMTheme.Spacing.xs) {
                Text(title)
                    .font(RMTheme.Typography.bodySmallBold)
                
                Text("(\(count))")
                    .font(RMTheme.Typography.caption)
            }
            .foregroundColor(isSelected ? .black : RMTheme.Colors.textPrimary)
            .padding(.horizontal, RMTheme.Spacing.md)
            .padding(.vertical, RMTheme.Spacing.sm)
            .background(isSelected ? RMTheme.Colors.accent : RMTheme.Colors.inputFill)
            .clipShape(Capsule())
            .overlay {
                if !isSelected {
                    Capsule()
                        .stroke(RMTheme.Colors.border, lineWidth: 1)
                }
            }
        }
    }
}

// MARK: - Severity Filter

struct SeverityFilterView: View {
    @Binding var selectedSeverity: ReadinessSeverity?
    
    var body: some View {
        Picker("Severity", selection: $selectedSeverity) {
            Text("All").tag(nil as ReadinessSeverity?)
            Text("Critical").tag(ReadinessSeverity?.some(.critical))
            Text("Material").tag(ReadinessSeverity?.some(.material))
            Text("Info").tag(ReadinessSeverity?.some(.info))
        }
        .pickerStyle(.segmented)
        .onChange(of: selectedSeverity) {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
        }
    }
}

// MARK: - Readiness Item Row

struct ReadinessItemRow: View {
    let item: ReadinessItem
    let onAddToQueue: () -> Void
    
    var severityColor: Color {
        switch item.severity {
        case .critical: return RMTheme.Colors.error
        case .material: return RMTheme.Colors.warning
        case .info: return RMTheme.Colors.info
        }
    }
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                // Header
                HStack {
                    Image(systemName: severityIcon)
                        .foregroundColor(severityColor)
                        .font(.system(size: 16, weight: .semibold))
                    
                    Text(item.severity.rawValue.uppercased())
                        .font(RMTheme.Typography.captionBold)
                        .foregroundColor(.white)
                        .padding(.horizontal, RMTheme.Spacing.sm)
                        .padding(.vertical, RMTheme.Spacing.xs)
                        .background(severityColor)
                        .clipShape(Capsule())
                    
                    Text(item.ruleCode)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textTertiary)
                    
                    Spacer()
                    
                    Button {
                        onAddToQueue()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(RMTheme.Colors.accent)
                    }
                }
                
                // Rule Name
                Text(item.ruleName)
                    .font(RMTheme.Typography.bodyBold)
                    .foregroundColor(RMTheme.Colors.textPrimary)
                
                // Why it matters
                Text("Why it matters: \(item.whyItMatters)")
                    .font(RMTheme.Typography.bodySmall)
                    .foregroundColor(RMTheme.Colors.textSecondary)
                
                // Metadata
                HStack(spacing: RMTheme.Spacing.md) {
                    if let workRecord = item.workRecordName {
                        Label(workRecord, systemImage: "doc.text")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                    
                    if let owner = item.ownerName {
                        Label(owner, systemImage: "person")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                    
                    if let dueDate = item.dueDate,
                       let date = ISO8601DateFormatter().date(from: dueDate) {
                        Label(relativeTime(date), systemImage: "calendar")
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(RMTheme.Colors.textTertiary)
                    }
                }
                
                // Fix Action Button
                Button {
                    handleFixAction()
                } label: {
                    HStack {
                        Text(fixActionLabel)
                            .font(RMTheme.Typography.bodySmallBold)
                        
                        Spacer()
                        
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundColor(.black)
                    .padding(.vertical, RMTheme.Spacing.sm)
                    .padding(.horizontal, RMTheme.Spacing.md)
                    .background(RMTheme.Colors.accent)
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm))
                }
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: RMTheme.Radius.xl)
                .stroke(severityColor.opacity(0.3), lineWidth: item.severity == .critical ? 2 : 1)
        }
    }
    
    private var severityIcon: String {
        switch item.severity {
        case .critical: return "exclamationmark.triangle.fill"
        case .material: return "exclamationmark.circle.fill"
        case .info: return "info.circle.fill"
        }
    }
    
    private var fixActionLabel: String {
        switch item.fixActionType {
        case .uploadEvidence: return "Upload Evidence"
        case .requestAttestation: return "Request Attestation"
        case .completeControls: return "Complete Controls"
        case .resolveIncident: return "Resolve Incident"
        case .reviewItem: return "Review Item"
        }
    }
    
    private func handleFixAction() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
        // TODO: Navigate to appropriate action
    }
    
    private func relativeTime(_ date: Date) -> String {
        return date.toRelative(since: nil, dateTimeStyle: .named, unitsStyle: .short)
    }
}

// MARK: - Footer CTAs

struct FooterCTAs: View {
    let criticalCount: Int
    let onViewLedger: () -> Void
    let onGeneratePack: () -> Void
    
    var body: some View {
        VStack(spacing: RMTheme.Spacing.md) {
            Text("Resolve \(criticalCount) critical blocker\(criticalCount == 1 ? "" : "s") to improve your audit readiness")
                .font(RMTheme.Typography.bodySmall)
                .foregroundColor(RMTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            
            HStack(spacing: RMTheme.Spacing.md) {
                Button {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    onViewLedger()
                } label: {
                    Text("View Compliance Ledger")
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(RMTheme.Colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                        .overlay {
                            RoundedRectangle(cornerRadius: RMTheme.Radius.md)
                                .stroke(RMTheme.Colors.border, lineWidth: 1)
                        }
                }
                
                Button {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    onGeneratePack()
                } label: {
                    Text("Generate Proof Pack")
                        .font(RMTheme.Typography.bodyBold)
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                        .background(RMTheme.Colors.accent)
                        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                }
            }
        }
        .padding(RMTheme.Spacing.lg)
        .background(RMTheme.Colors.surface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.lg))
    }
}

// MARK: - Fix Queue Sheet

struct FixQueueSheet: View {
    @Binding var items: [ReadinessItem]
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            RMBackground()
                .overlay {
                    if items.isEmpty {
                        RMEmptyState(
                            icon: "list.bullet.rectangle",
                            title: "Fix Queue Empty",
                            message: "Add items from the readiness list to batch resolve them"
                        )
                    } else {
                        List {
                            ForEach(items) { item in
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                                    Text(item.ruleName)
                                        .font(RMTheme.Typography.bodyBold)
                                        .foregroundColor(RMTheme.Colors.textPrimary)
                                    
                                    Text(item.ruleCode)
                                        .font(RMTheme.Typography.caption)
                                        .foregroundColor(RMTheme.Colors.textSecondary)
                                }
                                .listRowBackground(RMTheme.Colors.surface.opacity(0.5))
                            }
                            .onDelete { indexSet in
                                items.remove(atOffsets: indexSet)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
                .navigationTitle("Fix Queue (\(items.count))")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Clear") {
                            items.removeAll()
                        }
                        .foregroundColor(RMTheme.Colors.error)
                    }
                    
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Done") {
                            dismiss()
                        }
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                    
                    if !items.isEmpty {
                        ToolbarItem(placement: .bottomBar) {
                            Button {
                                // TODO: Bulk resolve
                                let generator = UINotificationFeedbackGenerator()
                                generator.notificationOccurred(.success)
                            } label: {
                                Text("Bulk Resolve (\(items.count))")
                                    .font(RMTheme.Typography.bodyBold)
                                    .foregroundColor(.black)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, RMTheme.Spacing.md)
                                    .background(RMTheme.Colors.accent)
                                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md))
                            }
                        }
                    }
                }
        }
    }
}

// MARK: - Extensions

extension ReadinessSeverity? {
    static var none: ReadinessSeverity? { nil }
}

#Preview {
    NavigationStack {
        ReadinessView()
    }
}
