import Foundation
import WebKit
import Combine

/// Full port of RN `src/utils/WebSceneBridge.ts`. All 9 RN→JS methods + incoming-message feed.
@MainActor
final class WebSceneBridge: ObservableObject {
    @Published private(set) var lastMessage: String?

    private weak var webView: WKWebView?
    private var pending: [() -> Void] = []

    private static let parallaxInterval: TimeInterval = 1.0 / 45.0
    private var lastParallaxAt: TimeInterval = 0
    private var lastMouthLogAt: TimeInterval = 0

    // MARK: - Lifecycle

    func attach(webView: WKWebView) {
        self.webView = webView
        let buffered = pending
        pending.removeAll()
        for command in buffered { command() }
    }

    func received(message: String) {
        lastMessage = message
    }

    // MARK: - Public bridge API

    func setCallMode(_ enabled: Bool) {
        evaluate("window.setCallMode && window.setCallMode(\(enabled ? "true" : "false"));")
    }

    func applyParallax(dx: Double, dy: Double) {
        let now = Date().timeIntervalSince1970
        guard now - lastParallaxAt >= Self.parallaxInterval else { return }
        lastParallaxAt = now
        evaluate("window.applyParallax && window.applyParallax(\(dx), \(dy));")
    }

    func triggerDance() {
        evaluate("window.triggerDance && window.triggerDance();")
    }

    func stopAction() {
        loadAnimation(named: "Idle Stand")
    }

    func loadAnimation(named animName: String) {
        let safe = animName.replacingOccurrences(of: "'", with: "\\'")
        evaluate("window.loadAnimationByName && window.loadAnimationByName('\(safe)');")
    }

    /// Intentionally a no-op during chat, matching RN. Voice mouth-sync happens via `setMouthOpen`.
    func playSpeech(_ text: String) { }

    func setMouthOpen(_ value: Double) {
        let clamped = max(0, min(1, value.isFinite ? value : 0))
        evaluate(String(format: "window.setMouthOpen && window.setMouthOpen(%.3f);", clamped))
    }

    /// Inject an arbitrary model-load JS (backend can ship model-specific loader snippets).
    func loadModel(_ js: String) {
        evaluate(js)
    }

    // MARK: - Private

    private func evaluate(_ js: String) {
        let run: () -> Void = { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
        if webView == nil {
            pending.append(run)
        } else {
            run()
        }
    }
}
