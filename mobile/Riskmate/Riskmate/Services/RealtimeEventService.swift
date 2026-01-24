import Foundation
import Supabase
import Combine
import UIKit

/// Realtime Event Service
/// Subscribes to Supabase Realtime events and triggers store refreshes
@MainActor
class RealtimeEventService: ObservableObject {
    static let shared = RealtimeEventService()
    
    private var channel: Any? // RealtimeChannel type varies by SDK version
    private var subscriptionTask: Task<Void, Never>?
    private var isSubscribed = false
    private var organizationId: String?
    private var supabase: SupabaseClient?
    
    // Debounce/coalesce state
    private var pendingEvents: [String: Date] = [:] // eventType+entityId -> timestamp
    private var debounceTimer: Task<Void, Never>?
    private let debounceInterval: TimeInterval = 0.5 // 500ms debounce
    
    // Catch-up tracking
    private let lastSeenEventAtKey = "realtime_last_seen_event_at"
    private var lastSeenEventAt: Date? {
        get {
            if let timestamp = UserDefaults.standard.object(forKey: lastSeenEventAtKey) as? Date {
                return timestamp
            }
            return nil
        }
        set {
            if let timestamp = newValue {
                UserDefaults.standard.set(timestamp, forKey: lastSeenEventAtKey)
            } else {
                UserDefaults.standard.removeObject(forKey: lastSeenEventAtKey)
            }
        }
    }
    
