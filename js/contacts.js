// contacts.js - 連絡先管理

import { loadJsonFile, saveJsonFile, uploadFile, deleteFile } from './drive.js';
import { showNotification } from './auth.js';
import { renderMarkdown, escapeHtml, formatDate } from './utils.js';

// 状態管理
let contacts = [];
let options = {
    types: [],
    affiliations: [],
    contractStatuses: []
};
let currentEditingId = null;
let viewMode = 'grid'; // 'grid' or 'list'
let currentMode = 'sales'; // 'sales' or 'customer'

// 連絡先読み込み
export async function loadContacts() {
    try {
        // 連絡先データ読み込み
        const contactsData = await loadJsonFile('contacts.json');
        contacts = contactsData || [];
        
        // オプションデータ読み込み
        const optionsData = await loadJsonFile('options.json');
        options = optionsData || {
            types: ['見込み客', '既存顧客', 'パートナー', 'サプライヤー'],
            affiliations: ['東京', '大阪', '名古屋', '福岡', 'その他'],
            contractStatuses: ['商談中', '契約', '失注']
        };
        
        // フィルタオプション更新
        updateFilterOptions();
        
        // 連絡先表示
        renderContacts();
        
    } catch (error) {
        console.error('Error loading contacts:', error);
        showNotification('データの読み込みに失敗しました', 'error');
    }
}

// フィルタオプション更新
function updateFilterOptions() {
    // 種別フィルタ
    const typeFilter = document.getElementById('typeFilter');
    typeFilter.innerHTML = '<option value="">種別で絞り込み</option>';
    options.types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
    
    // 所属フィルタ
    const affiliationFilter = document.getElementById('affiliationFilter');
    affiliationFilter.innerHTML = '<option value="">所属で絞り込み</option>';
    options.affiliations.forEach(affiliation => {
        const option = document.createElement('option');
        option.value = affiliation;
        option.textContent = affiliation;
        affiliationFilter.appendChild(option);
    });
    
    // フォームのセレクトボックスも更新
    updateFormSelects();
}

// フォームのセレクトボックス更新
function updateFormSelects() {
    // 種別
    const typesSelect = document.getElementById('types');
    typesSelect.innerHTML = '';
    options.types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typesSelect.appendChild(option);
    });
    
    // 所属
    const affiliationsSelect = document.getElementById('affiliations');
    affiliationsSelect.innerHTML = '';
    options.affiliations.forEach(affiliation => {
        const option = document.createElement('option');
        option.value = affiliation;
        option.textContent = affiliation;
        affiliationsSelect.appendChild(option);
    });
}

// 連絡先表示
export function renderContacts(filteredContacts = null) {
    const container = document.getElementById('contactsContainer');
    const displayContacts = filteredContacts || getFilteredContacts();
    
    container.innerHTML = '';
    container.className = viewMode === 'grid' ? 'contacts-grid' : 'contacts-list';
    
    if (displayContacts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">連絡先がありません</p>';
        return;
    }
    
    displayContacts.forEach(contact => {
        if (viewMode === 'grid') {
            container.appendChild(createContactCard(contact));
        } else {
            container.appendChild(createContactListItem(contact));
        }
    });
}

// フィルタリング
function getFilteredContacts() {
    let filtered = [...contacts];
    
    // モードによるフィルタ
    if (currentMode === 'customer') {
        filtered = filtered.filter(c => c.contractStatus === 'contracted');
    }
    
    // 検索フィルタ
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    if (searchQuery) {
        filtered = filtered.filter(contact => 
            contact.name.toLowerCase().includes(searchQuery) ||
            (contact.company && contact.company.toLowerCase().includes(searchQuery)) ||
            (contact.email && contact.email.toLowerCase().includes(searchQuery))
        );
    }
    
    // 種別フィルタ
    const typeFilter = document.getElementById('typeFilter').value;
    if (typeFilter) {
        filtered = filtered.filter(contact => 
            contact.types && contact.types.includes(typeFilter)
        );
    }
    
    // 所属フィルタ
    const affiliationFilter = document.getElementById('affiliationFilter').value;
    if (affiliationFilter) {
        filtered = filtered.filter(contact => 
            contact.affiliations && contact.affiliations.includes(affiliationFilter)
        );
    }
    
    return filtered;
}

