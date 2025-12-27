/**
 * Google Docs 同步功能
 * 使用 Google Drive API 和 Google Docs API 進行資料同步
 * 所有登入資訊（OAuth tokens）都存在本地 localStorage
 */

import { computed, ref } from 'vue'

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
    // 資料夾 ID（存放主檔案和備份）
    get SYNC_FOLDER_ID() { return `md-viewer-google-sync-folder-id-${getHostname()}` },
    // 備份資料夾 ID
    get BACKUP_FOLDER_ID() { return `md-viewer-google-backup-folder-id-${getHostname()}` },
    // 上次備份日期
    get LAST_BACKUP_DATE() { return `md-viewer-google-last-backup-date-${getHostname()}` },
    CLIENT_ID: 'md-viewer-google-client-id'
}

// 資料夾名稱（包含 hostname 以區分不同環境）
const getSyncFolderName = () => `MD-Viewer-Data [${getHostname()}]`
const BACKUP_FOLDER_NAME = 'backups'
const DATA_FILE_NAME = 'data.json'

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

export interface BackupFile {
    id: string
    name: string
    date: string
    modifiedTime: string
}

// 單例狀態
const accessToken = ref<string | null>(null)
const userInfo = ref<GoogleUserInfo | null>(null)
const syncFileId = ref<string | null>(null)
const syncFolderId = ref<string | null>(null)
const backupFolderId = ref<string | null>(null)
const backupFiles = ref<BackupFile[]>([])
const isSyncing = ref(false)
const lastCloudModifiedTime = ref<string | null>(null) // 上次同步時，雲端檔案的修改時間
const lastSyncTime = ref<number | null>(null)
const syncError = ref<string | null>(null)
const clientId = ref<string>(GOOGLE_CLIENT_ID)

// 衝突相關狀態
const hasConflict = ref(false)  // 是否有未解決的衝突
const conflictCloudTime = ref<string | null>(null)  // 衝突時雲端的修改時間
const autoSyncPaused = ref(false)  // 自動同步是否暫停（因衝突）
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
        const storedFolderId = localStorage.getItem(STORAGE_KEYS.SYNC_FOLDER_ID)
        const storedBackupFolderId = localStorage.getItem(STORAGE_KEYS.BACKUP_FOLDER_ID)
        const storedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID)

        if (storedClientId) {
            clientId.value = storedClientId
        }

        // 載入資料夾 ID
        if (storedFolderId) {
            syncFolderId.value = storedFolderId
        }
        if (storedBackupFolderId) {
            backupFolderId.value = storedBackupFolderId
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
                // Token 過期，只清除 token，保留 userInfo 和 syncFileId
                // 這樣重新授權後可以無縫繼續使用
                clearStoredAuth(false)

                // 仍然載入 userInfo 和 syncFileId（用於顯示和重新連接）
                if (storedUserInfo) {
                    userInfo.value = JSON.parse(storedUserInfo)
                }
                if (storedFileId) {
                    syncFileId.value = storedFileId
                }
            }
        } else {
            // 沒有 token 但可能有 userInfo 和 syncFileId（之前的連接資訊）
            if (storedUserInfo) {
                userInfo.value = JSON.parse(storedUserInfo)
            }
            if (storedFileId) {
                syncFileId.value = storedFileId
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

function clearStoredAuth(clearAll: boolean = true) {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY)

    accessToken.value = null

    // 只有在完全登出時才清除 userInfo 和 syncFileId
    // token 過期時保留這些資訊，方便重新授權後繼續使用
    if (clearAll) {
        localStorage.removeItem(STORAGE_KEYS.USER_INFO)
        localStorage.removeItem(STORAGE_KEYS.SYNC_FILE_ID)
        localStorage.removeItem(STORAGE_KEYS.SYNC_FOLDER_ID)
        localStorage.removeItem(STORAGE_KEYS.BACKUP_FOLDER_ID)
        localStorage.removeItem(STORAGE_KEYS.LAST_BACKUP_DATE)
        userInfo.value = null
        syncFileId.value = null
        syncFolderId.value = null
        backupFolderId.value = null
        backupFiles.value = []
    }
}

function saveClientId(id: string) {
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id)
    clientId.value = id
}

