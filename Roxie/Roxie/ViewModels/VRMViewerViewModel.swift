import SwiftUI

@MainActor
final class VRMViewerViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case initialReady
        case modelLoaded
        case failed(String)
    }

    @Published var state: LoadState = .loading
    @Published var currentCharacter: Character?

    let bridge = WebSceneBridge()
    private let parallax = ParallaxMotion()
    private let characters = CharacterRepository()

    func onAppear() async {
        if currentCharacter == nil {
            await selectInitialCharacter()
        }
        parallax.start { [weak self] dx, dy in
            self?.bridge.applyParallax(dx: dx, dy: dy)
        }
    }

    func onDisappear() {
        parallax.stop()
    }

    func handleInitialReady() {
        state = .initialReady
    }

    func handleModelLoaded() {
        state = .modelLoaded
    }

    func handleError(_ message: String) {
        state = .failed(message)
    }

    // MARK: - Private

    /// Pick the last-used character from UserDefaults, else the first the API returns.
    private func selectInitialCharacter() async {
        let preferredID = VRMPersistence.currentCharacterID
        do {
            let list = try await characters.fetchAll()
            let chosen = list.first(where: { $0.id == preferredID }) ?? list.first
            guard let chosen else { return }
            currentCharacter = chosen
            persist(character: chosen)
        } catch {
            state = .failed("Failed to fetch characters: \(error.localizedDescription)")
        }
    }

    private func persist(character: Character) {
        VRMPersistence.currentCharacterID = character.id
        if let url = character.baseModelURL {
            VRMPersistence.modelURL = url
        }
        VRMPersistence.modelName = character.name
        if let bg = character.defaultBackground?.image {
            VRMPersistence.backgroundURL = bg
        }
    }
}
