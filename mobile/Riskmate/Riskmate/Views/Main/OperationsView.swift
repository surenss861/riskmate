import SwiftUI

struct OperationsView: View {
    var body: some View {
        NavigationView {
            List {
                Text("Operations")
                    .font(.title2)
                    .fontWeight(.semibold)
            }
            .navigationTitle("Operations")
        }
    }
}

#Preview {
    OperationsView()
}
