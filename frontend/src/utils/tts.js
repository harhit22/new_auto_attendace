/**
 * Cross-Platform Text-to-Speech Utility
 * Works in both regular browsers AND React Native WebView
 */

/**
 * Speak text using available TTS method
 * @param {string} text - Text to speak
 * @param {object} options - Optional TTS options
 */
export const speak = (text, options = {}) => {
    const {
        lang = 'hi-IN',  // Default to Hindi
        rate = 0.9,
        pitch = 1.0
    } = options;

    // Strategy 1: Try React Native WebView bridge (PRIORITY for Native App)
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'TTS_SPEAK',
                text: text,
                lang: lang,
                rate: rate,
                pitch: pitch
            }));
            console.log('[TTS] Sent to React Native:', text);
            return;
        } catch (e) {
            console.warn('[TTS] React Native bridge failed:', e);
        }
    }

    // Strategy 2: Try Web Speech API (fallback for regular browsers)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = rate;
            utterance.pitch = pitch;

            window.speechSynthesis.speak(utterance);
            console.log('[TTS] Using Web Speech API:', text);
            return;
        } catch (e) {
            console.warn('[TTS] Web Speech API failed:', e);
        }
    }

    // Strategy 3: Fallback - just log (for development/debugging)
    console.log('[TTS] No TTS available. Would speak:', text);
};

/**
 * Check if TTS is available
 * @returns {boolean}
 */
export const isTTSAvailable = () => {
    return (
        (typeof window !== 'undefined' && 'speechSynthesis' in window) ||
        (typeof window !== 'undefined' && window.ReactNativeWebView)
    );
};

/**
 * Detect if running in WebView
 * @returns {boolean}
 */
export const isWebView = () => {
    return typeof window !== 'undefined' && !!window.ReactNativeWebView;
};

export default { speak, isTTSAvailable, isWebView };
