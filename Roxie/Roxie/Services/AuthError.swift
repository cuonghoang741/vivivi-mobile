import Foundation

enum AuthError: LocalizedError {
    case notAuthenticated
    case appleMissingIdentityToken
    case appleMissingNonce
    case supabaseExchange(String)
    case canceled

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not signed in."
        case .appleMissingIdentityToken:
            return "Apple did not return an identity token."
        case .appleMissingNonce:
            return "Internal error: missing Apple sign-in nonce."
        case .supabaseExchange(let detail):
            return "Supabase sign-in failed: \(detail)"
        case .canceled:
            return "Sign-in canceled."
        }
    }
}
