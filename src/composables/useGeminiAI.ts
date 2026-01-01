/**
 * Google Gemini AI Integration
 * Provides AI-assisted text editing capabilities using Google's Gemini API
 * API key is stored in localStorage for persistence
 */

import { GoogleGenAI } from '@google/genai'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'md-viewer-gemini-api-key'
const MODEL_NAME = 'gemini-3-flash-preview'

// Singleton state
const apiKey = ref<string | null>(null)
const isProcessing = ref(false)
const error = ref<string | null>(null)

// Initialize from localStorage
function loadStoredApiKey(): string | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            apiKey.value = stored
            return stored
        }
    } catch (e) {
        console.error('Failed to load Gemini API key from localStorage:', e)
    }
    return null
}

// Save API key to localStorage
function saveApiKey(key: string): void {
    try {
        localStorage.setItem(STORAGE_KEY, key)
        apiKey.value = key
        error.value = null
    } catch (e) {
        console.error('Failed to save Gemini API key:', e)
        error.value = 'Failed to save API key'
    }
}

// Clear API key
function clearApiKey(): void {
    try {
        localStorage.removeItem(STORAGE_KEY)
        apiKey.value = null
        error.value = null
    } catch (e) {
        console.error('Failed to clear Gemini API key:', e)
    }
}

// Get AI client instance
function getClient(): GoogleGenAI | null {
    if (!apiKey.value) {
        error.value = 'API key not configured'
        return null
    }
    return new GoogleGenAI({ apiKey: apiKey.value })
}

export interface ChatMessage {
    role: 'user' | 'model'
    content: string
}

export function useGeminiAI() {
    // Computed state
    const isApiKeySet = computed(() => !!apiKey.value)

    // Initialize on first use
    if (!apiKey.value) {
        loadStoredApiKey()
    }

    /**
     * Test if the API key is valid by making a simple request
     */
    async function testConnection(): Promise<boolean> {
        const client = getClient()
        if (!client) return false

        try {
            isProcessing.value = true
            error.value = null

            const response = await client.models.generateContent({
                model: MODEL_NAME,
                contents: 'Say "Hello" in one word.',
            })

            return !!response.text
        } catch (e) {
            console.error('Gemini API test failed:', e)
            error.value = e instanceof Error ? e.message : 'API connection test failed'
            return false
        } finally {
            isProcessing.value = false
        }
    }

    /**
     * Improve text with AI - quick one-shot improvement
     * @param text - The text to improve
     * @param instruction - Optional specific instruction (e.g., "fix grammar", "make more formal")
     * @returns The improved text
     */
    async function improveText(text: string, instruction?: string): Promise<string> {
        const client = getClient()
        if (!client) {
            throw new Error('API key not configured')
        }

        try {
            isProcessing.value = true
            error.value = null

            const prompt = instruction
                ? `CRITICAL: Output ONLY the improved text. Do NOT include any explanations, options, preambles, or commentary. Do NOT say "Here is..." or "Option 1" or anything similar. Just output the final improved text directly.

Task: ${instruction}

Original text:
${text}

Improved text:`
                : `CRITICAL: Output ONLY the improved text. Do NOT include any explanations, options, preambles, or commentary. Do NOT say "Here is..." or "Okay, I will..." or anything similar. Just output the final improved text directly.

Task: Fix any grammar, spelling errors and make the text clearer while preserving the original meaning and language.

Original text:
${text}

Improved text:`

            const response = await client.models.generateContent({
                model: MODEL_NAME,
                contents: prompt,
            })

            const result = response.text
            if (!result) {
                throw new Error('No response from AI')
            }

            return result.trim()
        } catch (e) {
            console.error('Gemini API improve text failed:', e)
            error.value = e instanceof Error ? e.message : 'Failed to improve text'
            throw e
        } finally {
            isProcessing.value = false
        }
    }

    /**
     * Chat about text - for iterative editing with context
     * @param originalText - The original selected text for context
     * @param userMessage - The user's current message/instruction
     * @param history - Previous chat messages for context
     * @returns The AI's response
     */
    async function chatAboutText(
        originalText: string,
        userMessage: string,
        history: ChatMessage[] = []
    ): Promise<string> {
        const client = getClient()
        if (!client) {
            throw new Error('API key not configured')
        }

        try {
            isProcessing.value = true
            error.value = null

            // Build conversation context
            const systemContext = `You are a text editing assistant. STRICT RULES:
1. When asked to modify/improve/rewrite text, output ONLY the final result
2. NEVER provide multiple options - give exactly ONE best version
3. NEVER start with "Okay", "Here are", "Here is", "Sure", or any preamble
4. NEVER use **Option 1**, **Option 2** format
5. Keep the same language as the original unless translation is requested
6. For explanatory questions, you may respond normally

The user is editing this text:
---
${originalText}
---`

            // Build the full prompt with history
            let fullPrompt = systemContext + '\n\n'

            for (const msg of history) {
                const role = msg.role === 'user' ? 'User' : 'Assistant'
                fullPrompt += `${role}: ${msg.content}\n\n`
            }

            fullPrompt += `User: ${userMessage}\n\nAssistant (remember: output only the final text, no options or preambles):`

            const response = await client.models.generateContent({
                model: MODEL_NAME,
                contents: fullPrompt,
            })

            const result = response.text
            if (!result) {
                throw new Error('No response from AI')
            }

            return result.trim()
        } catch (e) {
            console.error('Gemini API chat failed:', e)
            error.value = e instanceof Error ? e.message : 'Failed to get AI response'
            throw e
        } finally {
            isProcessing.value = false
        }
    }

    /**
     * Quick actions - predefined prompts for common operations
     */
    const quickActions = [
        { id: 'improve', label: 'Improve writing', icon: 'mdi-auto-fix', prompt: 'Improve this text' },
        { id: 'grammar', label: 'Fix grammar', icon: 'mdi-spellcheck', prompt: 'Fix grammar and spelling errors' },
        { id: 'concise', label: 'Make concise', icon: 'mdi-text-short', prompt: 'Make this more concise' },
        { id: 'expand', label: 'Expand', icon: 'mdi-text-long', prompt: 'Expand this with more detail' },
        { id: 'formal', label: 'Make formal', icon: 'mdi-tie', prompt: 'Rewrite in a more formal tone' },
        { id: 'casual', label: 'Make casual', icon: 'mdi-emoticon-outline', prompt: 'Rewrite in a more casual, friendly tone' },
        { id: 'translate-en', label: 'To English', icon: 'mdi-translate', prompt: 'Translate this text to English' },
        { id: 'translate-zh', label: 'To 中文', icon: 'mdi-translate', prompt: 'Translate this text to Traditional Chinese (繁體中文)' },
    ]

    return {
        // State
        isApiKeySet,
        isProcessing,
        error,
        apiKey: computed(() => apiKey.value),

        // API key management
        setApiKey: saveApiKey,
        clearApiKey,
        getApiKey: () => apiKey.value,

        // AI functions
        testConnection,
        improveText,
        chatAboutText,

        // Quick actions
        quickActions,
    }
}
