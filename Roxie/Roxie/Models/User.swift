import Foundation

struct User: Codable, Equatable {
    let id: String
    var email: String?
    var displayName: String?
    var avatarURL: URL?
    var hasCompletedOnboarding: Bool
    var rubies: Int
    var isPro: Bool

    static let preview = User(
        id: "preview",
        email: "preview@roxie.app",
        displayName: "Preview",
        avatarURL: nil,
        hasCompletedOnboarding: true,
        rubies: 120,
        isPro: false
    )
}
