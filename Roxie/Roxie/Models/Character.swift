import Foundation

/// Mirrors `characters` row plus the embedded `default_background` from `backgrounds`.
struct Character: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let description: String?
    let thumbnailURL: String?
    let avatar: String?
    let videoURL: String?
    let baseModelURL: String?
    let agentElevenLabsID: String?
    let tier: String?
    let order: Int?
    let available: Bool?
    let defaultCostumeID: String?
    let backgroundDefaultID: String?
    let ownerByID: String?
    let defaultBackground: EmbeddedBackground?
    let data: CharacterData?

    struct EmbeddedBackground: Codable, Equatable, Sendable {
        let image: String?
        let thumbnail: String?
    }

    struct CharacterData: Codable, Equatable, Sendable {
        let hobbies: [String]?
        let heightCm: Int?
        let age: Int?
        let occupation: String?
        let characteristics: String?

        enum CodingKeys: String, CodingKey {
            case hobbies
            case heightCm = "height_cm"
            case age
            case occupation
            case characteristics
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, name, description, avatar, tier, order, available, data
        case thumbnailURL = "thumbnail_url"
        case videoURL = "video_url"
        case baseModelURL = "base_model_url"
        case agentElevenLabsID = "agent_elevenlabs_id"
        case defaultCostumeID = "default_costume_id"
        case backgroundDefaultID = "background_default_id"
        case ownerByID = "owner_by_id"
        case defaultBackground = "default_background"
    }
}
