import AuthenticationServices
import UIKit

/// Drives the native Sign In with Apple flow without using the stock SwiftUI
/// `SignInWithAppleButton` — lets us keep a custom button style.
@MainActor
final class AppleSignInCoordinator: NSObject {
    private var continuation: CheckedContinuation<ASAuthorization, Error>?
    private let anchor: ASPresentationAnchor
    private let nonce: String?

    init(
        nonce: String? = nil,
        anchor: ASPresentationAnchor = AppleSignInCoordinator.resolveAnchor()
    ) {
        self.nonce = nonce
        self.anchor = anchor
    }

    func signIn() async throws -> ASAuthorization {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        if let nonce { request.nonce = nonce }
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    static func resolveAnchor() -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
            ?? ASPresentationAnchor()
    }
}

extension AppleSignInCoordinator: ASAuthorizationControllerDelegate {
    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            let c = continuation
            continuation = nil
            c?.resume(returning: authorization)
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { @MainActor in
            let c = continuation
            continuation = nil
            c?.resume(throwing: error)
        }
    }
}

extension AppleSignInCoordinator: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated { anchor }
    }
}
