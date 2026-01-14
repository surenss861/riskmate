import SwiftUI

struct AuditView: View {
    var body: some View {
        NavigationView {
            List {
                Text("Audit Log")
                    .font(.title2)
                    .fontWeight(.semibold)
            }
            .navigationTitle("Audit")
        }
    }
}

#Preview {
    AuditView()
}
