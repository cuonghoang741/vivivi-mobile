import Foundation

protocol AnalyticsServicing: Sendable {
    func track(event: String)
    func track(event: String, properties: [String: String])
    func identify(userId: String)
}

/// Phase 0 stub. Phase 7 will fan out to Firebase / AppsFlyer / Facebook / TikTok.
struct AnalyticsService: AnalyticsServicing {
    func track(event: String) {
        track(event: event, properties: [:])
    }

    func track(event: String, properties: [String: String]) {
        #if DEBUG
        print("[Analytics] \(event) \(properties)")
        #endif
    }

    func identify(userId: String) {
        #if DEBUG
        print("[Analytics] identify \(userId)")
        #endif
    }
}
