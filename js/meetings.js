// meetings.js - ミーティング記録管理

import { loadJsonFile, saveJsonFile } from './drive.js';
import { showNotification } from './auth.js';
import { renderMarkdown, escapeHtml, formatDate } from './utils.js';

// 状態管理
let meetings = [];
let currentContactId = null;
let currentEditingMeetingId = null;

// ミーティングテンプレート
const meetingTemplates = [
    {
        name: '初回ミーティング',
        content: `## 自己紹介
- 

## ビジネス内容
- 

## 課題・ニーズ
- 

## 次回アクション
- `
    },
    {
        name: 'フォローアップ',
        content: `## 前回からの進捗
- 

## 本日の議題
- 

## 決定事項
- 

## 次回までのタスク
- `
    },
    {
        name: '契約前確認',
        content: `## サービス内容確認
- 

## 料金・支払い条件
- 

## 契約条件
- 

## 質疑応答
- `
    }
];

// ミーティング読み込み
export async function loadMeetings(contactId = null) {
    try {
        const meetingsData = await loadJsonFile('meetings.json');
        meetings = meetingsData || [];
        
        if (contactId) {
            currentContactId = contactId;
            return meetings.filter(m => m.contactId === contactId);
        }
        
        return meetings;
    } catch (error) {
        console.error('Error loading meetings:', error);
        showNotification('ミーティング記録の読み込みに失敗しました', 'error');
        return [];
    }
}

