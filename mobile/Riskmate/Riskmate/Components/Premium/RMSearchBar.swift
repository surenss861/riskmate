import SwiftUI

/// System-native search bar component. Mic opens voice dictation sheet (RMSheetShell).
struct RMSearchBar: View {
    @Binding var text: String
    let placeholder: String
    var showMic: Bool = true
    var voiceHint: String? = "Try saying: \"Show high risk jobs\""

    @StateObject private var dictation = VoiceDictationService()
    @State private var showDictationSheet = false

    var body: some View {
        HStack(spacing: RMSystemTheme.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RMSystemTheme.Colors.textTertiary)
                .font(.system(size: 16))

            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .foregroundStyle(RMSystemTheme.Colors.textPrimary)
                .font(RMSystemTheme.Typography.body)
            if showMic {
                Button {
                    Haptics.tap()
                    Task {
                        let authorized = await dictation.requestPermission()
                        if authorized {
                            dictation.start()
                            showDictationSheet = true
                        } else if let msg = dictation.errorMessage {
                            ToastCenter.shared.show(msg, systemImage: "mic.slash", style: .error)
                        } else if let hint = voiceHint {
                            ToastCenter.shared.show(hint, systemImage: "mic.fill", style: .info)
                        }
                    }
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(RMTheme.Colors.accent)
                }
                .accessibilityLabel("Voice search")
            }
        }
        .padding(.horizontal, RMSystemTheme.Spacing.md)
        .frame(height: 44)
        .background(
            RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md, style: .continuous)
                .fill(RMSystemTheme.Colors.secondaryBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: RMSystemTheme.Radius.md, style: .continuous)
                        .stroke(RMSystemTheme.Colors.separator, lineWidth: 0.5)
                )
        )
        .sheet(isPresented: $showDictationSheet) {
            dictationSheet
        }
        .onChange(of: showDictationSheet) { _, isVisible in
            if !isVisible && dictation.isListening {
                dictation.stop()
            }
        }
    }

    private var dictationSheet: some View {
        RMSheetShell(
            title: "Voice search",
            subtitle: dictation.isListening ? "Listening…" : "Speak to search",
            onClose: {
                dictation.stop()
                if !dictation.transcript.isEmpty {
                    text = dictation.transcript
                }
                showDictationSheet = false
            }
        ) {
            VStack(spacing: RMTheme.Spacing.lg) {
                Text(dictation.transcript.isEmpty ? "Say something like \"high risk jobs\" or \"blockers\"…" : dictation.transcript)
                    .font(RMTheme.Typography.body)
                    .foregroundColor(dictation.transcript.isEmpty ? RMTheme.Colors.textTertiary : RMTheme.Colors.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(RMTheme.Spacing.md)
                    .background(RMTheme.Colors.surface.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.sm, style: .continuous))
                    .multilineTextAlignment(.leading)

                if let err = dictation.errorMessage {
                    Text(err)
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.error)
                }

                Button {
                    Haptics.tap()
                    dictation.stop()
                    if !dictation.transcript.isEmpty {
                        text = dictation.transcript
                    }
                    showDictationSheet = false
                } label: {
                    Text("Stop and use")
                        .font(RMTheme.Typography.bodyBold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RMTheme.Spacing.md)
                }
                .background(RMTheme.Colors.accent)
                .foregroundColor(.black)
                .clipShape(RoundedRectangle(cornerRadius: RMTheme.Radius.md, style: .continuous))
                .padding(.horizontal, RMTheme.Spacing.pagePadding)
            }
            .padding(RMTheme.Spacing.pagePadding)
        }
    }
}
