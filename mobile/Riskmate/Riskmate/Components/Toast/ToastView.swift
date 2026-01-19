import SwiftUI
import UIKit

/// System-native toast view with UIKit blur
struct ToastView: View {
    let toast: Toast
    @State private var isVisible = false
    
    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            Image(systemName: toast.systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(toast.style.color)
            
            Text(toast.message)
                .font(RMSystemTheme.Typography.subheadline)
                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .padding(.vertical, RMSystemTheme.Spacing.sm)
        .background(
            VisualEffectBlur(style: .systemMaterial)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(RMSystemTheme.Colors.separator, lineWidth: 0.5)
                )
        )
        .shadow(color: .black.opacity(0.2), radius: 12, x: 0, y: 4)
        .opacity(isVisible ? 1 : 0)
        .offset(y: isVisible ? 0 : 20)
        .scaleEffect(isVisible ? 1.0 : 0.96)
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: isVisible)
        .onAppear {
            isVisible = true
        }
    }
}

/// Toast container - mount at app root
struct ToastContainer: View {
    @StateObject private var toastCenter = ToastCenter.shared
    
    var body: some View {
        ZStack {
            if let toast = toastCenter.currentToast {
                VStack {
                    Spacer()
                    ToastView(toast: toast)
                        .padding(.bottom, 100) // Above tab bar
                        .padding(.horizontal, RMSystemTheme.Spacing.pagePadding)
                }
            }
        }
    }
}
