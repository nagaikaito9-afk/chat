import { state } from '../state.js';
import { db, ref, set, remove, onValue } from '../config.js';
import { showToast } from '../utils/helpers.js';

let currentBgUnsubscribe = null;
let roomsCache = {};

// Keep track of rooms metadata
export function setRoomsCache(rooms) {
  roomsCache = rooms || {};
}

// 🗑️ Delete Room Handler
export async function deleteUserRoom(roomId, roomName, event) {
  if (event) event.stopPropagation();

  if (roomId === 'public_main' || roomId === 'public_bug_report' || roomId === 'public_feature_request') {
    showToast('デフォルトシステム部屋は削除できません', 'warning');
    return;
  }

  const roomData = roomsCache[roomId];
  const isCreator = roomData && roomData.createdBy === state.myUserId;
  const isAdmin = state.isAdminMode;

  if (!isCreator && !isAdmin) {
    showToast('この部屋の作成者のみ削除可能です', 'warning');
    return;
  }

  const confirmMsg = `本当に部屋「${roomName}」を削除しますか？\n※チャットメッセージ履歴と背景設定も削除されます。`;
  if (!confirm(confirmMsg)) return;

  try {
    await remove(ref(db, `rooms_meta/${roomId}`));
    await remove(ref(db, `rooms/${roomId}`));

    showToast(`部屋「${roomName}」を削除しました`, 'success');

    if (state.currentRoomId === roomId) {
      if (window.switchRoom) {
        window.switchRoom('public_main', '💬 雑談部屋', '誰でも自由に雑談できるメインの部屋です');
      }
    }
  } catch (err) {
    console.error('Failed to delete room:', err);
    showToast('部屋の削除に失敗しました', 'danger');
  }
}

// Attach deleteUserRoom to window for inline button calls
window.deleteUserRoom = deleteUserRoom;

// 🖼️ Setup Chat Messages Right-Click Context Menu Listener
export function setupChatBackgroundContextMenu() {
  const chatMessagesEl = document.getElementById('chat-messages');
  if (!chatMessagesEl) return;

  chatMessagesEl.addEventListener('contextmenu', (e) => {
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    e.preventDefault();

    const currentRoom = roomsCache[state.currentRoomId];
    const isCreator = currentRoom && currentRoom.createdBy === state.myUserId;
    const isAdmin = state.isAdminMode;
    const isAllowed = (state.currentRoomId === 'public_main') ? isAdmin : (isCreator || isAdmin);

    if (!isAllowed) {
      const targetRole = state.currentRoomId === 'public_main' ? '運営（管理者）のみ' : '部屋の作成者のみ';
      showToast(`チャット背景の変更は${targetRole}可能です`, 'warning');
      return;
    }

    openRoomBgModal();
  });
}

export function openRoomBgModal() {
  const modal = document.getElementById('room-bg-modal');
  if (modal) modal.classList.remove('hidden');
}

// ⚙️ Setup Room Background Customizer Modal Controls
export function setupRoomBgModal() {
  const modal = document.getElementById('room-bg-modal');
  if (!modal) return;

  modal.querySelectorAll('.modal-close').forEach(b => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });

  // Preset Card Handlers
  modal.querySelectorAll('.room-bg-card').forEach(card => {
    card.addEventListener('click', async () => {
      modal.querySelectorAll('.room-bg-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const bgVal = card.dataset.bgVal;
      await updateRoomBackgroundConfig({ type: 'preset', value: bgVal });
      showToast('背景テーマを適用しました！', 'success');
    });
  });

  // Custom File Upload
  const fileInput = document.getElementById('room-bg-file-input');
  const fileNameSpan = document.getElementById('room-bg-file-name');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (fileNameSpan) fileNameSpan.textContent = file.name;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target.result;
        await updateRoomBackgroundConfig({ type: 'image', value: dataUrl });
        showToast('オリジナル背景画像を適用しました！', 'success');
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }

  // URL Input
  const urlInput = document.getElementById('room-bg-url-input');
  const applyUrlBtn = document.getElementById('btn-apply-bg-url');
  if (applyUrlBtn && urlInput) {
    applyUrlBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) {
        showToast('画像のURLを入力してください', 'warning');
        return;
      }
      await updateRoomBackgroundConfig({ type: 'image', value: url });
      showToast('URL背景画像を適用しました！', 'success');
      urlInput.value = '';
    });
  }

  // Reset Button
  const resetBtn = document.getElementById('btn-reset-room-bg');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await updateRoomBackgroundConfig(null);
      showToast('背景を標準に戻しました', 'info');
    });
  }
}

// 🔄 Update Background Config in Firebase
async function updateRoomBackgroundConfig(config) {
  try {
    if (config) {
      config.updatedBy = state.myName || 'User';
      config.updatedAt = Date.now();
      await set(ref(db, `rooms_meta/${state.currentRoomId}/bgConfig`), config);
    } else {
      await remove(ref(db, `rooms_meta/${state.currentRoomId}/bgConfig`));
    }
  } catch (err) {
    console.error('Failed to update room background config:', err);
    showToast('背景設定の更新に失敗しました', 'danger');
  }
}

// 🎧 Realtime Listener for Active Room Background
export function listenRoomBackground(roomId) {
  if (currentBgUnsubscribe) {
    currentBgUnsubscribe();
    currentBgUnsubscribe = null;
  }

  const bgRef = ref(db, `rooms_meta/${roomId}/bgConfig`);
  currentBgUnsubscribe = onValue(bgRef, (snapshot) => {
    const config = snapshot.val();
    applyRoomBackgroundToDOM(config);
  });
}

// 🖌️ Apply Background to DOM (#chat-messages)
export function applyRoomBackgroundToDOM(config) {
  const chatMessagesEl = document.getElementById('chat-messages');
  if (!chatMessagesEl) return;

  if (!config || !config.value) {
    chatMessagesEl.style.backgroundImage = '';
    chatMessagesEl.style.backgroundColor = '';
    chatMessagesEl.className = 'chat-messages';
    return;
  }

  if (config.type === 'preset') {
    chatMessagesEl.style.backgroundImage = '';
    chatMessagesEl.style.backgroundColor = '';
    chatMessagesEl.className = `chat-messages bg-preset-${config.value}`;
  } else if (config.type === 'image') {
    chatMessagesEl.className = 'chat-messages';
    chatMessagesEl.style.backgroundImage = `url("${config.value}")`;
    chatMessagesEl.style.backgroundSize = 'cover';
    chatMessagesEl.style.backgroundPosition = 'center';
    chatMessagesEl.style.backgroundRepeat = 'no-repeat';
  }
}
