import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ModalLiquidGlass } from './ModalLiquidGlass';

type ConfirmDialogProps = {
    visible: boolean;
    title: string;
    message: string;
    cancelText?: string;
    confirmText?: string;
    onCancel: () => void;
    onConfirm: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    visible,
    title,
    message,
    cancelText = 'Cancel',
    confirmText = 'Confirm',
    onCancel,
    onConfirm,
}) => {
    return (
        <ModalLiquidGlass visible={visible} onRequestClose={onCancel}>
            <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>
                <View style={styles.buttonRow}>
                    <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                        <Text style={styles.cancelButtonText}>{cancelText}</Text>
                    </Pressable>
                    <Pressable style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
                        <Text style={styles.confirmButtonText}>{confirmText}</Text>
                    </Pressable>
                </View>
            </View>
        </ModalLiquidGlass>
    );
};

const styles = StyleSheet.create({
    content: {
        padding: 24,
        backgroundColor: '#fff',
        borderRadius: 20,
        marginHorizontal: 32,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#4a4a4a',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#f2f2f2',
    },
    confirmButton: {
        backgroundColor: '#111',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4a4a4a',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
