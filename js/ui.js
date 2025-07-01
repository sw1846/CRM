// ui.js - UI制御とイベントハンドリング

import { createNewContact, saveContact, renderContacts, toggleViewMode, toggleManagementMode } from './contacts.js';
import { createMeetingModal } from './meetings.js';
import { importData, exportData } from './drive.js';

// モーダル管理
let mouseDownOnModal = false;

// UI初期化
export function initUI() {
    // イベントリスナー設定
    setupEventListeners();
    
    // ミーティングモーダル作成
    createMeetingModal();
    
    // ファイルアップロード設定
    setupFileUploads();
    
    // モーダル外クリック設定
    setupModalHandlers();
    
    // 初回ミーティングセクション制御
    setupInitialMeetingToggle();
}

// イベントリスナー設定
function setupEventListeners() {
    // 検索
    document.getElementById('searchInput').addEventListener('input', debounce(() => {
        renderContacts();
    }, 300));
    
    // フィルタ
    document.getElementById('typeFilter').addEventListener('change', () => renderContacts());
    document.getElementById('affiliationFilter').addEventListener('change', () => renderContacts());
    
    // ボタン
    document.getElementById('addContactBtn').addEventListener('click', createNewContact);
    document.getElementById('viewToggle').addEventListener('click', toggleViewMode);
    document.getElementById('modeToggle').addEventListener('click', toggleManagementMode);
    document.getElementById('importBtn').addEventListener('click', handleImport);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // フォーム
    document.getElementById('contactForm').addEventListener('submit', handleContactSubmit);
    
    // セレクトボックス（複数選択）
    setupMultiSelect('types');
    setupMultiSelect('affiliations');
}

// 複数選択セレクトボックス設定
function setupMultiSelect(fieldName) {
    const select = document.getElementById(fieldName);
    select.addEventListener('change', (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions);
        selectedOptions.forEach(option => {
            addChip(fieldName, option.value);
            option.selected = false;
        });
    });
}

