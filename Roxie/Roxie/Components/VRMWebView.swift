import SwiftUI
import UIKit
import WebKit

/// Full-parity port of RN `src/components/VRMWebView.tsx`.
///
/// Contract:
///   - `window.__isReactNativeShell = true`  (HTML's RN code path keys off this)
///   - `window.__iOSShell = true`
///   - `window.discoveredFiles = { vrmFiles, fbxFiles }`
///   - `window.nativeSelectedModelName/URL`, `window.initialBackgroundUrl`
///   - `window.ReactNativeWebView.postMessage(...)` shim → WKWebView message handler `native`
///
/// JS → Swift messages (via `ReactNativeWebView.postMessage`):
///   - "initialReady"    — scene up, not necessarily a model loaded yet
///   - "modelLoaded"     — VRM model is on screen
///   - "ERROR:<detail>"  — HTML/JS runtime error; surface to VM
struct VRMWebView: UIViewRepresentable {
    @ObservedObject var bridge: WebSceneBridge
    var onInitialReady: (() -> Void)?
    var onModelLoaded: (() -> Void)?
    var onError: ((String) -> Void)?
    var onMessage: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(
            bridge: bridge,
            onInitialReady: onInitialReady,
            onModelLoaded: onModelLoaded,
            onError: onError,
            onMessage: onMessage
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let userContent = WKUserContentController()
        userContent.add(context.coordinator, name: "native")

        let startup = Self.documentStartScript()
        userContent.addUserScript(WKUserScript(
            source: startup,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        config.userContentController = userContent

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.webView = webView
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard !context.coordinator.didLoad else { return }
        context.coordinator.didLoad = true
        Self.loadHTML(into: webView)
    }

    // MARK: - Scripts & HTML

    private static func documentStartScript() -> String {
        let fileList = VRMFileDiscovery.fileListJSON()
        let persisted = VRMPersistence.generateInjectionScript()
        return """
        (function () {
            window.__isReactNativeShell = true;
            window.__iOSShell = true;
            window.discoveredFiles = \(fileList);
            if (!window.ReactNativeWebView) {
                window.ReactNativeWebView = {
                    postMessage: function (msg) {
                        try { window.webkit.messageHandlers.native.postMessage(String(msg)); }
                        catch (e) { /* host not attached yet */ }
                    }
                };
            }
            \(persisted)
        })();
        """
    }

    private static func loadHTML(into webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "HTML")
            ?? Bundle.main.url(forResource: "index", withExtension: "html") else {
            webView.loadHTMLString(fallbackPlaceholder(), baseURL: nil)
            return
        }
        // Match RN behaviour: load the HTML *string* with a fixed baseURL so page-relative
        // requests and CORS on iOS 18.6- behave the same as in RN.
        if let html = try? String(contentsOf: url, encoding: .utf8) {
            webView.loadHTMLString(html, baseURL: URL(string: "https://localhost/"))
        } else {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }

    private static func fallbackPlaceholder() -> String {
        """
        <html><body style='background:#FFC0CB;color:white;font-family:-apple-system;
          display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'>
        <div style='text-align:center'>
          <div style='font-size:48px'>🎀</div>
          <div style='font-size:20px;margin-top:12px'>VRM viewer — bundle index.html missing</div>
        </div></body></html>
        """
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let bridge: WebSceneBridge
        private let onInitialReady: (() -> Void)?
        private let onModelLoaded: (() -> Void)?
        private let onError: ((String) -> Void)?
        private let onMessage: ((String) -> Void)?
        weak var webView: WKWebView?
        var didLoad = false

        init(
            bridge: WebSceneBridge,
            onInitialReady: (() -> Void)?,
            onModelLoaded: (() -> Void)?,
            onError: ((String) -> Void)?,
            onMessage: ((String) -> Void)?
        ) {
            self.bridge = bridge
            self.onInitialReady = onInitialReady
            self.onModelLoaded = onModelLoaded
            self.onError = onError
            self.onMessage = onMessage
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in bridge.attach(webView: webView) }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in onError?(error.localizedDescription) }
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
                onMessage?(text)
                if text.hasPrefix("ERROR:") {
                    onError?(String(text.dropFirst("ERROR:".count)))
                } else if text == "initialReady" {
                    onInitialReady?()
                } else if text == "modelLoaded" {
                    onModelLoaded?()
                }
            }
        }
    }
}
