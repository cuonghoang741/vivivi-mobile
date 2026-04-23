import Foundation

/// Port of RN `src/utils/persistence.ts`. Stored in the same UserDefaults keys as RN
/// so, if the Swift app ever takes over the RN bundle id, existing selections carry over.
enum VRMPersistence {
    private static var defaults: UserDefaults { .standard }

    private enum Key {
        static let characterId = "persist.characterId"
        static let modelName = "persist.modelName"
        static let modelURL = "persist.modelURL"
        static let backgroundURL = "persist.backgroundURL"
        static let backgroundName = "persist.backgroundName"
        static let backgroundSelections = "persist.backgroundSelections"
        static let costumeSelections = "persist.costumeSelections"
    }

    // MARK: - Scalars

    static var modelName: String {
        get { defaults.string(forKey: Key.modelName) ?? "" }
        set { defaults.set(newValue, forKey: Key.modelName) }
    }

    static var modelURL: String {
        get { defaults.string(forKey: Key.modelURL) ?? "" }
        set { defaults.set(newValue, forKey: Key.modelURL) }
    }

    static var backgroundURL: String {
        get { defaults.string(forKey: Key.backgroundURL) ?? "" }
        set { defaults.set(newValue, forKey: Key.backgroundURL) }
    }

    static var backgroundName: String {
        get { defaults.string(forKey: Key.backgroundName) ?? "" }
        set { defaults.set(newValue, forKey: Key.backgroundName) }
    }

    static var currentCharacterID: String? {
        get { defaults.string(forKey: Key.characterId) }
        set { defaults.set(newValue, forKey: Key.characterId) }
    }

    // MARK: - Character-scoped maps

    struct BackgroundSelection: Codable {
        var backgroundId: String?
        var backgroundURL: String?
        var backgroundName: String?
    }

    struct CostumeSelection: Codable {
        var costumeId: String?
        var modelName: String?
        var modelURL: String?
    }

    static func backgroundSelection(for characterID: String) -> BackgroundSelection? {
        readMap(key: Key.backgroundSelections)[characterID]
    }

    static func setBackgroundSelection(_ selection: BackgroundSelection?, for characterID: String) {
        var map: [String: BackgroundSelection] = readMap(key: Key.backgroundSelections)
        if let selection, selection.backgroundId != nil || selection.backgroundURL != nil {
            map[characterID] = selection
        } else {
            map.removeValue(forKey: characterID)
        }
        writeMap(map, key: Key.backgroundSelections)
    }

    static func costumeSelection(for characterID: String) -> CostumeSelection? {
        readMap(key: Key.costumeSelections)[characterID]
    }

    static func setCostumeSelection(_ selection: CostumeSelection?, for characterID: String) {
        var map: [String: CostumeSelection] = readMap(key: Key.costumeSelections)
        if let selection, selection.costumeId != nil || selection.modelName != nil || selection.modelURL != nil {
            map[characterID] = selection
        } else {
            map.removeValue(forKey: characterID)
        }
        writeMap(map, key: Key.costumeSelections)
    }

    // MARK: - Injection

    /// Produces the same `window.native*` JavaScript the RN version does.
    static func generateInjectionScript() -> String {
        let characterID = currentCharacterID
        let costume = characterID.flatMap(costumeSelection(for:))
        let background = characterID.flatMap(backgroundSelection(for:))

        let effectiveModelName = costume?.modelName ?? modelName
        let effectiveModelURL = costume?.modelURL ?? modelURL
        let effectiveBackgroundURL = background?.backgroundURL ?? backgroundURL

        var lines: [String] = []
        if !effectiveModelName.isEmpty {
            lines.append(#"window.nativeSelectedModelName="\#(escape(effectiveModelName))";"#)
        }
        if !effectiveModelURL.isEmpty {
            lines.append(#"window.nativeSelectedModelURL="\#(escape(effectiveModelURL))";"#)
        }
        if !effectiveBackgroundURL.isEmpty {
            lines.append(#"window.initialBackgroundUrl="\#(escape(effectiveBackgroundURL))";"#)
        }
        return lines.joined(separator: "\n")
    }

    // MARK: - Helpers

    private static func readMap<T: Codable>(key: String) -> [String: T] {
        guard let data = defaults.data(forKey: key),
              let map = try? JSONDecoder().decode([String: T].self, from: data) else {
            return [:]
        }
        return map
    }

    private static func writeMap<T: Codable>(_ map: [String: T], key: String) {
        if map.isEmpty {
            defaults.removeObject(forKey: key)
            return
        }
        if let data = try? JSONEncoder().encode(map) {
            defaults.set(data, forKey: key)
        }
    }

    private static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }
}
