import Foundation
import WebKit
import Combine

/// Two-way JS ↔ Swift bridge for the VRM WebView.
/// RN analog: `src/utils/WebSceneBridge.ts`.
@MainActor
final class WebSceneBridge: ObservableObject {
    @Published private(set) var lastMessage: String?
    private weak var webView: WKWebView?
    private var pendingCommands: [() -> Void] = []

    func attach(webView: WKWebView) {
        self.webView = webView
        let buffered = pendingCommands
        pendingCommands.removeAll()
        for command in buffered { command() }
    }

    func send(event: String, payload: [String: Any] = [:]) {
        let data = try? JSONSerialization.data(withJSONObject: ["event": event, "payload": payload])
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let js = "window.dispatchEvent(new CustomEvent('native', { detail: \(json) }));"
        let run: () -> Void = { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
        if webView == nil {
            pendingCommands.append(run)
        } else {
            run()
        }
    }

    func received(message: String) {
        lastMessage = message
    }
}
