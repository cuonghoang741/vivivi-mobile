import Foundation
import Supabase

/// App-wide Supabase client. Always use this one; never construct ad-hoc clients.
enum SupabaseClientFactory {
    static let shared: SupabaseClient = {
        SupabaseClient(
            supabaseURL: Config.supabaseURL,
            supabaseKey: Config.supabaseAnonKey
        )
    }()
}
