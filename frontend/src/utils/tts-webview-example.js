/**
 * Example React Native WebView integration for TTS
 * Add this to your WebView project's App.js or wherever you have the WebView
 */

import React, { useRef } from 'react';
import { WebView } from 'react-native-webview';
import * as Speech from 'expo-speech';  // Or use react-native-tts

export default function App() {
    const webViewRef = useRef(null);

    const handleMessage = (event) => {
        try {
            const message = JSON.parse(event.nativeEvent.data);

            // Handle TTS requests from WebView
            if (message.type === 'TTS_SPEAK') {
                const { text, lang, rate, pitch } = message;

                // Using expo-speech (if you have Expo)
                Speech.speak(text, {
                    language: lang || 'hi-IN',
                    rate: rate || 0.9,
                    pitch: pitch || 1.0
                });

                // OR using react-native-tts (if you're using that)
                // import Tts from 'react-native-tts';
                // Tts.setDefaultLanguage(lang || 'hi-IN');
                // Tts.setDefaultRate(rate || 0.9);
                // Tts.setDefaultPitch(pitch || 1.0);
                // Tts.speak(text);
            }
        } catch (e) {
            console.error('[WebView] Message handling error:', e);
        }
    };

    return (
        <WebView
            ref={webViewRef}
            source={{ uri: 'https://yourapp.com' }}  // Your attendance app URL
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            // Allow camera for face recognition
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
        />
    );
}

/**
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. Install TTS package:
 *    - For Expo: npx expo install expo-speech
 *    - For React Native: npm install react-native-tts
 * 
 * 2. Copy the handleMessage logic above to your WebView project
 * 
 * 3. Add onMessage prop to your WebView component
 * 
 * 4. That's it! TTS will now work from the web interface
 */
