import SwiftUI

@MainActor
final class VRMViewerViewModel: ObservableObject {
    @Published var isReady = false
    @Published var errorMessage: String?

    let bridge = WebSceneBridge()

    func modelBecameReady() {
        isReady = true
    }

    func report(error: String) {
        errorMessage = error
    }
}
