// Login Screen - Simple Hindi design
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, StatusBar, Alert, ActivityIndicator
} from 'react-native';
import { HINDI } from '../config/constants';
import { api } from '../services/api';

export default function LoginScreen({ navigation }) {
    const [orgCode, setOrgCode] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!orgCode.trim() || !employeeId.trim()) {
            Alert.alert('Error', 'कृपया सभी फ़ील्ड भरें');
            return;
        }

        setLoading(true);
        try {
            const result = await api.login(orgCode.trim(), employeeId.trim());
            if (result.success) {
                navigation.replace('Dashboard', {
                    orgCode: orgCode.trim(),
                    employeeId: employeeId.trim(),
                    employee: result.employee
                });
            } else {
                Alert.alert('Error', result.error || 'Login failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error. Please try again.');
        }
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <StatusBar backgroundColor="#667eea" barStyle="light-content" />

            {/* Logo */}
            <Text style={styles.logo}>🚗</Text>
            <Text style={styles.title}>Driver Duty System</Text>
            <Text style={styles.subtitle}>Face से अपनी Duty दर्ज करें</Text>

            {/* Form */}
            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder={HINDI.enterOrgCode}
                    placeholderTextColor="#999"
                    value={orgCode}
                    onChangeText={setOrgCode}
                    autoCapitalize="characters"
                />
                <TextInput
                    style={styles.input}
                    placeholder={HINDI.enterEmployeeId}
                    placeholderTextColor="#999"
                    value={employeeId}
                    onChangeText={setEmployeeId}
                />

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#667eea" />
                    ) : (
                        <Text style={styles.buttonText}>🔐 {HINDI.login}</Text>
                    )}
                </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Powered by FaceAI</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#667eea',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    logo: {
        fontSize: 80,
        marginBottom: 10
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 40
    },
    form: {
        width: '100%',
        maxWidth: 320
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 12
    },
    button: {
        backgroundColor: '#fff',
        padding: 18,
        borderRadius: 50,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8
    },
    buttonDisabled: {
        opacity: 0.7
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#667eea'
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12
    }
});
