// Helper Login Screen
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import * as Speech from 'expo-speech';
import { HINDI } from '../config/constants';
import { api } from '../services/api';

export default function HelperLoginScreen({ route, navigation }) {
    const { tripId } = route.params;
    const [helperId, setHelperId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const speak = (text) => {
        Speech.speak(text, { language: 'hi-IN', rate: 0.9 });
    };

    const handleContinue = () => {
        if (!helperId.trim()) {
            Alert.alert('Error', 'Helper ID डालें');
            return;
        }
        speak('Helper, apna chehra dikhaye');
        navigation.navigate('HelperCamera', {
            tripId,
            helperId: helperId.trim(),
            password: password
        });
    };

    const handleSkip = async () => {
        setLoading(true);
        try {
            const result = await api.skipHelper(tripId);
            if (result.success) {
                navigation.replace('Dashboard', {
                    orgCode: '',
                    employeeId: '',
                    employee: {}
                });
            } else {
                Alert.alert('Error', result.error || 'Skip failed');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error');
        }
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>👷 Helper की Duty</Text>
            </View>

            {/* Form */}
            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Helper की ID डालें</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Helper ID"
                        placeholderTextColor="#999"
                        value={helperId}
                        onChangeText={setHelperId}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password (वैकल्पिक)"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity style={styles.button} onPress={handleContinue}>
                        <Text style={styles.buttonText}>आगे बढ़ें →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleSkip}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#f59e0b" />
                        ) : (
                            <Text style={styles.skipButtonText}>Helper नहीं है (Skip)</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    header: {
        backgroundColor: '#f59e0b',
        padding: 20,
        paddingTop: 50,
        alignItems: 'center'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700'
    },
    content: {
        flex: 1,
        padding: 20
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 20,
        textAlign: 'center'
    },
    input: {
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 12
    },
    button: {
        backgroundColor: '#f59e0b',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    },
    skipButton: {
        padding: 16,
        alignItems: 'center',
        marginTop: 12
    },
    skipButtonText: {
        color: '#f59e0b',
        fontSize: 16,
        fontWeight: '600'
    }
});
