// drive.js - Google Drive API操作

import { showLoading, hideLoading, showNotification, getOrCreateFolder } from './auth.js';

// アプリフォルダID取得
export async function getAppFolderId() {
    try {
        const response = await gapi.client.drive.files.list({
            q: "name = '1to1meeting' and mimeType = 'application/vnd.google-apps.folder' and 'appDataFolder' in parents and trashed = false",
            spaces: 'appDataFolder',
            fields: 'files(id)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        throw new Error('App folder not found');
    } catch (error) {
        console.error('Error getting app folder:', error);
        throw error;
    }
}

// JSONファイル読み込み
export async function loadJsonFile(fileName) {
    try {
        const appFolderId = await getAppFolderId();
        
        // ファイルを検索
        const listResponse = await gapi.client.drive.files.list({
            q: `name = '${fileName}' and '${appFolderId}' in parents and trashed = false`,
            spaces: 'appDataFolder',
            fields: 'files(id)'
        });
        
        if (!listResponse.result.files || listResponse.result.files.length === 0) {
            return null;
        }
        
        const fileId = listResponse.result.files[0].id;
        
        // ファイル内容を取得
        const fileResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        return JSON.parse(fileResponse.body);
    } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        return null;
    }
}

// JSONファイル保存
export async function saveJsonFile(fileName, data) {
    try {
        showLoading();
        const appFolderId = await getAppFolderId();
        
        // 既存ファイルを検索
        const listResponse = await gapi.client.drive.files.list({
            q: `name = '${fileName}' and '${appFolderId}' in parents and trashed = false`,
            spaces: 'appDataFolder',
            fields: 'files(id)'
        });
        
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        if (listResponse.result.files && listResponse.result.files.length > 0) {
            // 既存ファイルを更新
            const fileId = listResponse.result.files[0].id;
            await gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: {
                    uploadType: 'media'
                },
                body: blob
            });
        } else {
            // 新規ファイル作成
            const metadata = {
                name: fileName,
                parents: [appFolderId]
            };
            
            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: {
                    uploadType: 'multipart'
                },
                headers: {
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz'
                },
                body: createMultipartBody(metadata, blob, 'application/json')
            });
        }
        
        hideLoading();
        showNotification(`${fileName}を保存しました`, 'success');
    } catch (error) {
        hideLoading();
        showNotification(`${fileName}の保存に失敗しました`, 'error');
        console.error('Error saving file:', error);
        throw error;
    }
}

// ファイルアップロード
export async function uploadFile(file, folderPath) {
    try {
        showLoading();
        const appFolderId = await getAppFolderId();
        const attachmentsFolderId = await getOrCreateFolderPath('attachments', appFolderId);
        
        // 連絡先フォルダの作成
        const contactFolder = await getOrCreateFolder(folderPath, attachmentsFolderId.id);
        
        // タイムスタンプ付きファイル名
        const timestamp = new Date().getTime();
        const fileName = `${timestamp}_${file.name}`;
        
        // ファイルメタデータ
        const metadata = {
            name: fileName,
            parents: [contactFolder.id]
        };
        
        // マルチパートアップロード
        const response = await gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: {
                uploadType: 'multipart',
                fields: 'id,name,webViewLink,webContentLink'
            },
            headers: {
                'Content-Type': 'multipart/related; boundary=foo_bar_baz'
            },
            body: createMultipartBody(metadata, file, file.type)
        });
        
        hideLoading();
        return {
            id: response.result.id,
            name: response.result.name,
            webViewLink: response.result.webViewLink,
            webContentLink: response.result.webContentLink,
            originalName: file.name,
            size: file.size,
            type: file.type
        };
    } catch (error) {
        hideLoading();
        showNotification('ファイルのアップロードに失敗しました', 'error');
        console.error('Error uploading file:', error);
        throw error;
    }
}

// ファイル削除
export async function deleteFile(fileId) {
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId
        });
        showNotification('ファイルを削除しました', 'success');
    } catch (error) {
        showNotification('ファイルの削除に失敗しました', 'error');
        console.error('Error deleting file:', error);
        throw error;
    }
}

// フォルダパス取得または作成
async function getOrCreateFolderPath(folderName, parentId) {
    return await getOrCreateFolder(folderName, parentId);
}

// マルチパートボディ作成
function createMultipartBody(metadata, file, mimeType) {
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const metadataString = JSON.stringify(metadata);
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = e.target.result;
            const multipartBody = 
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                metadataString +
                delimiter +
                `Content-Type: ${mimeType}\r\n` +
                'Content-Transfer-Encoding: base64\r\n\r\n' +
                btoa(String.fromCharCode(...new Uint8Array(data))) +
                closeDelimiter;
            
            resolve(multipartBody);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ファイルダウンロード
export async function downloadFile(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return response.body;
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

// インポート処理
export async function importData(file) {
    try {
        showLoading();
        
        const text = await readFileAsText(file);
        const data = JSON.parse(text);
        
        // データ検証
        if (!data.contacts || !Array.isArray(data.contacts)) {
            throw new Error('無効なデータ形式です');
        }
        
        // 現在のデータと結合
        const currentContacts = await loadJsonFile('contacts.json') || [];
        const currentMeetings = await loadJsonFile('meetings.json') || [];
        
        // IDの重複を避けて結合
        const importedContacts = data.contacts.map(contact => ({
            ...contact,
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
        
        const importedMeetings = data.meetings ? data.meetings.map(meeting => ({
            ...meeting,
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })) : [];
        
        // 保存
        await saveJsonFile('contacts.json', [...currentContacts, ...importedContacts]);
        if (importedMeetings.length > 0) {
            await saveJsonFile('meetings.json', [...currentMeetings, ...importedMeetings]);
        }
        
        hideLoading();
        showNotification(`${importedContacts.length}件の連絡先をインポートしました`, 'success');
        
        // リロード
        const { loadContacts } = await import('./contacts.js');
        await loadContacts();
        
    } catch (error) {
        hideLoading();
        showNotification('インポートに失敗しました: ' + error.message, 'error');
        console.error('Import error:', error);
    }
}

// エクスポート処理
export async function exportData() {
    try {
        showLoading();
        
        const contacts = await loadJsonFile('contacts.json') || [];
        const meetings = await loadJsonFile('meetings.json') || [];
        const options = await loadJsonFile('options.json') || {};
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            contacts: contacts,
            meetings: meetings,
            options: options
        };
        
        // ダウンロード
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customer_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideLoading();
        showNotification('データをエクスポートしました', 'success');
        
    } catch (error) {
        hideLoading();
        showNotification('エクスポートに失敗しました', 'error');
        console.error('Export error:', error);
    }
}

// ファイルを文字列として読み込み
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}