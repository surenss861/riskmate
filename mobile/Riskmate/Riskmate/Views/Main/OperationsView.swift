import SwiftUI

/// Field Dashboard - Action-first operations hub for field users
struct OperationsView: View {
    @StateObject private var jobsStore = JobsStore.shared
    @EnvironmentObject private var quickAction: QuickActionRouter
    @AppStorage("user_role") private var userRole: String = ""
    @State private var selectedView: OperationsViewType = .dashboard
    @State private var searchQuery: String = ""
    
    var filteredJobs: [Job] {
        if searchQuery.isEmpty {
            return jobsStore.jobs
        }
        return jobsStore.jobs.filter { job in
            (job.clientName ?? "").localizedCaseInsensitiveContains(searchQuery) ||
            (job.location ?? "").localizedCaseInsensitiveContains(searchQuery) ||
            (job.jobType ?? "").localizedCaseInsensitiveContains(searchQuery)
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
                    // Field users get action-first dashboard
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.lg) {
                            // Search Bar
                            TextField("Search jobs…", text: $searchQuery)
                                .textFieldStyle(.roundedBorder)
                                .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // Quick Actions (Big tap targets)
                            HStack(spacing: RMTheme.Spacing.md) {
                                Button {
                                    quickAction.presentEvidence(jobId: nil)
                                } label: {
                                    Label("Add Evidence", systemImage: "camera.fill")
                                        .frame(maxWidth: .infinity)
                                        .font(RMTheme.Typography.bodyBold)
                                }
                                .buttonStyle(.borderedProminent)
                                .controlSize(.large)
                                
                                Button {
                                    // TODO: Route to Create Job
                                    print("[OperationsView] TODO: Navigate to Create Job")
                                } label: {
                                    Label("New Job", systemImage: "plus")
                                        .frame(maxWidth: .infinity)
                                        .font(RMTheme.Typography.bodyBold)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.large)
                            }
                            .padding(.horizontal, RMTheme.Spacing.pagePadding)
                            
                            // My Active Jobs
                            if !activeJobs.isEmpty {
                                VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                                    Text("My Active Jobs")
                                        .font(RMTheme.Typography.sectionHeader)
                                        .padding(.horizontal, RMTheme.Spacing.pagePadding)
                                    
                                    VStack(spacing: RMTheme.Spacing.sm) {
                                        ForEach(activeJobs) { job in
                                            NavigationLink {
                                                JobDetailView(jobId: job.id)
                                            } label: {
                                                RMJobRow(job: job)
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
                            }
                        }
                        .padding(.vertical, RMTheme.Spacing.md)
                    }
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
