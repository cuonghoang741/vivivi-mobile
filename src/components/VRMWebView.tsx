import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { loadHTMLContent } from '../utils/loadHTML';
import { FileDiscovery } from '../utils/fileDiscovery';
import { Persistence } from '../utils/persistence';

interface VRMWebViewProps {
  onModelReady?: () => void;
  onMessage?: (message: string) => void;
  onReportError?: (errorDetail: string) => void;
  enableDebug?: boolean;
}

interface DebugInfo {
  htmlLoaded: boolean;
  fileListReady: boolean;
  persistedReady: boolean;
  webViewLoaded: boolean;
  modelReady: boolean;
  error: string | null;
  consoleLogs: string[];
  lastMessage: string | null;
}

/**
 * VRMWebView - React Native version matching Swift's VRMWebView exactly
 * 
 * Swift version flow:
 * 1. makeUIView: Create WKWebViewConfiguration, add scripts to userContentController, create WebView
 * 2. updateUIView: Load HTML file from Bundle.main
 * 3. Coordinator: Handle messages via WKScriptMessageHandler
 */
export const VRMWebView = React.forwardRef<WebView, VRMWebViewProps>(({
  onModelReady,
  onMessage,
  onReportError,
  enableDebug = false,
}, ref) => {
  const webViewRef = useRef<WebView>(null);

  // Expose ref to parent (similar to Swift's @Binding var webView)
  React.useImperativeHandle(ref, () => webViewRef.current!);

  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [fileListScript, setFileListScript] = useState<string>('');
  const [persistedScript, setPersistedScript] = useState<string>('');
  const debugEnabled = enableDebug;
  const [showDebug, setShowDebug] = useState<boolean>(false);

  useEffect(() => {
    if (!debugEnabled && showDebug) {
      setShowDebug(false);
    }
  }, [debugEnabled, showDebug]);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    htmlLoaded: false,
    fileListReady: false,
    persistedReady: false,
    webViewLoaded: false,
    modelReady: false,
    error: null,
    consoleLogs: [],
    lastMessage: null,
  });

  // Step 1: Prepare scripts BEFORE WebView is created (similar to Swift's makeUIView configuration)
  // In Swift: This happens in makeUIView before creating WKWebView
  useEffect(() => {
    const prepareConfiguration = async () => {
      try {
        const fileListJSON = await FileDiscovery.generateFileListJSON();
        console.log('📁 [VRMWebView] File list JSON:', fileListJSON);
        const script = `window.__isReactNativeShell = true;
window.discoveredFiles = ${fileListJSON};
console.log('🎯 Injected files:', window.discoveredFiles);`;
        setFileListScript(script);
        setDebugInfo(prev => ({ ...prev, fileListReady: true }));
        console.log('✅ [VRMWebView] File list script ready');

        // Get persisted selections (similar to Swift's UserDefaults reading)
        const persisted = await Persistence.generateInjectionScript();
        console.log('💾 [VRMWebView] Persisted script:', persisted);
        setPersistedScript(persisted);
        setDebugInfo(prev => ({ ...prev, persistedReady: true }));
        console.log('✅ [VRMWebView] Persisted script ready');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ [VRMWebView] Error preparing configuration:', error);
        setDebugInfo(prev => ({ ...prev, error: `Config error: ${errorMsg}` }));
      }
    };

    prepareConfiguration();
  }, []);

  // Step 2: Load HTML file (similar to Swift's updateUIView)
  // In Swift: Bundle.main.path(forResource: htmlFileName, ofType: "html")
  useEffect(() => {
    const loadHTMLFile = async () => {
      try {
        console.log('📄 [VRMWebView] Loading HTML file...');
        const content = await loadHTMLContent();
        console.log(`✅ [VRMWebView] HTML loaded, length: ${content.length} chars`);
        setHtmlContent(content);
        setDebugInfo(prev => ({ ...prev, htmlLoaded: true }));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ [VRMWebView] Error loading HTML file:', error);
        setDebugInfo(prev => ({ ...prev, error: `HTML load error: ${errorMsg}` }));
      }
    };

    loadHTMLFile();
  }, []);

  // Step 3: Combine scripts for injection (similar to Swift's WKUserScript with injectionTime: .atDocumentStart)
  // In Swift: Two separate WKUserScripts are added to configuration.userContentController
  const injectedJavaScript = useMemo(() => {
    if (!fileListScript) return '';

    // Combine both scripts (fileList and persisted) - Swift adds them separately but they run together
    const combined = fileListScript + (persistedScript ? '\n' + persistedScript : '');

    // This runs at document start, before HTML scripts execute
    // Similar to Swift's injectionTime: .atDocumentStart, forMainFrameOnly: true
    return `
      (function() {
        ${combined}
      })();
      true;
    `;
  }, [fileListScript, persistedScript]);

  // Step 4: Handle messages (similar to Swift's WKScriptMessageHandler)
  // In Swift: Coordinator implements WKScriptMessageHandler
  // Message name: "loading", body: "initialReady"
  const handleMessage = (event: any) => {
    const message = event.nativeEvent.data;
    console.log('📨 [VRMWebView] Received message:', message);

    if (typeof message === 'string' && message.startsWith('ERROR:')) {
      const errorDetail = message.substring(6);
      Alert.alert('Lỗi HTML/JS Nội bộ', errorDetail, [
        { text: 'OK', style: 'cancel' },
        { 
          text: 'Report', 
          onPress: () => onReportError?.(errorDetail)
        }
      ]);
      setDebugInfo(prev => ({ ...prev, error: errorDetail }));
      if (onMessage) onMessage(message);
      return;
    }

    setDebugInfo(prev => ({
      ...prev,
      lastMessage: message,
      consoleLogs: [...prev.consoleLogs.slice(-9), `[${new Date().toLocaleTimeString()}] ${message}`],
    }));

    // Swift version: if message.name == "loading", let text = message.body as? String, text == "initialReady"
    if (message === 'initialReady') {
      console.log('🎉 [VRMWebView] Model ready!');
      setDebugInfo(prev => ({ ...prev, modelReady: true }));
      if (onModelReady) {
        onModelReady();
      }
    }

    // Also handle modelLoaded message (sent when VRM model is actually loaded)
    if (message === 'modelLoaded') {
      console.log('✅ [VRMWebView] VRM model loaded!');
      setDebugInfo(prev => ({ ...prev, modelReady: true }));
    }

    if (onMessage) {
      onMessage(message);
    }
  };

  // Note: onConsoleMessage is not available in react-native-webview
  // Console messages from WebView will appear in native console

  // Reload WebView
  const handleReload = () => {
    console.log('🔄 [VRMWebView] Reloading...');
    setDebugInfo({
      htmlLoaded: false,
      fileListReady: false,
      persistedReady: false,
      webViewLoaded: false,
      modelReady: false,
      error: null,
      consoleLogs: [],
      lastMessage: null,
    });

    // Reset scripts
    setFileListScript('');
    setPersistedScript('');
    setHtmlContent(null);

    // Reload WebView
    if (webViewRef.current) {
      webViewRef.current.reload();
    }

    // Re-prepare configuration
    setTimeout(() => {
      const prepareConfiguration = async () => {
        try {
          const fileListJSON = await FileDiscovery.generateFileListJSON();
          const script = `window.discoveredFiles = ${fileListJSON};
console.log('🎯 Injected files:', window.discoveredFiles);`;
          setFileListScript(script);
          setDebugInfo(prev => ({ ...prev, fileListReady: true }));

          const persisted = await Persistence.generateInjectionScript();
          setPersistedScript(persisted);
          setDebugInfo(prev => ({ ...prev, persistedReady: true }));

          const content = await loadHTMLContent();
          setHtmlContent(content);
          setDebugInfo(prev => ({ ...prev, htmlLoaded: true }));
        } catch (error) {
          console.error('Error reloading:', error);
        }
      };
      prepareConfiguration();
    }, 100);
  };

  const isReady = htmlContent && fileListScript;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        // Load HTML file (similar to Swift's loadFileURL)
        source={{
          html: htmlContent || '',
          baseUrl: 'https://localhost/' // Fixed CORS issue for iOS 18.6 and below
        }}
        style={styles.webview}
        // Inject scripts at document start (similar to Swift's WKUserScript with injectionTime: .atDocumentStart)
        injectedJavaScript={injectedJavaScript}
        // Configuration matching Swift's WKWebViewConfiguration
        javaScriptEnabled={true} // Similar to preferences.allowsContentJavaScript = true
        domStorageEnabled={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        allowsInlineMediaPlayback={true} // Swift: configuration.allowsInlineMediaPlayback = true
        mediaPlaybackRequiresUserAction={false} // Swift: configuration.mediaTypesRequiringUserActionForPlayback = []
        // Message handler (similar to Swift's WKScriptMessageHandler with name "loading")
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          const errorMsg = `WebView error: ${nativeEvent.code || 'unknown'} - ${nativeEvent.description || String(nativeEvent) || 'Unknown error'}`;
          console.error('❌ [VRMWebView]', errorMsg, nativeEvent);
          setDebugInfo(prev => ({ ...prev, error: errorMsg }));
          Alert.alert('VRMWebView Error', errorMsg, [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Report', 
              onPress: () => onReportError?.(errorMsg)
            }
          ]);
        }}
        // Navigation delegate equivalent
        onLoadStart={() => {
          console.log('🚀 [VRMWebView] Load started');
          setDebugInfo(prev => ({ ...prev, webViewLoaded: false }));
        }}
        onLoadEnd={() => {
          console.log('✅ [VRMWebView] Load ended');
          setDebugInfo(prev => ({ ...prev, webViewLoaded: true }));
        }}
        onLoadProgress={({ nativeEvent }) => {
          console.log(`📊 [VRMWebView] Load progress: ${Math.round(nativeEvent.progress * 100)}%`);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('❌ [VRMWebView] HTTP error:', nativeEvent);
          const errorMsg = `HTTP ${nativeEvent.statusCode}: ${nativeEvent.description}`;
          setDebugInfo(prev => ({ ...prev, error: errorMsg }));
          Alert.alert('VRMWebView HTTP Error', errorMsg, [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Report', 
              onPress: () => onReportError?.(errorMsg)
            }
          ]);
        }}
        onRenderProcessGone={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('❌ [VRMWebView] Render process gone:', nativeEvent);
          setDebugInfo(prev => ({ ...prev, error: 'Render process crashed' }));
          Alert.alert('VRMWebView Render Error', 'Render process crashed.', [
            { text: 'OK', style: 'cancel' },
            { 
              text: 'Report', 
              onPress: () => onReportError?.('Render process crashed.')
            }
          ]);
        }}
        originWhitelist={['*']}
        mixedContentMode="always"
        // iOS specific - matching Swift exactly
        scrollEnabled={false} // Swift: webView.scrollView.contentInsetAdjustmentBehavior = .never (similar effect)
        bounces={false} // Swift: webView.scrollView.bounces = false
        allowsBackForwardNavigationGestures={false}
        // Android specific
        androidLayerType="hardware"
      />


      {/* Debug Panel */}
      {showDebug && (
        <View style={styles.debugPanel}>
          <ScrollView style={styles.debugScroll}>
            <Text style={styles.debugTitle}>🔍 Debug Info</Text>
            <Text style={styles.debugText}>HTML Loaded: {debugInfo.htmlLoaded ? '✅' : '❌'}</Text>
            <Text style={styles.debugText}>FileList Ready: {debugInfo.fileListReady ? '✅' : '❌'}</Text>
            <Text style={styles.debugText}>Persisted Ready: {debugInfo.persistedReady ? '✅' : '❌'}</Text>
            <Text style={styles.debugText}>WebView Loaded: {debugInfo.webViewLoaded ? '✅' : '❌'}</Text>
            <Text style={styles.debugText}>Model Ready: {debugInfo.modelReady ? '✅' : '❌'}</Text>
            {debugInfo.error && (
              <Text style={styles.debugError}>Error: {debugInfo.error}</Text>
            )}
            {debugInfo.lastMessage && (
              <Text style={styles.debugText}>Last Message: {debugInfo.lastMessage}</Text>
            )}
            {debugInfo.consoleLogs.length > 0 && (
              <View>
                <Text style={styles.debugText}>Console Logs:</Text>
                {debugInfo.consoleLogs.map((log, idx) => (
                  <Text key={idx} style={styles.debugLog}>{log}</Text>
                ))}
              </View>
            )}
            <Text style={styles.debugText}>
              HTML Length: {htmlContent?.length || 0} chars
            </Text>
            <Text style={styles.debugText}>
              FileList Script Length: {fileListScript.length} chars
            </Text>
            <Text style={styles.debugText}>
              Persisted Script Length: {persistedScript.length} chars
            </Text>
          </ScrollView>
        </View>
      )}

      {debugEnabled && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={handleReload}>
            <Text style={styles.buttonText}>🔄 Reload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setShowDebug(!showDebug)}
          >
            <Text style={styles.buttonText}>{showDebug ? '👁️ Hide Debug' : '🔍 Show Debug'}</Text>
          </TouchableOpacity>
          {webViewRef.current && (
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                console.log('🔍 [VRMWebView] Injecting debug script...');
                webViewRef.current?.injectJavaScript(`
                  console.log('🔍 Debug: window.discoveredFiles =', window.discoveredFiles);
                  console.log('🔍 Debug: window.nativeSelectedModelName =', window.nativeSelectedModelName);
                  console.log('🔍 Debug: window.nativeSelectedModelURL =', window.nativeSelectedModelURL);
                  console.log('🔍 Debug: window.initialBackgroundUrl =', window.initialBackgroundUrl);
                  true;
                `);
              }}
            >
              <Text style={styles.buttonText}>🐛 Debug JS</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'pink',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'pink',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  statusText: {
    color: '#888',
    fontSize: 14,
  },
  debugPanel: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    maxHeight: 300,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  debugScroll: {
    maxHeight: 280,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  debugError: {
    color: '#ff6b6b',
    fontSize: 12,
    marginBottom: 4,
  },
  debugLog: {
    color: '#888',
    fontSize: 10,
    marginLeft: 10,
    marginBottom: 2,
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: 'rgba(0, 122, 255, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
