import Foundation

/// Per-character preference (outfit, background, voice). Stored locally; RN
/// syncs to Supabase in later phases — out of scope for Phase 1.
struct CharacterPreference: Codable, Equatable, Sendable {
    var costumeId: String?
    var backgroundId: String?
    var voiceId: String?
}

final class UserCharacterPreferenceService: @unchecked Sendable {
    static let shared = UserCharacterPreferenceService()
    private let defaults = UserDefaults.standard
    private let prefix = "persist.characterPref."

    func preference(for characterID: String) -> CharacterPreference {
        guard let data = defaults.data(forKey: prefix + characterID),
              let decoded = try? JSONDecoder().decode(CharacterPreference.self, from: data) else {
            return CharacterPreference()
        }
        return decoded
    }

    func set(_ preference: CharacterPreference, for characterID: String) {
        guard let data = try? JSONEncoder().encode(preference) else { return }
        defaults.set(data, forKey: prefix + characterID)
    }
}
