import SwiftUI

/// Operations Hub - Dashboard with segmented control for Execs
struct OperationsView: View {
    @State private var selectedView: OperationsViewType = .dashboard
    @AppStorage("user_role") private var userRole: String = ""
    
    var body: some View {
        RMBackground()
            .overlay {
                VStack(spacing: 0) {
                    // Segmented Control (for Execs to land on Defensibility)
                    if userRole == "executive" {
                        Picker("View", selection: $selectedView) {
                            Text("Dashboard").tag(OperationsViewType.dashboard)
                            Text("Defensibility").tag(OperationsViewType.defensibility)
                        }
                        .pickerStyle(.segmented)
                        .padding(RMTheme.Spacing.pagePadding)
                    }
                    
                    // Content
                    Group {
                        switch selectedView {
                        case .dashboard:
                            DashboardView()
                        case .defensibility:
                            ExecutiveViewRedesigned()
                        }
                    }
                }
            }
            .rmNavigationBar(title: "Operations")
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
