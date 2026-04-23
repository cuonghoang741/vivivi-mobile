import Foundation

struct Character: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let vrmModelName: String
    let previewImage: String?
    let tagline: String?
}
