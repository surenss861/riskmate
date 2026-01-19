# Evidence Offline Status Implementation

## Requirement
Show precise offline status in evidence capture flow:
- "Queued for upload"
- "Synced"
- "Failed — tap to retry"

## Implementation Location
- `mobile/Riskmate/Riskmate/Views/Evidence/EvidenceCaptureSheet.swift`
- `mobile/Riskmate/Riskmate/Services/BackgroundUploadManager.swift`

## Status Display
Add small status line below evidence capture button showing upload state from `BackgroundUploadManager.shared.uploads`.
