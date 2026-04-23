import Foundation
import Supabase

/// Protocol that every Supabase-backed repo conforms to.
/// Provides a shared client + the auth-filter pattern from RN's BaseRepository.ts.
protocol SupabaseRepository {
    var client: SupabaseClient { get }
}

extension SupabaseRepository {
    var client: SupabaseClient { SupabaseClientFactory.shared }

    /// Resolve userId + clientId the same way RN does: user wins when present, clientId otherwise.
    func authIdentifier() async -> AuthIdentifier {
        let session = try? await client.auth.session
        return AuthIdentifier.current(userId: session?.user.id.uuidString)
    }
}
