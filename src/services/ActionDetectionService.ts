/**
 * ActionDetectionService
 * 
 * Service to detect user intent/action from chat messages using Gemini AI.
 * This runs BEFORE the main chat response to determine if any special action should be triggered.
 */

import { getSupabaseClient } from './supabase';

// Define all available actions the app can perform
export type ActionType =
    | 'send_photo'
    | 'send_video'
    | 'change_background'
    | 'change_costume'
    | 'change_character'
    | 'play_animation'
    | 'start_voice_call'
    | 'start_video_call'
    | 'open_subscription'
    | 'none';

export interface DetectedAction {
    action: ActionType;
    confidence: number; // 0-1
    parameters?: {
        animationName?: string; // For play_animation action
        [key: string]: string | undefined;
    };
    reasoning?: string;
}

class ActionDetectionService {
    private client = getSupabaseClient();

    /**
     * Detect if the user's message implies any action by calling Gemini AI
     */
    async detectAction(userMessage: string): Promise<DetectedAction> {
        try {
            const trimmed = userMessage.trim();
            if (!trimmed || trimmed.length < 2) {
                return { action: 'none', confidence: 1.0 };
            }

            // Call the edge function for AI-based detection
            const { data, error } = await this.client.functions.invoke('gemini-suggest-action', {
                body: {
                    message: trimmed,
                },
            });

            if (error) {
                console.warn('[ActionDetectionService] Edge function error:', error);
                return { action: 'none', confidence: 1.0 };
            }

            // Parse the response
            const result = this.parseResponse(data);
            console.log('[ActionDetectionService] Detected:', result);
            return result;

        } catch (error) {
            console.warn('[ActionDetectionService] Detection failed:', error);
            return { action: 'none', confidence: 1.0 };
        }
    }

    /**
     * Parse AI response to DetectedAction
     */
    private parseResponse(data: any): DetectedAction {
        try {
            // Handle if data is already an object or needs parsing
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;

            // Validate action type
            const validActions: ActionType[] = [
                'send_photo', 'send_video',
                'change_background', 'change_costume', 'change_character',
                'play_animation', 'start_voice_call', 'start_video_call',
                'open_subscription', 'none'
            ];

            const action = validActions.includes(parsed.action) ? parsed.action : 'none';
            const confidence = typeof parsed.confidence === 'number'
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.5;

            return {
                action,
                confidence,
                parameters: parsed.parameters || {},
                reasoning: parsed.reasoning || '',
            };
        } catch (error) {
            console.warn('[ActionDetectionService] Failed to parse response:', error);
            return { action: 'none', confidence: 1.0 };
        }
    }
}

export const actionDetectionService = new ActionDetectionService();
