import SwiftUI

/// Field Dashboard - Action-first operations hub for field users
struct OperationsView: View {
    @StateObject private var jobsStore = JobsStore.shared
    @StateObject private var serverStatus = ServerStatusManager.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @AppStorage("user_role") private var userRole: String = ""
    @State private var selectedView: OperationsViewType = .dashboard
    @State private var searchQuery: String = ""
    
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
                    // Field users get action-first dashboard (premium redesign)
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                            // Header with sync status
                            HStack {
                                Text("Operations")
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundStyle(RMTheme.Colors.textPrimary)
                                
                                Spacer()
                                
                                SyncChip(isSynced: serverStatus.isHealthy)
                            }
                            .padding(.top, RMTheme.Spacing.xl)
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // Search Bar
                            RMSearchBar(text: $searchQuery, placeholder: "Search jobs…")
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // Quick Actions (Add Evidence primary, New Job secondary)
                            HStack(spacing: RMTheme.Spacing.md) {
                                RMButton(
                                    title: "Add Evidence",
                                    icon: "camera.fill",
                                    style: .primary
                                ) {
                                    quickAction.presentEvidence(jobId: nil)
                                }
                                .frame(maxWidth: .infinity)
                                
                                RMButton(
                                    title: "New Job",
                                    icon: "plus",
                                    style: .secondary
                                ) {
                                    // TODO: Route to Create Job
                                    print("[OperationsView] TODO: Navigate to Create Job")
                                }
                                .frame(width: 160)
                            }
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // My Active Jobs
                            if !activeJobs.isEmpty {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                    HStack {
                                        Text("My Active Jobs")
                                            .font(.system(size: 22, weight: .bold, design: .rounded))
                                            .foregroundStyle(RMTheme.Colors.textPrimary)
                                        
                                        Spacer()
                                        
                                        Text("\(activeJobs.count)")
                                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                                            .foregroundStyle(RMTheme.Colors.textTertiary)
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                    
                                    VStack(spacing: RMTheme.Spacing.md) {
                                        ForEach(activeJobs) { job in
                                            NavigationLink {
                                                JobDetailView(jobId: job.id)
                                            } label: {
                                                JobCard(job: job) {
                                                    // Navigation handled by NavigationLink
                                                }
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                }
                            }
                            
                            // Empty State
                            if activeJobs.isEmpty && !jobsStore.isLoading {
                                RMEmptyState(
                                    icon: "briefcase",
                                    title: searchQuery.isEmpty ? "No Active Jobs" : "No Results",
                                    message: searchQuery.isEmpty 
                                        ? "Create your first job to get started" 
                                        : "Try adjusting your search"
                                )
                                .padding(.vertical, RMTheme.Spacing.xxl)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            }
                        }
                        .padding(.bottom, 120) // Room for tab bar + FAB
                    }
                    .background(RMTheme.Colors.background.ignoresSafeArea())
                }
            }
            .rmNavigationBar(title: "Operations")
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
