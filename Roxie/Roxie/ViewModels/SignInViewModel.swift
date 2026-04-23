import SwiftUI
import AuthenticationServices

@MainActor
final class SignInViewModel: ObservableObject {
    @Published var isSigningIn = false
    @Published var errorMessage: String?

    private let auth: AuthServicing

    init(auth: AuthServicing = AuthService()) {
        self.auth = auth
    }

    func configure(request: ASAuthorizationAppleIDRequest) {
        request.requestedScopes = [.fullName, .email]
    }

    func handle(result: Result<ASAuthorization, Error>) async -> User? {
        isSigningIn = true
        defer { isSigningIn = false }
        switch result {
        case .success:
            return await signInInternal()
        case .failure(let error):
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func signInAsGuest() async -> User? {
        isSigningIn = true
        defer { isSigningIn = false }
        return await signInInternal()
    }

    private func signInInternal() async -> User? {
        do {
            return try await auth.signInWithApple()
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}
