# RiskMate iOS App

SwiftUI app that connects to RiskMate backend API.

## Architecture

- **SwiftUI** - Modern declarative UI
- **Supabase Swift** - Authentication and session management
- **URLSession** - API networking (simple, reliable)
- **MVVM** - Clean separation of concerns

## Project Structure

```
mobile/Riskmate/Riskmate/
├── RiskmateApp.swift          # App entry point
├── Config.swift               # Config loader
├── Config.plist              # Backend URL, Supabase config
├── Models/                    # Data models
│   ├── Organization.swift
│   └── User.swift
├── Services/                  # Business logic
│   ├── AuthService.swift      # Supabase auth wrapper
│   ├── APIClient.swift        # Backend API client
│   └── SessionManager.swift   # Session state management
└── Views/                     # SwiftUI views
    ├── Auth/
    │   └── LoginView.swift
    └── Main/
        ├── ContentView.swift  # Tab bar container
        ├── OperationsView.swift
        ├── AuditView.swift
        └── AccountView.swift
```

## Configuration

### Backend URL
Set `BACKEND_URL` in `Config.plist`:
- Production: `https://api.riskmate.dev`
- Or: `https://riskmate.dev` (if using Next.js proxy)

### Supabase
Set Supabase credentials in `Config.plist`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## API Endpoints Used

- `GET /api/account/organization` - Get organization info
- `PATCH /api/account/organization` - Update organization name
- `GET /api/audit/events` - Get audit log feed
- `POST /api/audit/export/pack` - Generate proof pack

## Authentication Flow

1. User logs in with Supabase (email/password)
2. App stores session token
3. All API requests include `Authorization: Bearer <token>`
4. Backend validates token via Supabase

## Getting Started

1. Open `Riskmate.xcodeproj` in Xcode
2. Add Supabase Swift package: `https://github.com/supabase/supabase-swift`
3. Configure `Config.plist` with backend URL and Supabase credentials
4. Build and run