// 連絡先カード作成
function createContactCard(contact) {
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.onclick = () => editContact(contact.id);
    
    const photoUrl = contact.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=4a9eff&color=fff`;
    
    card.innerHTML = `
        <div class="contact-header">
            <img src="${photoUrl}" alt="${escapeHtml(contact.name)}" class="contact-photo">
            <div class="contact-info">
                <h3>${escapeHtml(contact.name)}</h3>
                ${contact.company ? `<div class="contact-company">${escapeHtml(contact.company)}</div>` : ''}
            </div>
        </div>
        ${contact.email ? `<div style="font-size: 0.9rem; margin-bottom: 0.5rem;">📧 ${escapeHtml(contact.email)}</div>` : ''}
        ${contact.phone ? `<div style="font-size: 0.9rem; margin-bottom: 0.5rem;">📱 ${escapeHtml(contact.phone)}</div>` : ''}
        ${contact.types && contact.types.length > 0 ? `
            <div class="tags">
                ${contact.types.map(type => `<span class="tag">${escapeHtml(type)}</span>`).join('')}
            </div>
        ` : ''}
        ${contact.contractStatus ? `
            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: ${getStatusColor(contact.contractStatus)};">
                ● ${getStatusLabel(contact.contractStatus)}
            </div>
        ` : ''}
    `;
    
    return card;
}

// 連絡先リストアイテム作成
function createContactListItem(contact) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.onclick = () => editContact(contact.id);
    
    const photoUrl = contact.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=4a9eff&color=fff`;
    
    item.innerHTML = `
        <img src="${photoUrl}" alt="${escapeHtml(contact.name)}" class="contact-photo" style="width: 40px; height: 40px;">
        <div style="flex: 1;">
            <div style="font-weight: 500;">${escapeHtml(contact.name)}</div>
            ${contact.company ? `<div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(contact.company)}</div>` : ''}
        </div>
        <div style="text-align: right;">
            ${contact.email ? `<div style="font-size: 0.85rem;">${escapeHtml(contact.email)}</div>` : ''}
            ${contact.phone ? `<div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(contact.phone)}</div>` : ''}
        </div>
    `;
    
    return item;
}

// ステータスカラー取得
function getStatusColor(status) {
    switch(status) {
        case 'contracted': return 'var(--success)';
        case 'prospecting': return 'var(--warning)';
        case 'lost': return 'var(--error)';
        default: return 'var(--text-secondary)';
    }
}

// ステータスラベル取得
function getStatusLabel(status) {
    switch(status) {
        case 'contracted': return '契約';
        case 'prospecting': return '商談中';
        case 'lost': return '失注';
        default: return status;
    }
}

// 新規連絡先作成
export function createNewContact() {
    currentEditingId = null;
    showContactModal();
}

// 連絡先編集
export function editContact(contactId) {
    currentEditingId = contactId;
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    showContactModal(contact);
}

