/**
 * Google Docs 同步功能
 * 使用 Google Drive API 和 Google Docs API 進行資料同步
 * 所有登入資訊（OAuth tokens）都存在本地 localStorage
 */

import { ref, computed } from 'vue'

// Google OAuth 設定 - 使用者需要在 Google Cloud Console 建立專案並取得 Client ID
const GOOGLE_CLIENT_ID = '' // 使用者需要填入自己的 Client ID
const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',      // 只能存取由此應用建立的檔案
    'https://www.googleapis.com/auth/userinfo.email',  // 取得使用者 email
    'https://www.googleapis.com/auth/userinfo.profile' // 取得使用者名稱和大頭貼
].join(' ')

// 取得 hostname 用於區分不同部署
const getHostname = () => typeof window !== 'undefined' ? window.location.hostname : 'unknown'

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'md-viewer-google-access-token',
    REFRESH_TOKEN: 'md-viewer-google-refresh-token',
    TOKEN_EXPIRY: 'md-viewer-google-token-expiry',
    USER_INFO: 'md-viewer-google-user-info',
    // SYNC_FILE_ID 使用 hostname 前綴，讓不同部署使用不同的檔案
    get SYNC_FILE_ID() { return `md-viewer-google-sync-file-id-${getHostname()}` },
    CLIENT_ID: 'md-viewer-google-client-id'
}

export interface GoogleUserInfo {
    email: string
    name: string
    picture?: string
}

export interface SyncStatus {
    isConnected: boolean
    isSyncing: boolean
    lastSyncTime: number | null
    error: string | null
}

// 單例狀態
const accessToken = ref<string | null>(null)
const userInfo = ref<GoogleUserInfo | null>(null)
const syncFileId = ref<string | null>(null)
const isSyncing = ref(false)
const lastCloudModifiedTime = ref<string | null>(null) // 上次同步時，雲端檔案的修改時間
const lastSyncTime = ref<number | null>(null)
const syncError = ref<string | null>(null)
const clientId = ref<string>(GOOGLE_CLIENT_ID)
// ... (existing code)

