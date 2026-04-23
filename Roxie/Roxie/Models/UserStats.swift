import Foundation

/// Mirrors the `user_stats` table in Supabase.
struct UserStats: Codable, Equatable, Sendable {
    var level: Int
    var xp: Int
    var energy: Int
    var energyUpdatedAt: Date
    var loginStreak: Int

    enum CodingKeys: String, CodingKey {
        case level, xp, energy
        case energyUpdatedAt = "energy_updated_at"
        case loginStreak = "login_streak"
    }

    static let defaults = UserStats(
        level: 1,
        xp: 0,
        energy: 100,
        energyUpdatedAt: Date(timeIntervalSince1970: 0),
        loginStreak: 0
    )
}