// モーダル表示
function showContactModal(contact = null) {
    const modal = document.getElementById('contactModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('contactForm');
    
    // タイトル設定
    modalTitle.textContent = contact ? '連絡先編集' : '新規連絡先';
    
    // フォームリセット
    form.reset();
    document.getElementById('typesChips').innerHTML = '';
    document.getElementById('affiliationsChips').innerHTML = '';
    
    // 既存データがある場合は入力
    if (contact) {
        // 基本情報
        document.getElementById('name').value = contact.name || '';
        document.getElementById('yomi').value = contact.yomi || '';
        document.getElementById('company').value = contact.company || '';
        document.getElementById('email').value = contact.email || '';
        document.getElementById('phone').value = contact.phone || '';
        document.getElementById('website').value = contact.website || '';
        document.getElementById('introducer').value = contact.introducer || '';
        document.getElementById('activityArea').value = contact.activityArea || '';
        document.getElementById('residence').value = contact.residence || '';
        document.getElementById('hobbies').value = contact.hobbies || '';
        
        // 分類
        if (contact.types) {
            contact.types.forEach(type => addChip('types', type));
        }
        if (contact.affiliations) {
            contact.affiliations.forEach(affiliation => addChip('affiliations', affiliation));
        }
        document.getElementById('wantToConnect').value = contact.wantToConnect ? contact.wantToConnect.join(', ') : '';
        document.getElementById('goldenEgg').value = contact.goldenEgg ? contact.goldenEgg.join(', ') : '';
        
        // 詳細情報
        document.getElementById('strengths').value = contact.strengths || '';
        document.getElementById('careerHistory').value = contact.careerHistory || '';
        document.getElementById('cutout').value = contact.cutout || '';
        
        // 契約情報
        document.getElementById('contractStatus').value = contact.contractStatus || '';
        document.getElementById('contractDate').value = contact.contractDate || '';
        document.getElementById('billingStartDate').value = contact.billingStartDate || '';
        document.getElementById('directDebitStartDate').value = contact.directDebitStartDate || '';
        
        // ファイル表示
        if (contact.photoUrl) {
            displayUploadedFile('photoUpload', contact.photoUrl, 'photo');
        }
        if (contact.businessCardUrl) {
            displayUploadedFile('businessCardUpload', contact.businessCardUrl, 'businessCard');
        }
        if (contact.otherFiles && contact.otherFiles.length > 0) {
            contact.otherFiles.forEach(file => {
                displayUploadedFile('otherFilesUpload', file.url, 'other', file.name);
            });
        }
    }
    
    modal.style.display = 'block';
}

// チップ追加
function addChip(fieldName, value) {
    const container = document.getElementById(`${fieldName}Chips`);
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `
        ${escapeHtml(value)}
        <span class="chip-remove" onclick="removeChip(this, '${fieldName}', '${value}')">×</span>
    `;
    container.appendChild(chip);
}

// チップ削除
window.removeChip = function(element, fieldName, value) {
    element.parentElement.remove();
};

// アップロードファイル表示
function displayUploadedFile(containerId, url, type, fileName = '') {
    const container = document.getElementById(containerId);
    const display = document.createElement('div');
    display.style.marginTop = '10px';
    
    if (type === 'photo') {
        display.innerHTML = `
            <img src="${url}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
            <button type="button" class="btn btn-secondary" onclick="removeUploadedFile('${containerId}', '${type}')">削除</button>
        `;
    } else {
        display.innerHTML = `
            <a href="${url}" target="_blank">${fileName || 'ファイルを表示'}</a>
            <button type="button" class="btn btn-secondary" onclick="removeUploadedFile('${containerId}', '${type}')">削除</button>
        `;
    }
    
    container.appendChild(display);
}

// 連絡先保存
export async function saveContact(formData) {
    try {
        const contact = currentEditingId 
            ? contacts.find(c => c.id === currentEditingId)
            : {
                id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString()
              };
        
        // 基本情報
        contact.name = formData.get('name');
        contact.yomi = formData.get('yomi');
        contact.company = formData.get('company');
        contact.email = formData.get('email');
        contact.phone = formData.get('phone');
        contact.website = formData.get('website');
        contact.introducer = formData.get('introducer');
        contact.activityArea = formData.get('activityArea');
        contact.residence = formData.get('residence');
        contact.hobbies = formData.get('hobbies');
        
        // 分類（チップから取得）
        contact.types = getChipValues('typesChips');
        contact.affiliations = getChipValues('affiliationsChips');
        contact.wantToConnect = formData.get('wantToConnect').split(',').map(s => s.trim()).filter(s => s);
        contact.goldenEgg = formData.get('goldenEgg').split(',').map(s => s.trim()).filter(s => s);
        
        // 詳細情報
        contact.strengths = formData.get('strengths');
        contact.careerHistory = formData.get('careerHistory');
        contact.cutout = formData.get('cutout');
        
        // 契約情報
        contact.contractStatus = formData.get('contractStatus');
        contact.contractDate = formData.get('contractDate');
        contact.billingStartDate = formData.get('billingStartDate');
        contact.directDebitStartDate = formData.get('directDebitStartDate');
        
        // 契約更新日の自動計算
        if (contact.contractDate) {
            const contractDate = new Date(contact.contractDate);
            contractDate.setFullYear(contractDate.getFullYear() + 1);
            contact.contractRenewalDate = contractDate.toISOString().split('T')[0];
        }
        
        // 更新日時
        contact.updatedAt = new Date().toISOString();
        
        // ファイルアップロード処理
        await handleFileUploads(contact);
        
        // 保存
        if (!currentEditingId) {
            contacts.push(contact);
        }
        
        await saveJsonFile('contacts.json', contacts);
        
        // 初回ミーティング記録の処理
        if (formData.get('addInitialMeeting') === 'on') {
            await addInitialMeeting(contact.id, formData);
        }
        
        // UI更新
        renderContacts();
        document.getElementById('contactModal').style.display = 'none';
        showNotification('連絡先を保存しました', 'success');
        
    } catch (error) {
        console.error('Error saving contact:', error);
        showNotification('保存に失敗しました', 'error');
    }
}

// チップの値取得
function getChipValues(containerId) {
    const container = document.getElementById(containerId);
    const chips = container.querySelectorAll('.chip');
    return Array.from(chips).map(chip => chip.textContent.replace('×', '').trim());
}

// ファイルアップロード処理
async function handleFileUploads(contact) {
    // ここでファイルアップロード処理を実装
    // 実際のファイルアップロードはfile inputのchangeイベントで処理
}

// 初回ミーティング追加
async function addInitialMeeting(contactId, formData) {
    const { saveMeeting } = await import('./meetings.js');
    
    const meetingData = {
        contactId: contactId,
        date: formData.get('meetingDate'),
        content: formData.get('meetingContent'),
        todos: []
    };
    
    await saveMeeting(meetingData);
}

// 表示モード切替
export function toggleViewMode() {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    document.getElementById('viewIcon').textContent = viewMode === 'grid' ? '📋' : '📇';
    renderContacts();
}

// 管理モード切替
export function toggleManagementMode() {
    currentMode = currentMode === 'sales' ? 'customer' : 'sales';
    document.getElementById('modeToggle').textContent = 
        currentMode === 'sales' ? '商談管理モード' : '顧客管理モード';
    renderContacts();
}