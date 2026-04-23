import Foundation

/// Reads Supabase credentials injected into Info.plist via Secrets.xcconfig.
enum Config {
    static let supabaseURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
              !raw.isEmpty,
              let url = URL(string: raw) else {
            fatalError("SUPABASE_URL missing — copy Secrets.sample.xcconfig to Secrets.xcconfig and fill it in.")
        }
        return url
    }()

    static let supabaseAnonKey: String = {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
              !key.isEmpty else {
            fatalError("SUPABASE_ANON_KEY missing — copy Secrets.sample.xcconfig to Secrets.xcconfig and fill it in.")
        }
        return key
    }()
}
