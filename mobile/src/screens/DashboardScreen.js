// Dashboard Screen - Simple Hindi design
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    StatusBar, Alert, ScrollView, RefreshControl
} from 'react-native';
import * as Speech from 'expo-speech';
import { HINDI } from '../config/constants';
import { api } from '../services/api';

export default function DashboardScreen({ route, navigation }) {
    const { orgCode, employeeId, employee } = route.params;
    const [dashboard, setDashboard] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadDashboard = async () => {
        try {
            const data = await api.getDashboard(orgCode, employeeId);
            setDashboard(data);
        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadDashboard();
        setRefreshing(false);
    }, []);

    const speak = (text) => {
        Speech.speak(text, { language: 'hi-IN', rate: 0.9 });
    };

    const handleCheckin = () => {
        speak(HINDI.voiceCheckin);
        navigation.navigate('Camera', {
            orgCode,
            employeeId,
            action: 'checkin'
        });
    };

    const handleCheckout = async () => {
        speak(HINDI.voiceCheckout);
        // Get active trip first
        try {
            const tripData = await api.getActiveTrip(orgCode, employeeId);
            if (tripData.found) {
                navigation.navigate('Camera', {
                    orgCode,
                    employeeId,
                    action: 'checkout',
                    tripId: tripData.trip_id
                });
            } else {
                Alert.alert('Error', 'कोई active trip नहीं है');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error');
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'क्या आप logout करना चाहते हैं?', [
            { text: 'रद्द करें', style: 'cancel' },
            { text: 'हां', onPress: () => navigation.replace('Login') }
        ]);
    };

    const isCheckedIn = dashboard?.today?.checked_in;
    const isCheckedOut = dashboard?.today?.checked_out;
    const dutyRunning = isCheckedIn && !isCheckedOut;

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#22c55e" barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcome}>🙏 स्वागत है</Text>
                    <Text style={styles.name}>{employee?.name || employeeId}</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>{HINDI.logout}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Duty Buttons */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📷 Duty दर्ज करें</Text>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonGreen, dutyRunning && styles.buttonDisabled]}
                        onPress={handleCheckin}
                        disabled={dutyRunning}
                    >
                        <Text style={styles.buttonTextWhite}>📥 {HINDI.dutyIn}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonOrange, !dutyRunning && styles.buttonDisabled]}
                        onPress={handleCheckout}
                        disabled={!dutyRunning}
                    >
                        <Text style={styles.buttonTextWhite}>📤 {HINDI.dutyOut}</Text>
                    </TouchableOpacity>
                </View>

                {/* Today's Status */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📅 {HINDI.todayStatus}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBox, isCheckedIn && styles.statusBoxGreen]}>
                            <Text style={styles.statusEmoji}>{isCheckedIn ? '✅' : '⏳'}</Text>
                            <Text style={styles.statusLabel}>
                                {isCheckedIn ? HINDI.dutyStarted : 'Duty शुरू नहीं'}
                            </Text>
                            <Text style={styles.statusTime}>{isCheckedIn || HINDI.notYet}</Text>
                        </View>
                        <View style={[styles.statusBox, isCheckedOut && styles.statusBoxGreen]}>
                            <Text style={styles.statusEmoji}>{isCheckedOut ? '✅' : '⏳'}</Text>
                            <Text style={styles.statusLabel}>
                                {isCheckedOut ? HINDI.dutyEnded : 'Duty चालू है'}
                            </Text>
                            <Text style={styles.statusTime}>{isCheckedOut || HINDI.notYet}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    header: {
        backgroundColor: '#22c55e',
        padding: 20,
        paddingTop: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    welcome: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14
    },
    name: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700'
    },
    logoutBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20
    },
    logoutText: {
        color: '#fff',
        fontWeight: '600'
    },
    content: {
        flex: 1,
        padding: 16
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center'
    },
    button: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12
    },
    buttonGreen: {
        backgroundColor: '#22c55e'
    },
    buttonOrange: {
        backgroundColor: '#f59e0b'
    },
    buttonDisabled: {
        opacity: 0.4
    },
    buttonTextWhite: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    },
    statusRow: {
        flexDirection: 'row',
        gap: 12
    },
    statusBox: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center'
    },
    statusBoxGreen: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)'
    },
    statusEmoji: {
        fontSize: 32,
        marginBottom: 8
    },
    statusLabel: {
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 4
    },
    statusTime: {
        color: '#666',
        fontSize: 12
    }
});
