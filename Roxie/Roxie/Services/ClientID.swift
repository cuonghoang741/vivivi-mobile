import Foundation

/// Device-scoped anonymous identifier. Mirrors RN's `src/utils/clientId.ts`.
/// Persisted in Keychain so it survives app reinstall.
enum ClientID {
    private static let key = "roxie.clientId"

    static func current() -> String {
        if let existing = Keychain.shared.get(key) {
            return existing
        }
        let fresh = UUID().uuidString.lowercased()
        Keychain.shared.set(fresh, for: key)
        return fresh
    }

    static func reset() {
        Keychain.shared.delete(key)
    }
}
