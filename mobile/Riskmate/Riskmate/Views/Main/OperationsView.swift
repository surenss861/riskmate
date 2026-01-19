import SwiftUI

/// Field Dashboard - Action-first operations hub for field users
struct OperationsView: View {
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var serverStatus = ServerStatusManager.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @AppStorage("user_role") private var userRole: String = ""
    @State private var selectedView: OperationsViewType = .dashboard
    @State private var searchQuery: String = ""
    
    private func relativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
    
    var filteredJobs: [Job] {
        if searchQuery.isEmpty {
            return jobsStore.jobs
        }
        return jobsStore.jobs.filter { job in
            job.clientName.localizedCaseInsensitiveContains(searchQuery) ||
            job.location.localizedCaseInsensitiveContains(searchQuery) ||
            job.jobType.localizedCaseInsensitiveContains(searchQuery)
        }
    }
    
    var activeJobs: [Job] {
        filteredJobs.filter { job in
            job.status.lowercased() != "completed" && job.status.lowercased() != "cancelled"
        }.prefix(6).map { $0 }
    }
    
    var highRiskJobs: [Job] {
        filteredJobs.filter { (job.riskScore ?? 0) >= 80 }
    }
    
    var missingEvidenceJobs: [Job] {
        // TODO: Wire to actual evidence check
        []
    }
    
    private func handleKPITap(_ type: KPIType) {
        // TODO: Navigate to filtered list
        switch type {
        case .active:
            searchQuery = ""
        case .highRisk:
            // Filter to high risk
            break
        case .missingEvidence:
            // Filter to missing evidence
            break
        }
    }
    
    var body: some View {
        RMBackground()
            .overlay {
                // Execs get full dashboard with segmented control
                if userRole == "executive" {
                    VStack(spacing: 0) {
                        Picker("View", selection: $selectedView) {
                            Text("Dashboard").tag(OperationsViewType.dashboard)
                            Text("Defensibility").tag(OperationsViewType.defensibility)
                        }
                        .pickerStyle(.segmented)
                        .padding(RMTheme.Spacing.pagePadding)
                        
                        Group {
                            switch selectedView {
                            case .dashboard:
                                DashboardView()
                            case .defensibility:
                                ExecutiveViewRedesigned()
                            }
                        }
                    }
                } else {
                    // Field users get List-native Operations (Apple-style)
                    List {
                            // Primary Action Section
                            Section {
                                RMButton(
                                    title: "Add Evidence",
                                    icon: "camera.fill",
                                    style: .primary
                                ) {
                                    quickAction.presentEvidence(jobId: nil)
                                }
                                .listRowInsets(EdgeInsets(
                                    top: RMSystemTheme.Spacing.sm,
                                    leading: 0,
                                    bottom: RMSystemTheme.Spacing.sm,
                                    trailing: 0
                                ))
                                .listRowBackground(Color.clear)
                            }
                            
                            // Active Jobs Section
                            if jobsStore.isLoading && activeJobs.isEmpty {
                                Section {
                                    ForEach(0..<3, id: \.self) { _ in
                                        HStack(spacing: RMSystemTheme.Spacing.md) {
                                            Circle()
                                                .fill(RMSystemTheme.Colors.tertiaryBackground)
                                                .frame(width: 8, height: 8)
                                            
                                            VStack(alignment: .leading, spacing: 4) {
                                                RoundedRectangle(cornerRadius: 4)
                                                    .fill(RMSystemTheme.Colors.tertiaryBackground)
                                                    .frame(height: 16)
                                                    .frame(maxWidth: 200)
                                                
                                                RoundedRectangle(cornerRadius: 4)
                                                    .fill(RMSystemTheme.Colors.tertiaryBackground)
                                                    .frame(height: 12)
                                                    .frame(maxWidth: 150)
                                            }
                                            
                                            Spacer()
                                        }
                                        .padding(.vertical, 4)
                                    }
                                } header: {
                                    Text("Active Jobs")
                                }
                            } else if !activeJobs.isEmpty {
                                Section {
                                    ForEach(activeJobs) { job in
                                        NavigationLink {
                                            JobDetailView(jobId: job.id)
                                        } label: {
                                            JobRow(
                                                job: job,
                                                onAddEvidence: {
                                                    quickAction.presentEvidence(jobId: job.id)
                                                },
                                                onMarkComplete: {
                                                    // TODO: Mark complete
                                                    ToastCenter.shared.show("Marked complete", systemImage: "checkmark.circle", style: .success)
                                                }
                                            )
                                        }
                                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                            Button {
                                                Haptics.tap()
                                                quickAction.presentEvidence(jobId: job.id)
                                            } label: {
                                                Label("Add Evidence", systemImage: "camera.fill")
                                            }
                                            .tint(RMSystemTheme.Colors.accent)
                                            
                                            Button {
                                                Haptics.tap()
                                                ToastCenter.shared.show("Marked complete", systemImage: "checkmark.circle", style: .success)
                                            } label: {
                                                Label("Complete", systemImage: "checkmark.circle.fill")
                                            }
                                            .tint(RMSystemTheme.Colors.success)
                                        }
                                    }
                                } header: {
                                    OperationsHeaderView(
                                        activeCount: activeJobs.count,
                                        highRiskCount: highRiskJobs.count,
                                        missingEvidenceCount: missingEvidenceJobs.count,
                                        lastSync: jobsStore.lastSyncDate,
                                        onKPITap: handleKPITap
                                    )
                                } footer: {
                                    if activeJobs.count < filteredJobs.count {
                                        Text("Showing \(activeJobs.count) of \(filteredJobs.count) jobs")
                                            .font(RMSystemTheme.Typography.caption)
                                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                                    }
                                }
                            } else if !jobsStore.isLoading {
                                Section {
                                    VStack(spacing: RMSystemTheme.Spacing.md) {
                                        Image(systemName: "briefcase")
                                            .font(.system(size: 48))
                                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                                        
                                        Text(searchQuery.isEmpty ? "No Active Jobs" : "No Results")
                                            .font(RMSystemTheme.Typography.headline)
                                            .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                                        
                                        Text(searchQuery.isEmpty 
                                            ? "Create your first job to get started" 
                                            : "Try adjusting your search")
                                            .font(RMSystemTheme.Typography.subheadline)
                                            .foregroundStyle(RMSystemTheme.Colors.textSecondary)
                                            .multilineTextAlignment(.center)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, RMSystemTheme.Spacing.xl)
                                    .listRowInsets(EdgeInsets())
                                    .listRowBackground(Color.clear)
                                }
                            }
                        }
                        .listStyle(.insetGrouped)
                        .searchable(text: $searchQuery, prompt: "Search jobs")
                        .refreshable {
                            Haptics.tap()
                            _ = try? await jobsStore.fetch(forceRefresh: true)
                        }
                }
            }
            .rmNavigationBar(title: "Operations")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Haptics.tap()
                        // TODO: Route to Create Job
                        print("[OperationsView] TODO: Navigate to Create Job")
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(RMSystemTheme.Colors.accent)
                    }
                }
            }
            .task {
                // Load jobs if needed
                if jobsStore.jobs.isEmpty {
                    _ = try? await jobsStore.fetch(forceRefresh: false)
                }
            }
            .onAppear {
                // Execs land on Defensibility by default
                if userRole == "executive" && selectedView == .dashboard {
                    selectedView = .defensibility
                }
            }
    }
}

enum OperationsViewType {
    case dashboard
    case defensibility
}


#Preview {
    OperationsView()
}
