import Foundation
import Supabase

/// `characters` table with embedded default background.
struct CharacterRepository: SupabaseRepository {
    private let table = "characters"
    private let columns = """
    id,name,description,thumbnail_url,avatar,video_url,base_model_url,\
    agent_elevenlabs_id,tier,available,\
    default_costume_id,background_default_id,data,order,owner_by_id,\
    default_background:backgrounds!background_default_id(image,thumbnail)
    """

    func fetchAll() async throws -> [Character] {
        let id = await authIdentifier()
        if let userId = id.userId {
            return try await client.from(table)
                .select(columns)
                .eq("is_public", value: true)
                .or("owner_by_id.is.null,owner_by_id.eq.\(userId)")
                .order("order", ascending: true)
                .execute()
                .value
        } else {
            return try await client.from(table)
                .select(columns)
                .eq("is_public", value: true)
                .is("owner_by_id", value: nil)
                .order("order", ascending: true)
                .execute()
                .value
        }
    }

    func fetch(id characterID: String) async throws -> Character? {
        let rows: [Character] = try await client
            .from(table)
            .select(columns)
            .eq("id", value: characterID)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}