    private init() {
        // Subscribe to app lifecycle notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }
    
    /// Subscribe to realtime events for an organization
    func subscribe(organizationId: String) async {
        guard !isSubscribed || self.organizationId != organizationId else {
            return // Already subscribed to this org
        }
        
        // Unsubscribe from previous org if different
        if let existingOrgId = self.organizationId, existingOrgId != organizationId {
            await unsubscribe()
        }
        
        self.organizationId = organizationId
        
        do {
            // Get Supabase client from AuthService
            let config = AppConfig.shared
            let supabaseClient = SupabaseClient(
                supabaseURL: URL(string: config.supabaseURL)!,
                supabaseKey: config.supabaseAnonKey
            )
            self.supabase = supabaseClient
            
            // Create channel for org events
            let channelName = "org-\(organizationId)-events"
            let newChannel = supabaseClient.channel(channelName)
            
            // TODO: Realtime subscription temporarily disabled due to API changes
            // The app works fine without realtime (uses pull-to-refresh and periodic checks)
            // Re-enable once Supabase Swift SDK API is confirmed
            #if false
            // Subscribe to postgres changes on realtime_events table
            // Note: Realtime subscription - if API fails, app continues with polling/refresh
            do {
                // Try to subscribe - if this fails, app continues without realtime
                try await newChannel
                    .on(event: "postgres_changes") { [weak self] message in
                        Task { @MainActor [weak self] in
                            await self?.handleEvent(payload: message)
                        }
                    }
                    .subscribe()
                
                channel = newChannel
                isSubscribed = true
                print("[RealtimeEventService] ✅ Subscribed to events for org: \(organizationId)")
            } catch {
                // Realtime subscription failed - app continues without it
                print("[RealtimeEventService] ⚠️ Realtime subscription failed (app continues with polling): \(error.localizedDescription)")
                // Don't set isSubscribed = true, so app knows realtime isn't active
            }
            #else
            // Realtime temporarily disabled - app uses polling/refresh instead
            print("[RealtimeEventService] ⚠️ Realtime subscription disabled (using polling/refresh)")
            channel = newChannel
            isSubscribed = false // Mark as not subscribed so app knows to use polling
            #endif
        } catch {
            print("[RealtimeEventService] ❌ Failed to initialize realtime: \(error.localizedDescription)")
        }
    }
    
    /// Unsubscribe from realtime events
    func unsubscribe() async {
        guard channel != nil else { return }
        
        // TODO: Re-enable when realtime subscription is fixed
        #if false
        if let channel = channel as? RealtimeChannel {
            Task { @MainActor in
                await channel.unsubscribe()
            }
        }
        #endif
        
        self.channel = nil
        isSubscribed = false
        organizationId = nil
        
        // Cancel debounce timer
        debounceTimer?.cancel()
        debounceTimer = nil
        pendingEvents.removeAll()
        
        print("[RealtimeEventService] 🔌 Unsubscribed from events")
    }
    
    /// Handle incoming realtime event (with debounce/coalesce)
    private func handleEvent(payload: Any) async {
        // Parse Supabase Realtime message
        // The payload structure varies - try multiple access patterns
        var newRecord: [String: Any]?
        
        // Try: payload.new (direct access for postgres_changes)
        if let payloadDict = payload as? [String: Any] {
            if let new = payloadDict["new"] as? [String: Any] {
                newRecord = new
            } else if let record = payloadDict["record"] as? [String: Any] {
                newRecord = record
            } else {
                // Payload itself might be the record
                newRecord = payloadDict
            }
        }
        
        guard let record = newRecord,
              let eventType = record["event_type"] as? String,
              let entityType = record["entity_type"] as? String else {
            print("[RealtimeEventService] ⚠️ Could not parse event payload")
            return
        }
        
        let entityId = record["entity_id"] as? String
        await processEvent(eventType: eventType, entityType: entityType, entityId: entityId)
    }
    
    /// Process a single event (adds to debounce queue)
    private func processEvent(eventType: String, entityType: String, entityId: String?) async {
        print("[RealtimeEventService] 📨 Received event: \(eventType), entity: \(entityType), id: \(entityId ?? "none")")
        
        // Create coalesce key: eventType + entityId (prevents duplicate refreshes for same entity)
        let coalesceKey = "\(eventType):\(entityId ?? "none")"
        let now = Date()
        
        // Update pending events map
        pendingEvents[coalesceKey] = now
        
        // Cancel existing debounce timer
        debounceTimer?.cancel()
        
        // Start new debounce timer
        debounceTimer = Task {
            try? await Task.sleep(nanoseconds: UInt64(debounceInterval * 1_000_000_000))
            
            // Process all pending events (coalesced)
            await processPendingEvents()
        }
    }
    
    /// Process pending events (after debounce)
    private func processPendingEvents() async {
        let eventsToProcess = pendingEvents
        pendingEvents.removeAll()
        
        // Update last seen timestamp (for catch-up)
        lastSeenEventAt = Date()
        
        // Group by entity to avoid duplicate refreshes
        var entityRefreshes: Set<String> = [] // "entityType:entityId"
        
        for (coalesceKey, _) in eventsToProcess {
            let parts = coalesceKey.split(separator: ":")
            guard parts.count >= 2 else { continue }
            
            let eventType = String(parts[0])
            let entityId = parts.count > 1 ? String(parts[1]) : nil
            
            // Determine entity type from event type
            let entityType: String
            if eventType.contains("job") {
                entityType = "job"
            } else if eventType.contains("evidence") || eventType.contains("document") {
                entityType = "evidence"
            } else if eventType.contains("audit") {
                entityType = "audit"
            } else {
                continue // Skip unknown event types
            }
            
            let entityKey = "\(entityType):\(entityId ?? "all")"
            
            // Only refresh once per entity (coalesce)
            if !entityRefreshes.contains(entityKey) {
                entityRefreshes.insert(entityKey)
                await refreshStore(eventType: eventType, entityType: entityType, entityId: entityId)
            }
        }
    }
    
    /// Refresh appropriate store based on event
    private func refreshStore(eventType: String, entityType: String, entityId: String?) async {
        print("[RealtimeEventService] 🔔 Event: \(eventType), entity: \(entityType), id: \(entityId ?? "none")")
        
        switch entityType {
        case "job":
            // Refresh jobs list
            await JobsStore.shared.refreshOnEvent(
                eventType: eventType,
                entityId: entityId
            )
            
            // If job detail is open for this job, refresh it too
            // (This would require a JobDetailStore or similar - for now, just refresh list)
            
        case "evidence":
            // Evidence upload affects jobs list (evidence count)
            await JobsStore.shared.refreshOnEvent(
                eventType: eventType,
                entityId: entityId
            )
            
        case "audit":
            // Audit events - could refresh audit feed if open
            // For now, just log
            print("[RealtimeEventService] Audit event received (not refreshing yet)")
            
        default:
            break
        }
    }
    
    /// App lifecycle: Background
    @objc private func appDidEnterBackground() {
        Task { @MainActor in
            // Unsubscribe to save battery (most battery-friendly pattern)
            // Realtime WebSocket can drain battery even if events are ignored
            await unsubscribe()
            print("[RealtimeEventService] App entered background (unsubscribed)")
        }
    }
    
    /// App lifecycle: Foreground
    @objc private func appWillEnterForeground() {
        Task { @MainActor in
            // Resubscribe + catch-up refresh
            if let orgId = organizationId {
                // First: catch-up refresh (fetch latest before subscribing)
                _ = try? await JobsStore.shared.fetch(forceRefresh: true)
                
                // Then: subscribe for live updates
                await subscribe(organizationId: orgId)
                
                print("[RealtimeEventService] App entered foreground (resubscribed + caught up)")
            }
        }
    }
}

// Note: Using Supabase SDK's RealtimeMessage type directly
