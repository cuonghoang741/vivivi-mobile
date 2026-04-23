import Foundation

/// Phase 0 façade for the Supabase client.
/// Phase 1 replaces this with the real `supabase-swift` SDK (SPM).
struct SupabaseConfig {
    let url: URL
    let anonKey: String

    static var fromBundle: SupabaseConfig {
        let url = URL(string: Bundle.main.infoDictionary?["SUPABASE_URL"] as? String
            ?? "https://cjtghurczxqheqwegpiy.supabase.co")!
        let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String ?? ""
        return SupabaseConfig(url: url, anonKey: key)
    }
}
