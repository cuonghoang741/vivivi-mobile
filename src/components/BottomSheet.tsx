import React, { useRef, useCallback, useImperativeHandle, forwardRef, useEffect, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp, Platform, Modal } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';

export type BottomSheetRef = {
    present: (index?: number) => void;
    dismiss: () => void;
};

type BottomSheetProps = {
    // Control
    isOpened?: boolean;
    onIsOpenedChange?: (opened: boolean) => void;
    onDismiss?: () => void;

    // Appearance
    title?: string;
    isDarkBackground?: boolean;
    detents?: (number | 'auto' | 'medium' | 'large')[];
    cornerRadius?: number;
    grabber?: boolean;

    // Header customization
    headerLeft?: ReactNode;
    headerRight?: ReactNode;
    showCloseButton?: boolean;

    // Content
    children: ReactNode;
    contentContainerStyle?: StyleProp<ViewStyle>;
    backgroundBlur?: 'dark' | 'light' | 'system-thick-material-dark'
    backgroundColor?: string
};

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({
    isOpened,
    onIsOpenedChange,
    onDismiss,
    title,
    isDarkBackground = true,
    detents = [0.6, 0.9],
    cornerRadius = 24,
    grabber = true,
    headerLeft,
    headerRight,
    showCloseButton = true,
    children,
    contentContainerStyle,
    backgroundBlur,
    backgroundColor
}, ref) => {
    const sheetRef = useRef<TrueSheet>(null);

    const [androidVisible, setAndroidVisible] = React.useState(false);

    // Dynamic colors based on background
    const textColor = isDarkBackground ? '#fff' : '#000';
    const closeButtonBg = isDarkBackground ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

    // Expose present/dismiss via ref
    useImperativeHandle(ref, () => ({
        present: (index?: number) => {
            if (Platform.OS === 'android') {
                setAndroidVisible(true);
            } else {
                sheetRef.current?.present(index ?? 0);
            }
            onIsOpenedChange?.(true);
        },
        dismiss: () => {
            if (Platform.OS === 'android') {
                setAndroidVisible(false);
                onIsOpenedChange?.(false);
                onDismiss?.();
            } else {
                sheetRef.current?.dismiss();
                onIsOpenedChange?.(false);
                onDismiss?.();
            }
        },
    }));

    // Sync with external isOpened prop
    useEffect(() => {
        if (isOpened) {
            if (Platform.OS === 'android') {
                setAndroidVisible(true);
            } else {
                sheetRef.current?.present(0);
            }
        } else if (isOpened === false) {
            if (Platform.OS === 'android') {
                setAndroidVisible(false);
            } else {
                sheetRef.current?.dismiss();
            }
        }
    }, [isOpened]);

    const handleDismiss = useCallback(() => {
        onIsOpenedChange?.(false);
        onDismiss?.();
    }, [onIsOpenedChange, onDismiss]);

    const handleClose = useCallback(() => {
        if (Platform.OS === 'android') {
            setAndroidVisible(false);
            onIsOpenedChange?.(false);
            onDismiss?.();
        } else {
            sheetRef.current?.dismiss();
        }
    }, [onIsOpenedChange, onDismiss]);

    const renderHeader = () => {
        // If no title and no custom header components and no close button, skip header
        if (!title && !headerLeft && !headerRight && !showCloseButton) {
            return null;
        }

        return (
            <View style={styles.header}>
                {/* Left side */}
                <View style={styles.headerLeft}>
                    {headerLeft}
                </View>

                {/* Title (centered) */}
                <View style={styles.headerCenter}>
                    {title && (
                        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
                            {title}
                        </Text>
                    )}
                </View>

                {/* Right side */}
                <View style={styles.headerRight}>
                    {headerRight ?? (
                        showCloseButton && (
                            <Pressable
                                style={[styles.closeButton, { backgroundColor: closeButtonBg }]}
                                onPress={handleClose}
                            >
                                <Ionicons name="close" size={20} color={textColor} />
                            </Pressable>
                        )
                    )}
                </View>
            </View>
        );
    };

    if (Platform.OS === 'android') {
        const bgColor = isDarkBackground ? '#1e1e1e' : '#ffffff';
        return (
            <Modal
                visible={androidVisible}
                transparent
                animationType="slide"
                onRequestClose={handleClose}
            >
                <Pressable style={styles.androidBackdrop} onPress={handleClose}>
                    <View style={[styles.androidSheetContainer, { backgroundColor: bgColor, borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius }]}>
                        <Pressable style={{ flex: 1 }} onPress={(e) => e.stopPropagation()}>
                            <View style={[styles.container, contentContainerStyle]}>
                                {renderHeader()}
                                {children}
                            </View>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        );
    }

    return (
        <TrueSheet
            ref={sheetRef}
            detents={detents}
            cornerRadius={cornerRadius}
            grabber={grabber}
            backgroundColor={backgroundColor ?? 'transparent'}
            backgroundBlur={backgroundBlur ? backgroundBlur : isDarkBackground ? 'dark' : 'light'}
            // backgroundBlur={'system-thick-material-dark'}
            onDidDismiss={handleDismiss}
            blurOptions={{
                intensity: backgroundBlur ? 100 : isDarkBackground ? 90 : 40,
                interaction: false,
            }}
        >
            <View style={[styles.container, contentContainerStyle]}>
                {renderHeader()}
                {children}
            </View>
        </TrueSheet>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        minHeight: 56,
    },
    headerLeft: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRight: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    androidBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    androidSheetContainer: {
        width: '100%',
        minHeight: '50%',
        maxHeight: '100%',
        overflow: 'hidden',
    },
});