function saveSyncFileId(fileId: string) {
    localStorage.setItem(STORAGE_KEYS.SYNC_FILE_ID, fileId)
    syncFileId.value = fileId
}

function saveSyncFolderId(folderId: string) {
    localStorage.setItem(STORAGE_KEYS.SYNC_FOLDER_ID, folderId)
    syncFolderId.value = folderId
}

function saveBackupFolderId(folderId: string) {
    localStorage.setItem(STORAGE_KEYS.BACKUP_FOLDER_ID, folderId)
    backupFolderId.value = folderId
}

export function useGoogleDocs() {
    // Computed
    const isConnected = computed(() => !!accessToken.value && !!userInfo.value)

    // 是否需要重新授權（有 userInfo 但沒有有效的 token）
    const needsReauthorization = computed(() => !!userInfo.value && !accessToken.value)

    const syncStatus = computed<SyncStatus>(() => ({
        isConnected: isConnected.value,
        isSyncing: isSyncing.value,
        lastSyncTime: lastSyncTime.value,
        error: syncError.value
    }))

    // 初始化 - 載入已存的登入資訊
    async function initialize() {
        loadStoredAuth()

        // 如果需要重新授權，嘗試靜默刷新
        if (userInfo.value && !accessToken.value && clientId.value) {
            console.log('[Sync] Token expired, attempting silent refresh...')
            const refreshed = await trySilentRefresh()
            if (refreshed) {
                console.log('[Sync] Silent refresh successful, token restored')
            } else {
                console.log('[Sync] Silent refresh failed, user needs to reauthorize manually')
            }
        }

        // 如果已登入但沒有 syncFileId，嘗試搜尋現有的同步檔案
        if (accessToken.value && !syncFileId.value) {
            try {
                const existingFileId = await findExistingSyncFile()
                if (existingFileId) {
                    console.log('[Sync] Found existing sync file during init:', existingFileId)
                    saveSyncFileId(existingFileId)
                    // 取得檔案狀態
                    const status = await checkCloudFileStatus(existingFileId)
                    lastCloudModifiedTime.value = status.modifiedTime
                }
            } catch (e) {
                console.warn('[Sync] Failed to search for existing sync file during init', e)
            }
        }

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
            // 使用 select_account 讓用戶可以快速重新選擇帳號
            // 如果只有一個帳號且已授權過，可能可以快速通過
            authUrl.searchParams.set('prompt', 'select_account')
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

    // 嘗試靜默刷新 token（使用隱藏的 iframe）
    // 如果用戶之前已經授權過，這可能可以在不打擾用戶的情況下獲取新 token
    async function trySilentRefresh(): Promise<boolean> {
        if (!clientId.value) return false

        return new Promise((resolve) => {
            const redirectUri = window.location.origin + window.location.pathname
            const state = 'silent_refresh_' + Math.random().toString(36).substring(2)

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
            authUrl.searchParams.set('client_id', clientId.value)
            authUrl.searchParams.set('redirect_uri', redirectUri)
            authUrl.searchParams.set('response_type', 'token')
            authUrl.searchParams.set('scope', GOOGLE_SCOPES)
            authUrl.searchParams.set('state', state)
            authUrl.searchParams.set('prompt', 'none')  // 不顯示任何 UI
            authUrl.searchParams.set('include_granted_scopes', 'true')

            // 建立隱藏的 iframe
            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            iframe.id = 'silent-refresh-iframe'

            // 設定超時（5 秒）
            const timeout = setTimeout(() => {
                console.log('[Sync] Silent refresh timed out')
                cleanup()
                resolve(false)
            }, 5000)

            const cleanup = () => {
                clearTimeout(timeout)
                window.removeEventListener('message', handleMessage)
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe)
                }
            }

            const handleMessage = (event: MessageEvent) => {
                // 只處理來自我們 iframe 的訊息
                if (event.origin !== window.location.origin) return

                if (event.data?.type === 'silent_refresh_result') {
                    cleanup()
                    if (event.data.success && event.data.token) {
                        console.log('[Sync] Silent refresh successful')
                        resolve(true)
                    } else {
                        console.log('[Sync] Silent refresh failed:', event.data.error)
                        resolve(false)
                    }
                }
            }

            window.addEventListener('message', handleMessage)

            // iframe 載入後會重定向回我們的頁面
            // 我們需要在主頁面檢測這個情況
            iframe.onload = () => {
                // 嘗試讀取 iframe 的 URL（可能會因為同源政策而失敗）
                try {
                    const iframeUrl = iframe.contentWindow?.location.href
                    if (iframeUrl?.includes('access_token=')) {
                        // 解析 token
                        const hash = new URL(iframeUrl).hash
                        const params = new URLSearchParams(hash.substring(1))
                        const token = params.get('access_token')
                        const expiresIn = parseInt(params.get('expires_in') || '3600', 10)

                        if (token && params.get('state') === state) {
                            accessToken.value = token
                            const expiry = Date.now() + expiresIn * 1000
                            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token)
                            localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString())
                            cleanup()
                            console.log('[Sync] Silent refresh successful via iframe')
                            resolve(true)
                            return
                        }
                    } else if (iframeUrl?.includes('error=')) {
                        cleanup()
                        console.log('[Sync] Silent refresh denied')
                        resolve(false)
                        return
                    }
                } catch (e) {
                    // 跨域錯誤，這是預期的
                    // iframe 會嘗試 postMessage 回來
                }
            }

            document.body.appendChild(iframe)
            iframe.src = authUrl.toString()
        })
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

                // 取得使用者資訊，然後搜尋現有的同步檔案
                fetchUserInfo(token).then(async user => {
                    if (user) {
                        saveAuth(token, expiresIn, user)
                        console.log('[OAuth] Successfully logged in as:', user.email)

                        // 如果沒有 syncFileId，嘗試搜尋現有的同步檔案
                        if (!syncFileId.value) {
                            try {
                                const existingFileId = await findExistingSyncFile()
                                if (existingFileId) {
                                    console.log('[OAuth] Found existing sync file:', existingFileId)
                                    saveSyncFileId(existingFileId)
                                }
                            } catch (e) {
                                console.warn('[OAuth] Failed to search for existing sync file', e)
                            }
                        }
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
                // 先搜尋是否已有同步檔案（避免重複建立）
                const existingFileId = await findExistingSyncFile()

                if (existingFileId) {
                    // 找到現有檔案，使用它
                    console.log('[Sync] Reusing existing sync file:', existingFileId)
                    saveSyncFileId(existingFileId)

                    // 更新現有檔案
                    const updatedMetadata = await updateGoogleDoc(existingFileId, content)
                    lastCloudModifiedTime.value = updatedMetadata.modifiedTime
                } else {
                    // 沒有找到現有檔案，建立新檔案
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

    // 搜尋 Google Drive 是否已有同步檔案
    async function findExistingSyncFile(): Promise<string | null> {
        const hostname = window.location.hostname
        const fileName = `MD Viewer Data [${hostname}].json`

        try {
            // 使用 Google Drive API 搜尋檔案
            const query = encodeURIComponent(`name='${fileName}' and trashed=false`)
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken.value}`
                    }
                }
            )

            if (!response.ok) {
                console.warn('[Sync] Failed to search for existing file:', response.status)
                return null
            }

            const result = await response.json()
            if (result.files && result.files.length > 0) {
                // 如果找到多個檔案，使用最新修改的那個
                const sortedFiles = result.files.sort((a: any, b: any) =>
                    new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
                )
                console.log('[Sync] Found existing sync file:', sortedFiles[0].id)
                return sortedFiles[0].id
            }

            return null
        } catch (error) {
            console.warn('[Sync] Error searching for existing file:', error)
            return null
        }
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

    // ===== 資料夾操作函數 =====

    // 搜尋或建立資料夾
    async function findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
        // 搜尋現有資料夾
        let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
        if (parentId) {
            query += ` and '${parentId}' in parents`
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`
                }
            }
        )

        if (!response.ok) {
            throw new Error(`Failed to search for folder: ${response.status}`)
        }

        const result = await response.json()
        if (result.files && result.files.length > 0) {
            return result.files[0].id
        }

        // 資料夾不存在，建立新的
        const metadata: { name: string; mimeType: string; parents?: string[] } = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        }
        if (parentId) {
            metadata.parents = [parentId]
        }

        const createResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            }
        )

        if (!createResponse.ok) {
            throw new Error(`Failed to create folder: ${createResponse.status}`)
        }

        const createResult = await createResponse.json()
        return createResult.id
    }

    // 確保資料夾結構存在（主資料夾 + 備份資料夾）
    async function ensureFolderStructure(): Promise<{ syncFolderId: string; backupFolderId: string }> {
        // 取得或建立主資料夾
        let mainFolderId = syncFolderId.value
        if (!mainFolderId) {
            mainFolderId = await findOrCreateFolder(getSyncFolderName())
            saveSyncFolderId(mainFolderId)
            console.log('[Sync] Created/found main folder:', mainFolderId)
        }

        // 取得或建立備份資料夾
        let bkFolderId = backupFolderId.value
        if (!bkFolderId) {
            bkFolderId = await findOrCreateFolder(BACKUP_FOLDER_NAME, mainFolderId)
            saveBackupFolderId(bkFolderId)
            console.log('[Sync] Created/found backup folder:', bkFolderId)
        }

        return { syncFolderId: mainFolderId, backupFolderId: bkFolderId }
    }

    // 在資料夾中搜尋檔案
    async function findFileInFolder(fileName: string, folderId: string): Promise<{ id: string; modifiedTime: string } | null> {
        const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`
                }
            }
        )

        if (!response.ok) {
            console.warn('[Sync] Failed to search for file in folder:', response.status)
            return null
        }

        const result = await response.json()
        if (result.files && result.files.length > 0) {
            return result.files[0]
        }
        return null
    }

    // 在資料夾內建立檔案
    async function createFileInFolder(fileName: string, content: string, folderId: string): Promise<string> {
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [folderId]
        }

        const formData = new FormData()
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
        formData.append('file', new Blob([content], { type: 'application/json' }))

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
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

    // ===== 備份相關函數 =====

    // 取得今天的日期字串 (YYYY-MM-DD)
    function getTodayDateString(): string {
        const now = new Date()
        return now.toISOString().split('T')[0]
    }

    // 檢查今天是否已經備份過
    function hasBackupToday(): boolean {
        const lastBackupDate = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP_DATE)
        return lastBackupDate === getTodayDateString()
    }

    // 標記今天已備份
    function markBackupDone() {
        localStorage.setItem(STORAGE_KEYS.LAST_BACKUP_DATE, getTodayDateString())
    }

    // 建立備份（複製當前主檔案到備份資料夾）
    async function createBackup(sourceFileId: string, bkFolderId: string): Promise<string | null> {
        const todayString = getTodayDateString()
        const backupFileName = `backup-${todayString}.json`

        // 檢查今天的備份是否已存在
        const existingBackup = await findFileInFolder(backupFileName, bkFolderId)
        if (existingBackup) {
            console.log('[Backup] Backup for today already exists:', existingBackup.id)
            return existingBackup.id
        }

        // 複製檔案到備份資料夾
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${sourceFileId}/copy`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: backupFileName,
                    parents: [bkFolderId]
                })
            }
        )

        if (!response.ok) {
            console.error('[Backup] Failed to create backup:', response.status)
            return null
        }

        const result = await response.json()
        console.log('[Backup] Created backup:', result.id)
        markBackupDone()
        return result.id
    }

    // 列出所有備份檔案
    async function listBackupFiles(): Promise<BackupFile[]> {
        if (!backupFolderId.value) {
            return []
        }

        const query = `'${backupFolderId.value}' in parents and trashed=false and name contains 'backup-'`
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&orderBy=name desc`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken.value}`
                }
            }
        )

        if (!response.ok) {
            console.warn('[Backup] Failed to list backup files:', response.status)
            return []
        }

        const result = await response.json()
        if (!result.files) {
            return []
        }

        const files: BackupFile[] = result.files.map((file: { id: string; name: string; modifiedTime: string }) => {
            const dateMatch = file.name.match(/backup-(\d{4}-\d{2}-\d{2})\.json/)
            return {
                id: file.id,
                name: file.name,
                date: dateMatch ? dateMatch[1] : file.name,
                modifiedTime: file.modifiedTime
            }
        })

        backupFiles.value = files
        return files
    }

    // 清理過期的備份檔案
    async function cleanupOldBackups(retentionDays: number): Promise<number> {
        if (!backupFolderId.value) {
            return 0
        }

        const files = await listBackupFiles()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

        let deletedCount = 0

        for (const backup of files) {
            const backupDate = new Date(backup.date)
            if (backupDate < cutoffDate) {
                try {
                    await fetch(
                        `https://www.googleapis.com/drive/v3/files/${backup.id}`,
                        {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${accessToken.value}`
                            }
                        }
                    )
                    console.log('[Backup] Deleted old backup:', backup.name)
                    deletedCount++
                } catch (e) {
                    console.warn('[Backup] Failed to delete backup:', backup.name, e)
                }
            }
        }

        // 重新載入備份列表
        if (deletedCount > 0) {
            await listBackupFiles()
        }

        return deletedCount
    }

    // 從備份檔案還原
    async function restoreFromBackup(backupFileId: string): Promise<object | null> {
        try {
            const content = await getGoogleDocContent(backupFileId)
            if (content) {
                return JSON.parse(content)
            }
            return null
        } catch (error) {
            console.error('[Backup] Failed to restore from backup:', error)
            syncError.value = 'Failed to restore from backup: ' + (error as Error).message
            return null
        }
    }

    // 遷移舊格式資料到新資料夾結構
    async function migrateFromLegacyFormat(targetFolderId: string): Promise<{ migrated: boolean; data: object | null }> {
        console.log('[Migration] Checking for legacy format data...')

        // 檢查是否有舊格式的檔案
        const legacyFileId = await findExistingSyncFile()

        if (!legacyFileId) {
            console.log('[Migration] No legacy format file found')
            return { migrated: false, data: null }
        }

        console.log('[Migration] Found legacy format file:', legacyFileId)

        try {
            // 讀取舊檔案內容
            const content = await getGoogleDocContent(legacyFileId)
            if (!content) {
                console.warn('[Migration] Could not read legacy file content')
                return { migrated: false, data: null }
            }

            const data = JSON.parse(content)
            console.log('[Migration] Successfully read legacy data')

            // 將舊資料複製到新資料夾
            const newFileId = await createFileInFolder(DATA_FILE_NAME, content, targetFolderId)
            saveSyncFileId(newFileId)

            console.log('[Migration] Successfully migrated data to new folder structure')
            console.log('[Migration] New file ID:', newFileId)

            // 可選：將舊檔案移到垃圾桶（或保留作為額外備份）
            // 這裡我們選擇保留舊檔案，使用者可以手動刪除
            console.log('[Migration] Legacy file preserved for safety. You can manually delete it from Google Drive.')

            return { migrated: true, data }
        } catch (error) {
            console.error('[Migration] Error during migration:', error)
            return { migrated: false, data: null }
        }
    }

    // 檢查是否需要遷移
    async function checkAndMigrate(targetFolderId: string): Promise<boolean> {
        // 已經在新資料夾中有資料嗎？
        const existingNewFile = await findFileInFolder(DATA_FILE_NAME, targetFolderId)
        if (existingNewFile) {
            console.log('[Migration] New format file already exists, no migration needed')
            return false
        }

        // 嘗試遷移
        const result = await migrateFromLegacyFormat(targetFolderId)
        return result.migrated
    }

    // 使用資料夾結構同步到 Google Drive（含備份邏輯）
    async function syncToGoogleDocsWithBackup(data: object, backupEnabled: boolean, retentionDays: number, force: boolean = false): Promise<'success' | 'conflict' | 'error'> {
        if (!accessToken.value) {
            syncError.value = 'Not signed in to Google'
            return 'error'
        }

        isSyncing.value = true
        syncError.value = null

        try {
            // 確保資料夾結構存在
            const folders = await ensureFolderStructure()

            // 檢查並遷移舊格式資料（如果存在）
            // 這確保從舊版升級時不會遺失資料
            const migrated = await checkAndMigrate(folders.syncFolderId)
            if (migrated) {
                console.log('[Sync] Successfully migrated from legacy format')
            }

            // 在主資料夾中搜尋現有的資料檔案
            let existingFile = await findFileInFolder(DATA_FILE_NAME, folders.syncFolderId)

            // 如果啟用備份且檔案存在，且今天還沒備份
            if (backupEnabled && existingFile && !hasBackupToday()) {
                console.log('[Sync] Creating daily backup before sync...')
                await createBackup(existingFile.id, folders.backupFolderId)

                // 清理過期備份
                await cleanupOldBackups(retentionDays)
            }

            const content = JSON.stringify(data, null, 2)

            if (existingFile) {
                // 檢查衝突
                if (!force) {
                    try {
                        const status = await checkCloudFileStatus(existingFile.id)
                        if (lastCloudModifiedTime.value && status.modifiedTime > lastCloudModifiedTime.value) {
                            console.warn('Conflict detected: remote file is newer')
                            return 'conflict'
                        }
                    } catch (e) {
                        console.warn('Failed to check cloud status, proceeding with caution', e)
                    }
                }

                // 更新現有檔案
                const updatedMetadata = await updateGoogleDoc(existingFile.id, content)
                lastCloudModifiedTime.value = updatedMetadata.modifiedTime
                saveSyncFileId(existingFile.id)
            } else {
                // 建立新檔案
                const fileId = await createFileInFolder(DATA_FILE_NAME, content, folders.syncFolderId)
                saveSyncFileId(fileId)

                try {
                    const status = await checkCloudFileStatus(fileId)
                    lastCloudModifiedTime.value = status.modifiedTime
                } catch (e) {
                    console.warn('Failed to get initial file time', e)
                }
            }

            lastSyncTime.value = Date.now()
            return 'success'
        } catch (error) {
            console.error('Sync failed:', error)
            syncError.value = 'Sync failed: ' + (error as Error).message

            if ((error as Error).message.includes('401')) {
                clearStoredAuth()
            }

            return 'error'
        } finally {
            isSyncing.value = false
        }
    }

    // 刷新備份檔案列表
    async function refreshBackupList(): Promise<BackupFile[]> {
        return await listBackupFiles()
    }

    // 手動建立備份（會先檢查衝突）
    async function createManualBackup(): Promise<'success' | 'conflict' | 'no-data' | 'error'> {
        if (!accessToken.value) {
            syncError.value = 'Not signed in to Google'
            return 'error'
        }

        isSyncing.value = true
        syncError.value = null

        try {
            // 確保資料夾結構存在
            const folders = await ensureFolderStructure()

            // 檢查是否有雲端衝突
            const existingFile = await findFileInFolder(DATA_FILE_NAME, folders.syncFolderId)

            if (!existingFile) {
                // 雲端沒有資料檔案，無法備份
                syncError.value = 'No cloud data to backup. Please sync first.'
                return 'no-data'
            }

            // 檢查雲端是否有更新（衝突檢測）
            const cloudStatus = await checkCloudFileStatus(existingFile.id)
            if (lastCloudModifiedTime.value && cloudStatus.modifiedTime > lastCloudModifiedTime.value) {
                // 雲端較新，有衝突
                hasConflict.value = true
                conflictCloudTime.value = cloudStatus.modifiedTime
                autoSyncPaused.value = true
                return 'conflict'
            }

            // 建立備份（使用帶時間戳的名稱，允許同一天多次備份）
            const now = new Date()
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const backupFileName = `backup-${timestamp}.json`

            // 複製檔案到備份資料夾
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${existingFile.id}/copy`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken.value}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: backupFileName,
                        parents: [folders.backupFolderId]
                    })
                }
            )

            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Failed to create backup: ${response.status} ${error}`)
            }

            const result = await response.json()
            console.log('[Backup] Created manual backup:', result.id, backupFileName)

            // 刷新備份列表
            await listBackupFiles()

            return 'success'
        } catch (error) {
            console.error('[Backup] Manual backup failed:', error)
            syncError.value = 'Backup failed: ' + (error as Error).message
            return 'error'
        } finally {
            isSyncing.value = false
        }
    }

    // ===== 衝突處理函數 =====

    // 檢查雲端是否有更新（用於啟動時或自動同步前）
    async function checkForCloudUpdates(): Promise<'up-to-date' | 'cloud-newer' | 'no-cloud-file' | 'error'> {
        if (!accessToken.value) return 'error'

        try {
            // 確保資料夾結構存在
            const folders = await ensureFolderStructure()

            // 搜尋現有的資料檔案
            const existingFile = await findFileInFolder(DATA_FILE_NAME, folders.syncFolderId)

            if (!existingFile) {
                return 'no-cloud-file'
            }

            // 檢查雲端檔案的修改時間
            const cloudStatus = await checkCloudFileStatus(existingFile.id)

            // 如果我們沒有記錄上次同步時間，視為需要檢查
            if (!lastCloudModifiedTime.value) {
                // 首次同步，記錄時間但不算衝突
                lastCloudModifiedTime.value = cloudStatus.modifiedTime
                return 'up-to-date'
            }

            // 比較時間
            if (cloudStatus.modifiedTime > lastCloudModifiedTime.value) {
                // 雲端較新
                hasConflict.value = true
                conflictCloudTime.value = cloudStatus.modifiedTime
                autoSyncPaused.value = true
                return 'cloud-newer'
            }

            return 'up-to-date'
        } catch (error) {
            console.error('[Sync] Error checking for cloud updates:', error)
            return 'error'
        }
    }

    // 解決衝突：選擇載入雲端資料
    async function resolveConflictWithCloud(): Promise<object | null> {
        const data = await loadFromGoogleDocs()
        if (data) {
            clearConflict()
        }
        return data
    }

    // 解決衝突：選擇覆蓋雲端（強制同步）
    async function resolveConflictWithLocal(data: object, backupEnabled: boolean, retentionDays: number): Promise<'success' | 'error'> {
        const result = await syncToGoogleDocsWithBackup(data, backupEnabled, retentionDays, true)
        if (result === 'success') {
            clearConflict()
            return 'success'
        }
        return 'error'
    }

    // 清除衝突狀態
    function clearConflict() {
        hasConflict.value = false
        conflictCloudTime.value = null
        autoSyncPaused.value = false
    }

    // 自動同步專用（有衝突時靜默跳過）
    async function autoSync(data: object, backupEnabled: boolean, retentionDays: number): Promise<'success' | 'conflict' | 'paused' | 'error'> {
        // 如果已經暫停，不執行
        if (autoSyncPaused.value) {
            return 'paused'
        }

        // 先檢查是否有衝突
        const cloudStatus = await checkForCloudUpdates()
        if (cloudStatus === 'cloud-newer') {
            // 有衝突，暫停自動同步但不跳出對話框
            console.log('[AutoSync] Conflict detected, pausing auto-sync')
            return 'conflict'
        }

        // 沒有衝突，正常同步
        return await syncToGoogleDocsWithBackup(data, backupEnabled, retentionDays, false)
    }

    return {
        // State
        isConnected,
        needsReauthorization,
        userInfo,
        syncStatus,
        clientId: computed(() => clientId.value),
        hasSyncFile: computed(() => !!syncFileId.value),
        backupFiles: computed(() => backupFiles.value),
        // Conflict state
        hasConflict: computed(() => hasConflict.value),
        autoSyncPaused: computed(() => autoSyncPaused.value),
        conflictCloudTime: computed(() => conflictCloudTime.value),

        // Actions
        initialize,
        setClientId,
        getClientId,
        signIn,
        signOut,
        handleOAuthCallback,
        syncToGoogleDocs,
        syncToGoogleDocsWithBackup,
        loadFromGoogleDocs,
        clearSyncFile,
        // Backup actions
        listBackupFiles,
        restoreFromBackup,
        cleanupOldBackups,
        refreshBackupList,
        createManualBackup,
        // Conflict actions
        checkForCloudUpdates,
        resolveConflictWithCloud,
        resolveConflictWithLocal,
        clearConflict,
        autoSync
    }
}
