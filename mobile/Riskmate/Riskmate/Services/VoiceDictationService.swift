import Combine
import Foundation
import Speech
import AVFoundation

/// Voice dictation for search (e.g. RMSearchBar). Uses SFSpeechRecognizer + AVAudioEngine.
/// Reduce Motion: no waveform; just state changes + text.
/// @MainActor ensures @Published mutations are safe and observable from SwiftUI.
@MainActor
final class VoiceDictationService: ObservableObject {
    @Published private(set) var isListening = false
    @Published private(set) var transcript = ""
    @Published private(set) var errorMessage: String?

    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }

    /// Request speech recognition and microphone authorization. Returns true if authorized.
    func requestPermission() async -> Bool {
        await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                Task { @MainActor in
                    switch status {
                    case .authorized:
                        cont.resume(returning: true)
                    case .denied:
                        self.errorMessage = "Speech recognition denied"
                        Analytics.shared.trackVoicePermissionDenied()
                        cont.resume(returning: false)
                    case .restricted:
                        self.errorMessage = "Speech recognition restricted"
                        Analytics.shared.trackVoicePermissionDenied()
                        cont.resume(returning: false)
                    case .notDetermined:
                        cont.resume(returning: false)
                    @unknown default:
                        cont.resume(returning: false)
                    }
                }
            }
        }
    }

    func start() {
        guard recognizer != nil else {
            errorMessage = "Speech recognition not available"
            return
        }
        guard !isListening else { return }

        errorMessage = nil
        transcript = ""

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            errorMessage = "Microphone access failed"
            return
        }

        request = SFSpeechAudioBufferRecognitionRequest()
        guard let request = request else { return }
        request.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            inputNode.removeTap(onBus: 0)
            self.request = nil
            errorMessage = "Could not start microphone"
            return
        }

        task = recognizer?.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                if let result = result {
                    self?.transcript = result.bestTranscription.formattedString
                    if result.isFinal {
                        self?.stop()
                    }
                }
                if error != nil {
                    self?.stop()
                }
            }
        }

        isListening = true
        Haptics.impact(.light)
        Task { @MainActor in
            Analytics.shared.trackVoiceStart()
        }
    }

    func stop() {
        guard isListening else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        isListening = false
        Haptics.impact(.light)
        Task { @MainActor in
            Analytics.shared.trackVoiceStop()
        }
    }
}
