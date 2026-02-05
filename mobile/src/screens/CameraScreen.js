// Camera Screen - Face capture for check-in/out
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Alert, ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { HINDI } from '../config/constants';
import { api } from '../services/api';

export default function CameraScreen({ route, navigation }) {
    const { orgCode, employeeId, action, tripId } = route.params;
    const [permission, requestPermission] = useCameraPermissions();
    const [status, setStatus] = useState(HINDI.scanning);
    const [loading, setLoading] = useState(false);
    const cameraRef = useRef(null);

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, []);

    const speak = (text) => {
        Speech.speak(text, { language: 'hi-IN', rate: 0.9 });
    };

    const captureAndSubmit = async () => {
        if (!cameraRef.current || loading) return;

        setLoading(true);
        setStatus(HINDI.scanning);

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: false
            });

            setStatus('जांच हो रही है...');

            let result;
            if (action === 'checkin') {
                result = await api.driverCheckin(orgCode, employeeId, photo.uri);
            } else {
                result = await api.driverCheckout(tripId, employeeId, photo.uri);
            }

            if (result.success) {
                setStatus(action === 'checkin' ? HINDI.success : HINDI.successOut);
                speak(action === 'checkin' ? HINDI.voiceSuccess : HINDI.voiceSuccessOut);

                // Navigate after success
                setTimeout(() => {
                    if (action === 'checkin' && result.next_step === 'helper') {
                        navigation.navigate('HelperLogin', { tripId: result.trip_id });
                    } else {
                        navigation.replace('Dashboard', { orgCode, employeeId, employee: { name: employeeId } });
                    }
                }, 2000);
            } else {
                setStatus(`❌ ${result.error || HINDI.error}`);
                Alert.alert('Error', result.error || HINDI.error);
            }
        } catch (error) {
            console.error(error);
            setStatus(HINDI.error);
            Alert.alert('Error', 'Network error. कृपया फिर से try करें।');
        }

        setLoading(false);
    };

    if (!permission) {
        return <View style={styles.container}><Text>Loading...</Text></View>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.permissionText}>कैमरा permission चाहिए</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Permission दें</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, action === 'checkout' && styles.headerOrange]}>
                <Text style={styles.headerTitle}>
                    {action === 'checkin' ? '📥 Duty शुरू करें' : '📤 Duty खत्म करें'}
                </Text>
            </View>

            {/* Camera */}
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="front"
                />
                {/* Status Overlay */}
                <View style={styles.statusOverlay}>
                    <Text style={styles.statusText}>{status}</Text>
                </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.captureBtn, loading && styles.captureBtnDisabled]}
                    onPress={captureAndSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" size="large" />
                    ) : (
                        <Text style={styles.captureBtnText}>📸 चेहरा स्कैन करें</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.cancelBtnText}>{HINDI.cancel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    header: {
        backgroundColor: '#22c55e',
        padding: 16,
        paddingTop: 50,
        alignItems: 'center'
    },
    headerOrange: {
        backgroundColor: '#f59e0b'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700'
    },
    cameraContainer: {
        flex: 1,
        position: 'relative'
    },
    camera: {
        flex: 1
    },
    statusOverlay: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 16,
        borderRadius: 12
    },
    statusText: {
        color: '#22c55e',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600'
    },
    buttonContainer: {
        padding: 20,
        backgroundColor: '#111'
    },
    captureBtn: {
        backgroundColor: '#22c55e',
        padding: 20,
        borderRadius: 50,
        alignItems: 'center',
        marginBottom: 12
    },
    captureBtnDisabled: {
        opacity: 0.6
    },
    captureBtnText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700'
    },
    cancelBtn: {
        padding: 16,
        alignItems: 'center'
    },
    cancelBtnText: {
        color: '#fff',
        fontSize: 16
    },
    permissionText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20
    },
    permissionBtn: {
        backgroundColor: '#667eea',
        padding: 16,
        borderRadius: 12
    },
    permissionBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    }
});
