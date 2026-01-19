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
                    // Field users get action-first dashboard (system-native)
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: RMSystemTheme.Spacing.lg) {
                            // Header with sync status
                            HStack {
                                Text("Operations")
                                    .font(RMSystemTheme.Typography.largeTitle)
                                    .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                                
                                Spacer()
                                
                                SyncChip(isSynced: serverStatus.isOnline)
                            }
                            .padding(.top, RMSystemTheme.Spacing.lg)
                            .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                            
                            // Search Bar
                            RMSearchBar(text: $searchQuery, placeholder: "Search jobs…")
                                .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                            
                            // Primary Action (one dominant CTA)
                            RMButton(
                                title: "Add Evidence",
                                icon: "camera.fill",
                                style: .primary
                            ) {
                                quickAction.presentEvidence(jobId: nil)
                            }
                            .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                            
                            // My Active Jobs
                            if !activeJobs.isEmpty {
                                VStack(alignment: .leading, spacing: RMSystemTheme.Spacing.md) {
                                    HStack {
                                        Text("My Active Jobs")
                                            .font(RMSystemTheme.Typography.title3)
                                            .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                                        
                                        Spacer()
                                        
                                        Text("\(activeJobs.count)")
                                            .font(RMSystemTheme.Typography.subheadline)
                                            .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                                    }
                                    .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                                    
                                    VStack(spacing: RMSystemTheme.Spacing.sm) {
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
                                    .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
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
                                .padding(.vertical, RMSystemTheme.Spacing.xl)
                                .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                            }
                        }
                        .padding(.bottom, 100) // Room for tab bar
                    }
                    .background(RMSystemTheme.Colors.background.ignoresSafeArea())
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
