// auth.js - Google認証とDrive API管理

// Google API設定
const CLIENT_ID = '938239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com'; // 実際のClient IDに置き換えてください
const API_KEY = 'YOUR_API_KEY'; // 実際のAPI Keyに置き換えてください
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// 認証状態
export let authState = {
    isAuthenticated: false,
    accessToken: null,
    user: null
};

// 認証状態変更時のコールバック
const authCallbacks = [];

export function onAuthStateChange(callback) {
    authCallbacks.push(callback);
}

// 認証状態の更新
function updateAuthState(newState) {
    authState = { ...authState, ...newState };
    authCallbacks.forEach(cb => cb(authState));
    
    // UIの更新
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (authState.isAuthenticated) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
    }
}

// GAPI初期化
async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

// GIS初期化
function initializeGisClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
            if (resp.error !== undefined) {
                throw resp;
            }
            sessionStorage.setItem('access_token', resp.access_token);
            updateAuthState({
                isAuthenticated: true,
                accessToken: resp.access_token
            });
            
            // 初回ログイン時のセットアップ
            await setupInitialData();
        },
    });
    gisInited = true;
    maybeEnableButtons();
}

// ボタンの有効化
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('loginBtn').disabled = false;
    }
}

// 初期化
export async function initAuth() {
    return new Promise((resolve) => {
        // GAPI読み込み
        gapi.load('client', initializeGapiClient);
        
        // GIS読み込み
        if (typeof google !== 'undefined') {
            initializeGisClient();
        }
        
        // ボタンイベント設定
        document.getElementById('loginBtn').addEventListener('click', handleAuthClick);
        document.getElementById('logoutBtn').addEventListener('click', handleSignoutClick);
        
        // 既存のトークンチェック
        const savedToken = sessionStorage.getItem('access_token');
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            updateAuthState({
                isAuthenticated: true,
                accessToken: savedToken
            });
            resolve(true);
        } else {
            resolve(false);
        }
    });
}

// 認証処理
function handleAuthClick() {
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// ログアウト処理
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        sessionStorage.removeItem('access_token');
        updateAuthState({
            isAuthenticated: false,
            accessToken: null,
            user: null
        });
        
        // データをクリア
        document.getElementById('contactsContainer').innerHTML = '';
    }
}

// 初回セットアップ
async function setupInitialData() {
    try {
        showLoading();
        
        // アプリフォルダの作成・確認
        const appFolder = await getOrCreateAppFolder();
        
        // attachmentsフォルダの作成・確認
        await getOrCreateFolder('attachments', appFolder.id);
        
        // 初期JSONファイルの作成・確認
        await getOrCreateFile('contacts.json', appFolder.id, '[]');
        await getOrCreateFile('meetings.json', appFolder.id, '[]');
        await getOrCreateFile('options.json', appFolder.id, JSON.stringify({
            types: ['見込み客', '既存顧客', 'パートナー', 'サプライヤー'],
            affiliations: ['東京', '大阪', '名古屋', '福岡', 'その他'],
            contractStatuses: ['商談中', '契約', '失注']
        }));
        
        hideLoading();
        showNotification('初期設定が完了しました', 'success');
        
        // データ読み込みをトリガー
        const { loadContacts } = await import('./contacts.js');
        await loadContacts();
        
    } catch (error) {
        hideLoading();
        showNotification('初期設定に失敗しました: ' + error.message, 'error');
        console.error('Setup error:', error);
    }
}

// アプリフォルダ取得または作成
async function getOrCreateAppFolder() {
    try {
        // 既存のアプリフォルダを検索
        const response = await gapi.client.drive.files.list({
            q: "name = '1to1meeting' and mimeType = 'application/vnd.google-apps.folder' and 'appDataFolder' in parents and trashed = false",
            spaces: 'appDataFolder',
            fields: 'files(id, name)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0];
        }
        
        // フォルダが存在しない場合は作成
        const folderMetadata = {
            name: '1to1meeting',
            mimeType: 'application/vnd.google-apps.folder',
            parents: ['appDataFolder']
        };
        
        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id, name'
        });
        
        return folder.result;
    } catch (error) {
        console.error('Error creating app folder:', error);
        throw error;
    }
}

// フォルダ取得または作成
export async function getOrCreateFolder(folderName, parentId) {
    try {
        // 既存のフォルダを検索
        const response = await gapi.client.drive.files.list({
            q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0];
        }
        
        // フォルダが存在しない場合は作成
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };
        
        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id, name'
        });
        
        return folder.result;
    } catch (error) {
        console.error('Error creating folder:', error);
        throw error;
    }
}

// ファイル取得または作成
export async function getOrCreateFile(fileName, parentId, defaultContent = '') {
    try {
        // 既存のファイルを検索
        const response = await gapi.client.drive.files.list({
            q: `name = '${fileName}' and '${parentId}' in parents and trashed = false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0];
        }
        
        // ファイルが存在しない場合は作成
        const fileMetadata = {
            name: fileName,
            parents: [parentId]
        };
        
        const media = {
            mimeType: 'application/json',
            body: defaultContent
        };
        
        const file = await gapi.client.drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name'
        });
        
        return file.result;
    } catch (error) {
        console.error('Error creating file:', error);
        throw error;
    }
}

// ローディング表示
export function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// ローディング非表示
export function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// 通知表示
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
