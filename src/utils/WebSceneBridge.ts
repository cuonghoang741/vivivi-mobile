import { RefObject } from 'react';
import { WebView } from 'react-native-webview';

export class WebSceneBridge {
  private webViewRef: RefObject<WebView> | null = null;
  private lastParallaxSentAt: number = 0;
  private readonly parallaxMinInterval: number = 1000 / 45; // ~45 fps

  constructor(webViewRef: RefObject<WebView> | null) {
    this.webViewRef = webViewRef;
  }

  update(webViewRef: RefObject<WebView> | null) {
    this.webViewRef = webViewRef;
  }

  getWebViewRef(): RefObject<WebView> | null {
    return this.webViewRef;
  }

  setCallMode(enabled: boolean) {
    const js = `window.setCallMode && window.setCallMode(${enabled ? 'true' : 'false'});`;
    this.evaluate(js);
  }

  applyParallax(dx: number, dy: number) {
    const now = Date.now();
    if (now - this.lastParallaxSentAt < this.parallaxMinInterval) {
      return;
    }
    this.lastParallaxSentAt = now;
    const js = `window.applyParallax && window.applyParallax(${dx}, ${dy});`;
    this.evaluate(js);
  }

  triggerDance() {
    const js = 'window.triggerDance && window.triggerDance();';
    this.evaluate(js);
  }

  loadAnimationByName(animName: string) {
    const safeName = animName.replace(/'/g, "\\'");
    const js = `window.loadAnimationByName && window.loadAnimationByName('${safeName}');`;
    this.evaluate(js);
  }

  playSpeech(text: string) {
    const duration = Math.min(Math.max(text.length * 60, 1500), 6000);
    const js = `
      (function(){
        if(window.setMouthOpen){
          window.setMouthOpen(0.6);
          setTimeout(() => window.setMouthOpen(0.05), ${duration});
        }
      })();
    `;
    this.evaluate(js);
  }

  setMouthOpen(value: number) {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    const js = `window.setMouthOpen && window.setMouthOpen(${clamped.toFixed(3)});`;
    this.evaluate(js);
  }

  loadModel(js: string) {
    this.evaluate(js);
  }

  private evaluate(script: string) {
    if (this.webViewRef?.current) {
      this.webViewRef.current.injectJavaScript(script);
    }
  }
}

