import Foundation

/// Resolved auth identity. Mirrors RN's `getAuthIdentifier`.
/// Either `userId` (authenticated) OR `clientId` (anonymous).
struct AuthIdentifier: Sendable, Equatable {
    let userId: String?
    let clientId: String

    var isAuthenticated: Bool { userId != nil }

    static func current(userId: String?) -> AuthIdentifier {
        AuthIdentifier(userId: userId?.lowercased(), clientId: ClientID.current())
    }
}
