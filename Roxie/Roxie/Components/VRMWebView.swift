import SwiftUI
import WebKit

/// SwiftUI wrapper around WKWebView that loads the bundled VRM HTML and
/// exposes a two-way JS bridge. This mirrors the contract the RN version
/// documented ("matching Swift's VRMWebView exactly").
///
/// JS side expects:
///   window.__iOSShell = true
///   window.discoveredFiles = [...]   // injected before document-start
///   window.webkit.messageHandlers.native.postMessage({...})
///
/// Swift → JS: `bridge.send(event:payload:)` evaluates JS on the main actor.
/// JS → Swift: messages arrive in `SceneMessage` and are republished.
struct VRMWebView: UIViewRepresentable {
    @ObservedObject var bridge: WebSceneBridge
    var onModelReady: (() -> Void)?
    var onError: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(bridge: bridge, onModelReady: onModelReady, onError: onError)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let userContent = WKUserContentController()
        userContent.add(context.coordinator, name: "native")

        let injection = """
        window.__iOSShell = true;
        window.discoveredFiles = \(context.coordinator.discoveredFilesJSON());
        console.log('🎯 Injected files:', window.discoveredFiles);
        """
        userContent.addUserScript(WKUserScript(
            source: injection,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        config.userContentController = userContent

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        context.coordinator.webView = webView
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard !context.coordinator.didLoad else { return }
        context.coordinator.didLoad = true
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "HTML") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            let placeholder = """
            <html><body style='background:#FFC0CB;color:white;font-family:-apple-system;
              display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'>
            <div style='text-align:center'>
              <div style='font-size:48px'>🎀</div>
              <div style='font-size:20px;margin-top:12px'>VRM viewer (Phase 2)</div>
              <div style='opacity:.8;margin-top:6px;font-size:14px'>bundle index.html not present yet</div>
            </div></body></html>
            """
            webView.loadHTMLString(placeholder, baseURL: nil)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        let bridge: WebSceneBridge
        let onModelReady: (() -> Void)?
        let onError: ((String) -> Void)?
        weak var webView: WKWebView?
        var didLoad = false

        init(bridge: WebSceneBridge, onModelReady: (() -> Void)?, onError: ((String) -> Void)?) {
            self.bridge = bridge
            self.onModelReady = onModelReady
            self.onError = onError
        }

        func discoveredFilesJSON() -> String {
            "[]" // Phase 2: enumerate Bundle assets and emit JSON.
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            bridge.attach(webView: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            onError?(error.localizedDescription)
        }

        func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "native" else { return }
            let text: String
            if let s = message.body as? String {
                text = s
            } else if let dict = message.body as? [String: Any],
                      let data = try? JSONSerialization.data(withJSONObject: dict),
                      let s = String(data: data, encoding: .utf8) {
                text = s
            } else {
                text = String(describing: message.body)
            }
            Task { @MainActor in
                bridge.received(message: text)
                if text.contains("model-ready") { onModelReady?() }
            }
        }
    }
}
