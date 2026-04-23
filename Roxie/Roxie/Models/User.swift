import Foundation

/// Local app user. Hydrated from the Supabase session and auxiliary tables.
struct User: Codable, Equatable, Sendable {
    let id: String
    var email: String?
    var displayName: String?
    var avatarURL: URL?
    var hasCompletedOnboarding: Bool
    var isPro: Bool

    static let preview = User(
        id: "preview",
        email: "preview@roxie.app",
        displayName: "Preview",
        avatarURL: nil,
        hasCompletedOnboarding: true,
        isPro: false
    )
}