// チップ追加
function addChip(fieldName, value) {
    const container = document.getElementById(`${fieldName}Chips`);
    
    // 重複チェック
    const existingChips = Array.from(container.querySelectorAll('.chip')).map(chip => 
        chip.textContent.replace('×', '').trim()
    );
    if (existingChips.includes(value)) return;
    
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
        ${escapeHtml(value)}
        <span class="chip-remove">×</span>
    `;
    
    chip.querySelector('.chip-remove').addEventListener('click', () => chip.remove());
    container.appendChild(chip);
}

// モーダルハンドラー設定
function setupModalHandlers() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        const modalContent = modal.querySelector('.modal-content');
        
        // マウスダウンをモーダルコンテンツで検出
        modalContent.addEventListener('mousedown', (e) => {
            mouseDownOnModal = true;
        });
        
        // マウスアップをモーダルコンテンツで検出
        modalContent.addEventListener('mouseup', (e) => {
            mouseDownOnModal = false;
        });
        
        // モーダル背景クリックで閉じる
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) {
                mouseDownOnModal = false;
            }
        });
        
        modal.addEventListener('mouseup', (e) => {
            if (e.target === modal && !mouseDownOnModal) {
                modal.style.display = 'none';
            }
        });
        
        // 閉じるボタン
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    });
}

// ファイルアップロード設定
function setupFileUploads() {
    setupFileUploadArea('photoUpload', 'image/*', false);
    setupFileUploadArea('businessCardUpload', 'image/*', false);
    setupFileUploadArea('otherFilesUpload', '*', true);
    setupFileUploadArea('meetingAttachments', '*', true);
}

// ファイルアップロードエリア設定
function setupFileUploadArea(elementId, accept, multiple) {
    const uploadArea = document.getElementById(elementId);
    if (!uploadArea) return;
    
    // ファイル入力要素作成
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = accept;
    fileInput.multiple = multiple;
    fileInput.style.display = 'none';
    uploadArea.appendChild(fileInput);
    
    // クリックイベント
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // ドラッグ&ドロップ
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(elementId, Array.from(e.dataTransfer.files));
    });
    
    // ファイル選択イベント
    fileInput.addEventListener('change', (e) => {
        handleFiles(elementId, Array.from(e.target.files));
    });
}

// ファイル処理
async function handleFiles(uploadAreaId, files) {
    // ファイルタイプと領域に応じた処理
    switch(uploadAreaId) {
        case 'photoUpload':
            if (files[0] && files[0].type.startsWith('image/')) {
                await handlePhotoUpload(files[0]);
            }
            break;
        case 'businessCardUpload':
            if (files[0] && files[0].type.startsWith('image/')) {
                await handleBusinessCardUpload(files[0]);
            }
            break;
        case 'otherFilesUpload':
            await handleOtherFilesUpload(files);
            break;
        case 'meetingAttachments':
            await handleMeetingAttachments(files);
            break;
    }
}

// 顔写真アップロード処理
async function handlePhotoUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const uploadArea = document.getElementById('photoUpload');
        uploadArea.innerHTML = `
            <img src="${e.target.result}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
            <button type="button" class="btn btn-secondary" onclick="removePhoto()">削除</button>
        `;
        
        // データとして保存（実際のアップロードは保存時）
        uploadArea.dataset.file = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 名刺アップロード処理
async function handleBusinessCardUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const uploadArea = document.getElementById('businessCardUpload');
        uploadArea.innerHTML = `
            <img src="${e.target.result}" style="max-width: 200px; max-height: 150px;">
            <button type="button" class="btn btn-secondary" onclick="removeBusinessCard()">削除</button>
        `;
        
        uploadArea.dataset.file = e.target.result;
    };
    reader.readAsDataURL(file);
}

// その他ファイルアップロード処理
async function handleOtherFilesUpload(files) {
    const uploadArea = document.getElementById('otherFilesUpload');
    const fileList = document.createElement('div');
    fileList.style.marginTop = '10px';
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.style.marginBottom = '5px';
        fileItem.innerHTML = `
            <span>${escapeHtml(file.name)} (${formatFileSize(file.size)})</span>
            <button type="button" class="btn btn-icon" onclick="this.parentElement.remove()">×</button>
        `;
        fileList.appendChild(fileItem);
    });
    
    uploadArea.appendChild(fileList);
}

// ミーティング添付ファイル処理
async function handleMeetingAttachments(files) {
    const attachmentsList = document.getElementById('attachmentsList');
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.style.marginTop = '5px';
        fileItem.innerHTML = `
            <span>${escapeHtml(file.name)} (${formatFileSize(file.size)})</span>
            <button type="button" class="btn btn-icon" onclick="this.parentElement.remove()">×</button>
        `;
        attachmentsList.appendChild(fileItem);
    });
}

// 初回ミーティングセクション制御
function setupInitialMeetingToggle() {
    const checkbox = document.getElementById('addInitialMeeting');
    const section = document.getElementById('initialMeetingSection');
    
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            section.classList.remove('hidden');
            // 現在日時を設定
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('meetingDate').value = now.toISOString().slice(0, 16);
        } else {
            section.classList.add('hidden');
        }
    });
}

// 連絡先フォーム送信処理
async function handleContactSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    await saveContact(formData);
}

// インポート処理
function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await importData(file);
        }
    });
    
    input.click();
}

// ユーティリティ関数
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// グローバル関数（HTML内から呼び出し用）
window.removePhoto = function() {
    const uploadArea = document.getElementById('photoUpload');
    uploadArea.innerHTML = '<p>クリックまたはドラッグ&ドロップ</p>';
    delete uploadArea.dataset.file;
};

window.removeBusinessCard = function() {
    const uploadArea = document.getElementById('businessCardUpload');
    uploadArea.innerHTML = '<p>クリックまたはドラッグ&ドロップ</p>';
    delete uploadArea.dataset.file;
};