// ミーティング保存
export async function saveMeeting(meetingData) {
    try {
        const meeting = currentEditingMeetingId
            ? meetings.find(m => m.id === currentEditingMeetingId)
            : {
                id: `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString()
              };
        
        // データ更新
        meeting.contactId = meetingData.contactId;
        meeting.date = meetingData.date;
        meeting.content = meetingData.content;
        meeting.todos = meetingData.todos || [];
        meeting.attachments = meetingData.attachments || [];
        meeting.updatedAt = new Date().toISOString();
        
        // 新規の場合は追加
        if (!currentEditingMeetingId) {
            meetings.push(meeting);
        }
        
        // 保存
        await saveJsonFile('meetings.json', meetings);
        
        // ドラフト削除
        removeDraft(meeting.contactId);
        
        showNotification('ミーティング記録を保存しました', 'success');
        return meeting;
        
    } catch (error) {
        console.error('Error saving meeting:', error);
        showNotification('ミーティング記録の保存に失敗しました', 'error');
        throw error;
    }
}

// ミーティング削除
export async function deleteMeeting(meetingId) {
    try {
        meetings = meetings.filter(m => m.id !== meetingId);
        await saveJsonFile('meetings.json', meetings);
        showNotification('ミーティング記録を削除しました', 'success');
    } catch (error) {
        console.error('Error deleting meeting:', error);
        showNotification('ミーティング記録の削除に失敗しました', 'error');
        throw error;
    }
}

// ミーティングモーダル作成
export function createMeetingModal() {
    const modal = document.createElement('div');
    modal.id = 'meetingModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="meetingModalTitle">ミーティング記録</h2>
                <button class="close-btn" onclick="closeMeetingModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="meetingForm">
                    <div class="form-section">
                        <div class="form-group">
                            <label for="meetingDate">日時 *</label>
                            <input type="datetime-local" id="meetingDate" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="meetingTemplate">テンプレート</label>
                            <select id="meetingTemplate" onchange="applyMeetingTemplate()">
                                <option value="">選択してください</option>
                                ${meetingTemplates.map((t, i) => 
                                    `<option value="${i}">${escapeHtml(t.name)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="meetingContent">内容</label>
                            <textarea id="meetingContent" rows="15" placeholder="Markdown記法が使えます"></textarea>
                            <div style="margin-top: 0.5rem;">
                                <button type="button" class="btn btn-secondary" onclick="previewMeetingContent()">プレビュー</button>
                            </div>
                            <div id="meetingPreview" style="display: none; margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 4px;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label>ToDoリスト</label>
                            <div id="todoList"></div>
                            <button type="button" class="btn btn-secondary" onclick="addTodoItem()">ToDo追加</button>
                        </div>
                        
                        <div class="form-group">
                            <label>添付ファイル</label>
                            <div id="meetingAttachments" class="file-upload">
                                <p>クリックまたはドラッグ&ドロップ（複数可）</p>
                            </div>
                            <div id="attachmentsList"></div>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <button type="submit" class="btn">保存</button>
                        <button type="button" class="btn btn-secondary" onclick="saveDraft()">下書き保存</button>
                        <button type="button" class="btn btn-secondary" onclick="closeMeetingModal()">キャンセル</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // イベントリスナー設定
    document.getElementById('meetingForm').addEventListener('submit', handleMeetingSubmit);
    
    // 自動保存設定
    let autoSaveTimer;
    document.getElementById('meetingContent').addEventListener('input', () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(saveDraft, 30000); // 30秒後に自動保存
    });
}

// ミーティングモーダル表示
export function showMeetingModal(contactId, meetingId = null) {
    currentContactId = contactId;
    currentEditingMeetingId = meetingId;
    
    const modal = document.getElementById('meetingModal');
    const form = document.getElementById('meetingForm');
    
    // フォームリセット
    form.reset();
    document.getElementById('todoList').innerHTML = '';
    document.getElementById('attachmentsList').innerHTML = '';
    document.getElementById('meetingPreview').style.display = 'none';
    
    // 編集の場合はデータ読み込み
    if (meetingId) {
        const meeting = meetings.find(m => m.id === meetingId);
        if (meeting) {
            document.getElementById('meetingDate').value = meeting.date;
            document.getElementById('meetingContent').value = meeting.content;
            
            // ToDoリスト復元
            if (meeting.todos && meeting.todos.length > 0) {
                meeting.todos.forEach(todo => {
                    addTodoItem(todo);
                });
            }
            
            // 添付ファイル表示
            if (meeting.attachments && meeting.attachments.length > 0) {
                meeting.attachments.forEach(attachment => {
                    displayAttachment(attachment);
                });
            }
        }
    } else {
        // 新規の場合、ドラフトチェック
        loadDraft(contactId);
    }
    
    modal.style.display = 'block';
}

// ミーティングモーダルを閉じる
window.closeMeetingModal = function() {
    document.getElementById('meetingModal').style.display = 'none';
};

// テンプレート適用
window.applyMeetingTemplate = function() {
    const templateIndex = document.getElementById('meetingTemplate').value;
    if (templateIndex !== '') {
        const template = meetingTemplates[parseInt(templateIndex)];
        document.getElementById('meetingContent').value = template.content;
    }
};

// コンテンツプレビュー
window.previewMeetingContent = function() {
    const content = document.getElementById('meetingContent').value;
    const preview = document.getElementById('meetingPreview');
    
    if (preview.style.display === 'none') {
        preview.innerHTML = renderMarkdown(content);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
};

// ToDo項目追加
window.addTodoItem = function(todo = null) {
    const todoList = document.getElementById('todoList');
    const todoId = `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const todoItem = document.createElement('div');
    todoItem.className = 'form-group';
    todoItem.style.display = 'flex';
    todoItem.style.gap = '0.5rem';
    todoItem.style.alignItems = 'center';
    
    todoItem.innerHTML = `
        <input type="checkbox" id="${todoId}_done" ${todo && todo.done ? 'checked' : ''}>
        <input type="text" id="${todoId}_text" placeholder="タスク内容" value="${todo ? escapeHtml(todo.text) : ''}" style="flex: 1;">
        <input type="date" id="${todoId}_due" value="${todo ? todo.due : ''}">
        <button type="button" class="btn btn-icon" onclick="removeTodoItem('${todoId}')">×</button>
    `;
    
    todoItem.id = todoId;
    todoList.appendChild(todoItem);
};

// ToDo項目削除
window.removeTodoItem = function(todoId) {
    document.getElementById(todoId).remove();
};

// ミーティング送信処理
async function handleMeetingSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // ToDoリスト収集
    const todos = [];
    const todoItems = document.querySelectorAll('#todoList > div');
    todoItems.forEach(item => {
        const todoId = item.id;
        const done = document.getElementById(`${todoId}_done`).checked;
        const text = document.getElementById(`${todoId}_text`).value;
        const due = document.getElementById(`${todoId}_due`).value;
        
        if (text) {
            todos.push({ done, text, due });
        }
    });
    
    const meetingData = {
        contactId: currentContactId,
        date: formData.get('meetingDate'),
        content: formData.get('meetingContent'),
        todos: todos,
        attachments: [] // 添付ファイルは別途処理
    };
    
    await saveMeeting(meetingData);
    closeMeetingModal();
    
    // リロード処理をトリガー（必要に応じて）
}

// ドラフト保存
window.saveDraft = function() {
    const draftData = {
        contactId: currentContactId,
        date: document.getElementById('meetingDate').value,
        content: document.getElementById('meetingContent').value,
        todos: collectTodos(),
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`meeting_draft_${currentContactId}`, JSON.stringify(draftData));
    showNotification('下書きを保存しました', 'success');
};

// ToDoリスト収集
function collectTodos() {
    const todos = [];
    const todoItems = document.querySelectorAll('#todoList > div');
    todoItems.forEach(item => {
        const todoId = item.id;
        const done = document.getElementById(`${todoId}_done`).checked;
        const text = document.getElementById(`${todoId}_text`).value;
        const due = document.getElementById(`${todoId}_due`).value;
        
        if (text) {
            todos.push({ done, text, due });
        }
    });
    return todos;
}

// ドラフト読み込み
function loadDraft(contactId) {
    const draftKey = `meeting_draft_${contactId}`;
    const draftData = localStorage.getItem(draftKey);
    
    if (draftData) {
        try {
            const draft = JSON.parse(draftData);
            document.getElementById('meetingDate').value = draft.date || '';
            document.getElementById('meetingContent').value = draft.content || '';
            
            if (draft.todos && draft.todos.length > 0) {
                draft.todos.forEach(todo => {
                    addTodoItem(todo);
                });
            }
            
            showNotification('下書きを復元しました', 'info');
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }
}

// ドラフト削除
function removeDraft(contactId) {
    localStorage.removeItem(`meeting_draft_${contactId}`);
}

// 添付ファイル表示
function displayAttachment(attachment) {
    const attachmentsList = document.getElementById('attachmentsList');
    const attachmentItem = document.createElement('div');
    attachmentItem.style.marginTop = '0.5rem';
    
    attachmentItem.innerHTML = `
        <a href="${attachment.url}" target="_blank">${escapeHtml(attachment.name)}</a>
        <button type="button" class="btn btn-icon" onclick="removeAttachment('${attachment.id}')">×</button>
    `;
    
    attachmentsList.appendChild(attachmentItem);
}

// ミーティング一覧表示
export function renderMeetingsList(contactId) {
    const contactMeetings = meetings.filter(m => m.contactId === contactId);
    
    if (contactMeetings.length === 0) {
        return '<p style="color: var(--text-secondary);">ミーティング記録はありません</p>';
    }
    
    return contactMeetings
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(meeting => `
            <div class="meeting-item" style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong>${formatDate(meeting.date)}</strong>
                    <div>
                        <button class="btn btn-icon" onclick="editMeeting('${meeting.id}')">編集</button>
                        <button class="btn btn-icon" onclick="deleteMeetingConfirm('${meeting.id}')">削除</button>
                    </div>
                </div>
                <div class="meeting-content">
                    ${renderMarkdown(meeting.content).substring(0, 200)}...
                </div>
                ${meeting.todos && meeting.todos.length > 0 ? `
                    <div style="margin-top: 0.5rem;">
                        <strong>ToDo:</strong>
                        ${meeting.todos.filter(t => !t.done).length} / ${meeting.todos.length} 件
                    </div>
                ` : ''}
            </div>
        `).join('');
}

// ミーティング編集
window.editMeeting = function(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
        showMeetingModal(meeting.contactId, meetingId);
    }
};

// ミーティング削除確認
window.deleteMeetingConfirm = async function(meetingId) {
    if (confirm('このミーティング記録を削除してもよろしいですか？')) {
        await deleteMeeting(meetingId);
        // 再描画処理
    }
};