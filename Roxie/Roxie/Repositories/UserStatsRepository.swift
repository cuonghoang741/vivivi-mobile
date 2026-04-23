import Foundation
import Supabase

/// `user_stats` table. Mirrors RN UserStatsRepository.
struct UserStatsRepository: SupabaseRepository {
    private let table = "user_stats"

    func fetch() async throws -> UserStats? {
        let id = await authIdentifier()
        guard let userId = id.userId else { return nil }
        let rows: [UserStats] = try await client
            .from(table)
            .select("level,xp,energy,energy_updated_at,login_streak")
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func createDefaults() async throws -> UserStats {
        let id = await authIdentifier()
        guard let userId = id.userId else {
            throw AuthError.notAuthenticated
        }
        let payload: [String: AnyJSON] = [
            "user_id": .string(userId),
            "level": .integer(1),
            "xp": .integer(0),
            "energy": .integer(UserStats.defaults.energy),
            "energy_updated_at": .string(ISO8601DateFormatter().string(from: Date())),
            "login_streak": .integer(0)
        ]
        let row: UserStats = try await client
            .from(table)
            .insert(payload)
            .select("level,xp,energy,energy_updated_at,login_streak")
            .single()
            .execute()
            .value
        return row
    }
}
