import Foundation

/// Mirrors RN's `src/services/UserPreferencesService.ts` + `persistence.ts`.
/// Thin typed wrapper around UserDefaults.
final class UserPreferencesService: @unchecked Sendable {
    static let shared = UserPreferencesService()
    private let defaults = UserDefaults.standard

    // Keys match RN's PersistKeys so the Swift app can pick up where the RN one left off (same bundle id).
    private enum Key {
        static let characterId = "persist.characterId"
        static let modelName = "persist.modelName"
        static let modelURL = "persist.modelURL"
        static let backgroundURL = "persist.backgroundURL"
        static let backgroundName = "persist.backgroundName"
        static let ageVerified18 = "persist.ageVerified18"
        static let hasCompletedOnboardingV2 = "persist.hasCompletedOnboardingV2"
        static let hasRatedApp = "persist.hasRatedApp"
        static let lastReviewPromptAt = "persist.lastReviewPromptAt"
    }

    var currentCharacterID: String? {
        get { defaults.string(forKey: Key.characterId) }
        set { defaults.setValue(newValue, forKey: Key.characterId) }
    }

    var currentModelURL: String? {
        get { defaults.string(forKey: Key.modelURL) }
        set { defaults.setValue(newValue, forKey: Key.modelURL) }
    }

    var currentModelName: String? {
        get { defaults.string(forKey: Key.modelName) }
        set { defaults.setValue(newValue, forKey: Key.modelName) }
    }

    var currentBackgroundURL: String? {
        get { defaults.string(forKey: Key.backgroundURL) }
        set { defaults.setValue(newValue, forKey: Key.backgroundURL) }
    }

    var currentBackgroundName: String? {
        get { defaults.string(forKey: Key.backgroundName) }
        set { defaults.setValue(newValue, forKey: Key.backgroundName) }
    }

    var ageVerified: Bool {
        get { defaults.bool(forKey: Key.ageVerified18) }
        set { defaults.set(newValue, forKey: Key.ageVerified18) }
    }

    var hasCompletedOnboardingV2: Bool {
        get { defaults.bool(forKey: Key.hasCompletedOnboardingV2) }
        set { defaults.set(newValue, forKey: Key.hasCompletedOnboardingV2) }
    }

    var hasRatedApp: Bool {
        get { defaults.bool(forKey: Key.hasRatedApp) }
        set { defaults.set(newValue, forKey: Key.hasRatedApp) }
    }

    var lastReviewPromptAt: Date? {
        get { defaults.object(forKey: Key.lastReviewPromptAt) as? Date }
        set { defaults.set(newValue, forKey: Key.lastReviewPromptAt) }
    }
}