// 檢查雲端檔案狀態
async function checkCloudFileStatus(fileId: string): Promise<{ modifiedTime: string }> {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken.value}`
            }
        }
    )

    if (!response.ok) {
        throw new Error(`Failed to check file status: ${response.status}`)
    }

    return await response.json()
}


function loadStoredAuth() {
    try {
        const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
        const storedExpiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY)
        const storedUserInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO)
        const storedFileId = localStorage.getItem(STORAGE_KEYS.SYNC_FILE_ID)
        const storedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID)

        if (storedClientId) {
            clientId.value = storedClientId
        }

        if (storedToken && storedExpiry) {
            const expiry = parseInt(storedExpiry, 10)
            if (Date.now() < expiry) {
                accessToken.value = storedToken
                if (storedUserInfo) {
                    userInfo.value = JSON.parse(storedUserInfo)
                }
                if (storedFileId) {
                    syncFileId.value = storedFileId
                }
            } else {
                // Token 過期，清除
                clearStoredAuth()
            }
        }
    } catch (error) {
        console.error('Failed to load stored auth:', error)
        clearStoredAuth()
    }
}

function saveAuth(token: string, expiresIn: number, user: GoogleUserInfo) {
    const expiry = Date.now() + expiresIn * 1000
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token)
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString())
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user))

    accessToken.value = token
    userInfo.value = user
}

function clearStoredAuth() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY)
    localStorage.removeItem(STORAGE_KEYS.USER_INFO)
    localStorage.removeItem(STORAGE_KEYS.SYNC_FILE_ID)

    accessToken.value = null
    userInfo.value = null
    syncFileId.value = null
}

function saveClientId(id: string) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id)
    clientId.value = id
}

function saveSyncFileId(fileId: string) {
    localStorage.setItem(STORAGE_KEYS.SYNC_FILE_ID, fileId)
    syncFileId.value = fileId
}

export function useGoogleDocs() {
    // Computed
    const isConnected = computed(() => !!accessToken.value && !!userInfo.value)

    const syncStatus = computed<SyncStatus>(() => ({
        isConnected: isConnected.value,
        isSyncing: isSyncing.value,
        lastSyncTime: lastSyncTime.value,
        error: syncError.value
    }))

    // 初始化 - 載入已存的登入資訊
    function initialize() {
        loadStoredAuth()

        // 如果有檔案，嘗試取得其最新狀態
        if (syncFileId.value && accessToken.value) {
            checkCloudFileStatus(syncFileId.value)
                .then(status => {
                    lastCloudModifiedTime.value = status.modifiedTime
                })
                .catch(e => {
                    console.warn('[Sync] Failed to check initial cloud file status', e)
                })
        }
    }

    // 設定 Client ID
    function setClientId(id: string) {
        saveClientId(id)
    }

    // 取得 Client ID
    function getClientId(): string {
        return clientId.value
    }

    // 使用 OAuth 2.0 Implicit Grant Flow 登入
    // 改用頁面重定向（而非 popup）以避免跨來源問題
    async function signIn(): Promise<boolean> {
        if (!clientId.value) {
            syncError.value = 'Please set Google Client ID first'
            return false
        }

        try {
            syncError.value = null

            // 建立 OAuth URL
            const redirectUri = window.location.origin + window.location.pathname
            const state = Math.random().toString(36).substring(2)

            // 儲存 state 到 localStorage（因為頁面會重定向，sessionStorage 可能不可靠）
            localStorage.setItem('oauth_state', state)
            localStorage.setItem('oauth_pending', 'true')

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
            authUrl.searchParams.set('client_id', clientId.value)
            authUrl.searchParams.set('redirect_uri', redirectUri)
            authUrl.searchParams.set('response_type', 'token')
            authUrl.searchParams.set('scope', GOOGLE_SCOPES)
            authUrl.searchParams.set('state', state)
            authUrl.searchParams.set('prompt', 'consent')
            authUrl.searchParams.set('include_granted_scopes', 'true')

            // 直接重定向到 Google 登入頁面
            window.location.href = authUrl.toString()

            // 這個 Promise 不會 resolve，因為頁面會被重定向
            return new Promise(() => { })
        } catch (error) {
            console.error('Sign in failed:', error)
            syncError.value = 'Sign in failed: ' + (error as Error).message
            return false
        }
    }

    // 處理 OAuth 回調（從 URL hash 取得 token）
    // 當頁面從 Google 重定向回來時呼叫
    function handleOAuthCallback(): boolean {
        const hash = window.location.hash

        console.log('[OAuth] Checking callback, hash:', hash)

        // 檢查是否有 OAuth 回調
        if (!hash.includes('access_token=')) {
            console.log('[OAuth] No access_token in hash')
            // 清除任何未完成的登入狀態
            if (localStorage.getItem('oauth_pending')) {
                localStorage.removeItem('oauth_pending')
            }
            return false
        }

        console.log('[OAuth] Found access_token, processing...')

        try {
            const params = new URLSearchParams(hash.substring(1))
            const token = params.get('access_token')
            const expiresIn = parseInt(params.get('expires_in') || '3600', 10)
            const state = params.get('state')

            console.log('[OAuth] State from URL:', state)
            console.log('[OAuth] State from localStorage:', localStorage.getItem('oauth_state'))

            // 驗證 state（從 localStorage 讀取）
            const savedState = localStorage.getItem('oauth_state')
            if (state !== savedState) {
                console.error('[OAuth] State mismatch!')
                syncError.value = 'OAuth state validation failed'
                localStorage.removeItem('oauth_pending')
                localStorage.removeItem('oauth_state')
                return false
            }

            console.log('[OAuth] State validated!')

            // 清除 OAuth 狀態
            localStorage.removeItem('oauth_pending')
            localStorage.removeItem('oauth_state')

            if (token) {
                console.log('[OAuth] Token received, fetching user info...')

                // 清除 URL hash（保持乾淨的 URL）
                window.history.replaceState(null, '', window.location.pathname)

                // 立即儲存 token
                accessToken.value = token

                // 取得使用者資訊
                fetchUserInfo(token).then(user => {
                    if (user) {
                        saveAuth(token, expiresIn, user)
                        console.log('[OAuth] Successfully logged in as:', user.email)
                    } else {
                        console.error('[OAuth] Failed to get user info')
                    }
                })

                return true
            }
        } catch (error) {
            console.error('[OAuth] Callback error:', error)
            syncError.value = 'Error processing login callback'
            localStorage.removeItem('oauth_pending')
            localStorage.removeItem('oauth_state')
        }

        return false
    }

    // 取得使用者資訊
    async function fetchUserInfo(token: string): Promise<GoogleUserInfo | null> {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch user info')
            }

            const data = await response.json()
            return {
                email: data.email,
                name: data.name,
                picture: data.picture
            }
        } catch (error) {
            console.error('Failed to fetch user info:', error)
            syncError.value = 'Failed to get user info'
            return null
        }
    }

    // 登出
    function signOut() {
        clearStoredAuth()
        syncError.value = null
        lastSyncTime.value = null
    }

    // 建立或更新 Google Doc
    // force: 是否強制覆蓋（忽略衝突）
    async function syncToGoogleDocs(data: object, force: boolean = false): Promise<'success' | 'conflict' | 'error'> {
        if (!accessToken.value) {
            syncError.value = 'Not signed in to Google'
            return 'error'
        }

        isSyncing.value = true
        syncError.value = null

        try {
            const content = JSON.stringify(data, null, 2)

            if (syncFileId.value) {
                // 檢查衝突
                if (!force) {
                    try {
                        const status = await checkCloudFileStatus(syncFileId.value)
                        // 如果雲端時間比我們記錄的還新，表示有其他變更
                        // 注意：這裡簡單用字串比較 ISO 時間，Google Drive 時間格式是 ISO 8601
                        if (lastCloudModifiedTime.value && status.modifiedTime > lastCloudModifiedTime.value) {
                            console.warn('Conflict detected: remote file is newer')
                            return 'conflict'
                        }
                    } catch (e) {
                        console.warn('Failed to check cloud status, proceeding with caution', e)
                    }
                }

                // 更新現有檔案
                const updatedMetadata = await updateGoogleDoc(syncFileId.value, content)
                lastCloudModifiedTime.value = updatedMetadata.modifiedTime
            } else {
                // 建立新檔案
                const fileId = await createGoogleDoc(content)
                if (fileId) {
                    saveSyncFileId(fileId)
                    // 剛建立的檔案，取得其時間作為基準
                    try {
                        const status = await checkCloudFileStatus(fileId)
                        lastCloudModifiedTime.value = status.modifiedTime
                    } catch (e) {
                        console.warn('Failed to get initial file time', e)
                    }
                }
            }

            lastSyncTime.value = Date.now()
            return 'success'
        } catch (error) {
            console.error('Sync failed:', error)
            syncError.value = 'Sync failed: ' + (error as Error).message

            // 如果是 token 過期，清除登入狀態
            if ((error as Error).message.includes('401')) {
                clearStoredAuth()
            }

            return 'error'
        } finally {
            isSyncing.value = false
        }
    }

    // 從 Google Doc 載入資料
    async function loadFromGoogleDocs(): Promise<object | null> {
        if (!accessToken.value || !syncFileId.value) {
            return null
        }

        isSyncing.value = true
        syncError.value = null

        try {
            // 同時取得內容和 metadata
            // 注意：getGoogleDocContent 只回傳內容，我們需要另外取得時間，或修改它
            // 這裡為了簡單，先分兩次呼叫，雖然稍微慢一點
            const content = await getGoogleDocContent(syncFileId.value)

            try {
                const status = await checkCloudFileStatus(syncFileId.value)
                lastCloudModifiedTime.value = status.modifiedTime
            } catch (e) {
                console.warn('Failed to update cloud modified time after load', e)
            }

            if (content) {
                lastSyncTime.value = Date.now()
                return JSON.parse(content)
            }
            return null
        } catch (error) {
            console.error('Load from Google Docs failed:', error)
            syncError.value = '從 Google Docs 載入失敗: ' + (error as Error).message
            return null
        } finally {
            isSyncing.value = false
        }
    }

    // 建立 Google Doc（使用 Drive API 建立純文字檔案）
    async function createGoogleDoc(content: string): Promise<string | null> {
        // 使用網址前綴來區分不同部署的資料檔案
        const hostname = window.location.hostname
        const fileName = `MD Viewer Data [${hostname}].json`

        const metadata = {
            name: fileName,
            mimeType: 'application/json'
        }

        const formData = new FormData()
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        formData.append('file', new Blob([content], { type: 'application/json' }))

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`
                },
                body: formData
            }
        )

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Failed to create file: ${response.status} ${error}`)
        }

        const result = await response.json()
        return result.id
    }

    // 更新 Google Doc
    async function updateGoogleDoc(fileId: string, content: string): Promise<{ id: string, modifiedTime: string }> {
        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,modifiedTime`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`,
                    'Content-Type': 'application/json'
                },
                body: content
            }
        )

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Failed to update file: ${response.status} ${error}`)
        }

        return await response.json()
    }

    // 取得 Google Doc 內容
    async function getGoogleDocContent(fileId: string): Promise<string | null> {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`
                }
            }
        )

        if (!response.ok) {
            if (response.status === 404) {
                // 檔案不存在，清除 file ID
                localStorage.removeItem(STORAGE_KEYS.SYNC_FILE_ID)
                syncFileId.value = null
                return null
            }
            throw new Error(`Failed to get file: ${response.status}`)
        }

        return await response.text()
    }

    // 清除同步檔案關聯（但不登出）
    function clearSyncFile() {
        localStorage.removeItem(STORAGE_KEYS.SYNC_FILE_ID)
        syncFileId.value = null
    }

    return {
        // State
        isConnected,
        userInfo,
        syncStatus,
        clientId: computed(() => clientId.value),
        hasSyncFile: computed(() => !!syncFileId.value),

        // Actions
        initialize,
        setClientId,
        getClientId,
        signIn,
        signOut,
        handleOAuthCallback,
        syncToGoogleDocs,
        loadFromGoogleDocs,
        clearSyncFile
    }
}
