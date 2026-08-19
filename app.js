// Import Firebase v10 Modular SDK via CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
  getDatabase, ref, set, push, onValue, onChildAdded, onChildChanged, 
  remove, get, serverTimestamp, onDisconnect 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// User-provided Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcwXMn0N7qct45IORGaVqF_pdeGgb9NIA",
  authDomain: "chat-3e0cc.firebaseapp.com",
  projectId: "chat-3e0cc",
  storageBucket: "chat-3e0cc.firebasestorage.app",
  messagingSenderId: "585121998822",
  appId: "1:585121998822:web:c05c844b651a794b859827",
  databaseURL: "https://chat-3e0cc-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Global App State
let myUserId = localStorage.getItem('cyberchat_user_id') || 'usr_' + Math.random().toString(36).substring(2, 10);
localStorage.setItem('cyberchat_user_id', myUserId);

let myName = '';
let myTrip = '◆(なし)';
let soundEnabled = true;
let isScrolledToBottom = true;
let unreadMessagesCount = 0;
let selectedImageBase64 = null;
let currentFilter = 'all';
let searchKeyword = '';
let allMessages = new Map();
let activeUsersMap = new Map();

// Sound Synthesizer (Web Audio API)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (!soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'send') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'receive') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (e) {
    console.warn("Audio play failed:", e);
  }
}

// SHA-256 Trip Generator
async function generateTrip(tripKey) {
  if (!tripKey || tripKey.trim() === '') {
    return '◆(なし)';
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(tripKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // 10桁の英数字トリップにフォーマット
  return '◆' + hashHex.substring(0, 10);
}

// Toast Notifications
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// HTML Escaping Utility
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format Timestamp
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Duplicate Name Check with Firebase RTDB
async function checkDuplicateName(nameToCheck, excludeUserId = null) {
  try {
    const snapshot = await get(ref(db, 'active_users'));
    if (!snapshot.exists()) return false;
    
    const users = snapshot.val();
    const targetLower = nameToCheck.trim().toLowerCase();
    
    for (const uid in users) {
      if (excludeUserId && uid === excludeUserId) continue;
      if (users[uid] && users[uid].name && users[uid].name.trim().toLowerCase() === targetLower) {
        return true; // Duplicated!
      }
    }
    return false;
  } catch (e) {
    console.warn("Duplicate check error or initial DB read:", e);
    return false;
  }
}

// User Avatar Color Helper
function getAvatarBg(name) {
  const colors = [
    'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)',
    'linear-gradient(135deg, #ff007f 0%, #7000ff 100%)',
    'linear-gradient(135deg, #00ff88 0%, #00b8ff 100%)',
    'linear-gradient(135deg, #ffb800 0%, #ff0055 100%)',
    'linear-gradient(135deg, #9d4edd 0%, #560bad 100%)'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Initialize Application & Event Listeners
function initApp() {
  setupTripInputListeners();
  setupJoinForm();
  setupChatControls();
  setupPollModal();
  setupProfileModal();
  setupImageModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Trip Preview Update
function setupTripInputListeners() {
  const joinTripKeyInput = document.getElementById('join-tripkey');
  const joinTripPreview = document.getElementById('trip-preview-code');
  
  if (joinTripKeyInput) {
    joinTripKeyInput.addEventListener('input', async () => {
      const code = await generateTrip(joinTripKeyInput.value);
      joinTripPreview.textContent = code;
    });
  }

  const editTripKeyInput = document.getElementById('edit-tripkey');
  const editTripPreview = document.getElementById('edit-trip-preview-code');

  if (editTripKeyInput) {
    editTripKeyInput.addEventListener('input', async () => {
      const code = await generateTrip(editTripKeyInput.value);
      editTripPreview.textContent = code;
    });
  }

  // Toggle Password Visibility
  const toggleJoinVis = document.getElementById('toggle-trip-vis');
  if (toggleJoinVis && joinTripKeyInput) {
    toggleJoinVis.addEventListener('click', () => {
      joinTripKeyInput.type = joinTripKeyInput.type === 'password' ? 'text' : 'password';
    });
  }
  
  const toggleEditVis = document.getElementById('toggle-edit-trip-vis');
  if (toggleEditVis && editTripKeyInput) {
    toggleEditVis.addEventListener('click', () => {
      editTripKeyInput.type = editTripKeyInput.type === 'password' ? 'text' : 'password';
    });
  }
}

// Join Room Handler
function setupJoinForm() {
  const joinForm = document.getElementById('join-form');
  const errorMsg = document.getElementById('join-error-msg');
  const btnStart = document.getElementById('btn-start-chat');

  const handleJoinSubmit = async (e) => {
    if (e) e.preventDefault();
    errorMsg.classList.add('hidden');
    
    const inputName = document.getElementById('join-username').value.trim();
    const inputTripKey = document.getElementById('join-tripkey').value;

    if (!inputName) {
      errorMsg.textContent = 'ユーザー名を入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    btnStart.disabled = true;
    btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 接続中...';

    try {
      // 1. 重複名前チェック
      const isDuplicate = await checkDuplicateName(inputName, myUserId);
      if (isDuplicate) {
        errorMsg.textContent = `「${inputName}」は現在オンラインの他ユーザーが使用しています。別の名前を入力してください。`;
        errorMsg.classList.remove('hidden');
        btnStart.disabled = false;
        btnStart.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> チャットを開始する';
        return;
      }

      // 2. トリップ生成
      myName = inputName;
      myTrip = await generateTrip(inputTripKey);

      // 3. オンラインユーザー登録
      await registerOnlineUser();

      // 4. アプリ画面へ切替
      const joinModal = document.getElementById('join-modal');
      if (joinModal) {
        joinModal.classList.remove('active');
        joinModal.classList.add('hidden');
        joinModal.style.display = 'none';
      }
      const appContainer = document.getElementById('app-container');
      if (appContainer) {
        appContainer.classList.remove('hidden');
      }

      // プロフィール表示更新
      updateMyProfileUI();

      // システム入室メッセージ送信
      sendSystemMessage(`${myName} (${myTrip}) がチャットに参加しました！`);

      // Realtime Sync 開始
      initFirebaseRealtimeSync();

    } catch (err) {
      console.error("Join error:", err);
      // Firebaseルールやネット接続エラーの処理
      errorMsg.textContent = `接続エラー: ${err.message || 'Firebaseデータベースにアクセスできませんでした。'}`;
      errorMsg.classList.remove('hidden');
    } finally {
      btnStart.disabled = false;
      btnStart.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> チャットを開始する';
    }
  };

  if (joinForm) {
    joinForm.addEventListener('submit', handleJoinSubmit);
  }
  if (btnStart) {
    btnStart.addEventListener('click', handleJoinSubmit);
  }
}

// Online User Registration & Disconnect Hook
async function registerOnlineUser() {
  const userRef = ref(db, `active_users/${myUserId}`);
  await set(userRef, {
    name: myName,
    trip: myTrip,
    joinedAt: Date.now()
  });

  // ブラウザ終了/切断時にオンラインリストから自動削除
  onDisconnect(userRef).remove();
}

function updateMyProfileUI() {
  document.getElementById('my-name-display').textContent = myName;
  document.getElementById('my-trip-display').textContent = myTrip;
  const avatar = document.getElementById('my-avatar');
  avatar.textContent = myName.charAt(0).toUpperCase();
  avatar.style.background = getAvatarBg(myName);
}

// Firebase Realtime Listeners
function initFirebaseRealtimeSync() {
  // 1. オンラインユーザーリスト同期
  onValue(ref(db, 'active_users'), (snapshot) => {
    const userListEl = document.getElementById('online-user-list');
    const onlineCountEl = document.getElementById('online-count');
    userListEl.innerHTML = '';
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      const count = Object.keys(users).length;
      onlineCountEl.textContent = `${count}人`;

      Object.entries(users).forEach(([uid, uData]) => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
          <div class="avatar-sm" style="background: ${getAvatarBg(uData.name || '?')}">${escapeHtml((uData.name || '?').charAt(0).toUpperCase())}</div>
          <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(uData.name)} ${uid === myUserId ? '<span style="font-size:0.75rem; opacity:0.6;">(あなた)</span>' : ''}</div>
            <div class="user-item-trip">${escapeHtml(uData.trip || '◆(なし)')}</div>
          </div>
        `;
        userListEl.appendChild(li);
      });
    } else {
      onlineCountEl.textContent = '0人';
    }
  });

  // 2. メッセージ同期
  const messagesRef = ref(db, 'messages');
  const loadingEl = document.getElementById('messages-loading');

  onChildAdded(messagesRef, (snapshot) => {
    if (loadingEl) loadingEl.style.display = 'none';
    const msgId = snapshot.key;
    const msgData = snapshot.val();
    
    allMessages.set(msgId, { id: msgId, ...msgData });
    renderSingleMessage(msgId, msgData);

    // 新着音
    if (msgData.userId !== myUserId && msgData.type !== 'system') {
      playSound('receive');
    }
  });

  onChildChanged(messagesRef, (snapshot) => {
    const msgId = snapshot.key;
    const msgData = snapshot.val();
    allMessages.set(msgId, { id: msgId, ...msgData });
    updateMessageUI(msgId, msgData);
  });
}

// Message Rendering
function renderSingleMessage(msgId, msg) {
  const container = document.getElementById('messages-container');
  const isSelf = msg.userId === myUserId;

  const msgWrapper = document.createElement('div');
  msgWrapper.className = `msg-wrapper ${isSelf ? 'self' : ''} ${msg.type === 'system' ? 'system-msg' : ''}`;
  msgWrapper.id = `msg-${msgId}`;
  msgWrapper.dataset.type = msg.type || 'text';

  if (msg.type === 'system') {
    msgWrapper.innerHTML = `<div class="system-bubble"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(msg.text)}</div>`;
  } else {
    // 構成要素: sender header
    const metaHtml = `
      <div class="msg-meta">
        <span class="msg-sender-name">${escapeHtml(msg.name)} <span class="trip-badge">${escapeHtml(msg.trip)}</span></span>
        <span class="msg-time">${formatTime(msg.timestamp)}</span>
      </div>
    `;

    let contentHtml = '';
    if (msg.type === 'image') {
      contentHtml = `
        <div class="msg-bubble">
          ${msg.text ? `<p>${escapeHtml(msg.text)}</p>` : ''}
          <img src="${msg.imageUrl}" class="msg-image" alt="投稿画像" onclick="window.openImageModal('${msg.imageUrl}')">
        </div>
      `;
    } else if (msg.type === 'poll') {
      contentHtml = renderPollCardHtml(msgId, msg.poll);
    } else {
      // Standard Text
      contentHtml = `<div class="msg-bubble">${formatMessageText(msg.text)}</div>`;
    }

    // リアクションバー
    const reactionsHtml = `<div class="msg-reactions" id="reactions-${msgId}">${renderReactionsHtml(msgId, msg.reactions)}</div>`;

    msgWrapper.innerHTML = metaHtml + contentHtml + reactionsHtml;
  }

  // フィルタ/検索条件判定
  applyFilterAndSearchToNode(msgWrapper, msg);

  container.appendChild(msgWrapper);

  // スクロール制御
  const messagesBox = document.getElementById('chat-messages');
  if (isSelf || isScrolledToBottom) {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  } else {
    unreadMessagesCount++;
    updateScrollBottomButton();
  }
}

// Text Formatting (URLs to links, line breaks)
function formatMessageText(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  // URL -> clickable link
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  escaped = escaped.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-primary); underline">${url}</a>`);
  // 改行
  return escaped.replace(/\n/g, '<br>');
}

// Poll UI Renderer
function renderPollCardHtml(msgId, pollData) {
  if (!pollData) return '';

  const totalVotes = pollData.votes ? Object.keys(pollData.votes).length : 0;
  const userVoteOption = pollData.votes ? pollData.votes[myUserId] : undefined;

  // 各選択肢の票数集計
  const optionCounts = (pollData.options || []).map(() => 0);
  if (pollData.votes) {
    Object.values(pollData.votes).forEach(optIdx => {
      if (optionCounts[optIdx] !== undefined) {
        optionCounts[optIdx]++;
      }
    });
  }

  const optionsHtml = (pollData.options || []).map((optText, idx) => {
    const count = optionCounts[idx];
    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const isVoted = userVoteOption === idx;

    return `
      <div class="poll-option-btn ${isVoted ? 'voted' : ''}" onclick="window.votePoll('${msgId}', ${idx})">
        <div class="poll-progress-bar" style="width: ${percent}%"></div>
        <span class="poll-option-text">
          <i class="fa-regular ${isVoted ? 'fa-circle-check text-success' : 'fa-circle'}"></i> ${escapeHtml(optText)}
        </span>
        <span class="poll-option-count">${count}票 (${percent}%)</span>
      </div>
    `;
  }).join('');

  return `
    <div class="msg-bubble poll-card">
      <div class="poll-question"><i class="fa-solid fa-chart-simple text-success"></i> ${escapeHtml(pollData.question)}</div>
      <div class="poll-options">${optionsHtml}</div>
      <div class="poll-total-votes">総投票数: ${totalVotes}票</div>
    </div>
  `;
}

// Reaction UI Renderer
function renderReactionsHtml(msgId, reactionsData) {
  const emojis = ['👍', '❤️', '😂', '😮', '🎉'];
  let html = '';

  emojis.forEach(emoji => {
    const userList = (reactionsData && reactionsData[emoji]) ? Object.keys(reactionsData[emoji]) : [];
    const count = userList.length;
    const isUserReacted = userList.includes(myUserId);

    if (count > 0 || isUserReacted) {
      html += `
        <button class="reaction-pill ${isUserReacted ? 'user-reacted' : ''}" onclick="window.toggleReaction('${msgId}', '${emoji}')">
          <span>${emoji}</span> <span>${count}</span>
        </button>
      `;
    }
  });

  // クイック追加ボタン
  html += `
    <button class="reaction-trigger-btn" onclick="window.toggleQuickReactionMenu('${msgId}')" title="リアクション追加">
      <i class="fa-regular fa-face-smile"></i>
    </button>
  `;

  return html;
}

// Voting Function (Global Scope for inline onclick)
window.votePoll = async (msgId, optionIndex) => {
  try {
    const voteRef = ref(db, `messages/${msgId}/poll/votes/${myUserId}`);
    await set(voteRef, optionIndex);
  } catch (err) {
    console.error("Poll vote error:", err);
    showToast('投票に失敗しました', 'error');
  }
};

// Reactions Function
window.toggleReaction = async (msgId, emoji) => {
  try {
    const reactionUserRef = ref(db, `messages/${msgId}/reactions/${emoji}/${myUserId}`);
    const snapshot = await get(reactionUserRef);
    if (snapshot.exists()) {
      await remove(reactionUserRef);
    } else {
      await set(reactionUserRef, true);
    }
  } catch (err) {
    console.error("Reaction toggle error:", err);
  }
};

window.toggleQuickReactionMenu = (msgId) => {
  const existingPopup = document.querySelector('.quick-reaction-popup');
  if (existingPopup) existingPopup.remove();

  const container = document.getElementById(`reactions-${msgId}`);
  if (!container) return;

  const popup = document.createElement('div');
  popup.className = 'quick-reaction-popup animate-scale-up';
  popup.innerHTML = `
    <span onclick="window.toggleReaction('${msgId}', '👍')">👍</span>
    <span onclick="window.toggleReaction('${msgId}', '❤️')">❤️</span>
    <span onclick="window.toggleReaction('${msgId}', '😂')">😂</span>
    <span onclick="window.toggleReaction('${msgId}', '😮')">😮</span>
    <span onclick="window.toggleReaction('${msgId}', '🎉')">🎉</span>
  `;
  container.appendChild(popup);

  setTimeout(() => {
    const closeHandler = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 50);
};

// Update Message UI when votes/reactions change
function updateMessageUI(msgId, msgData) {
  const wrapper = document.getElementById(`msg-${msgId}`);
  if (!wrapper) return;

  if (msgData.type === 'poll') {
    const bubble = wrapper.querySelector('.msg-bubble');
    if (bubble) {
      bubble.outerHTML = renderPollCardHtml(msgId, msgData.poll);
    }
  }

  const reactionsContainer = document.getElementById(`reactions-${msgId}`);
  if (reactionsContainer) {
    reactionsContainer.innerHTML = renderReactionsHtml(msgId, msgData.reactions);
  }
}

// Filter and Search Logic
function applyFilterAndSearchToNode(node, msg) {
  let visible = true;

  // 1. タイプフィルター
  if (currentFilter === 'image' && msg.type !== 'image') visible = false;
  if (currentFilter === 'poll' && msg.type !== 'poll') visible = false;

  // 2. キーワード検索
  if (searchKeyword && visible) {
    const textToSearch = (msg.text || '') + (msg.name || '') + (msg.poll ? msg.poll.question : '');
    if (!textToSearch.toLowerCase().includes(searchKeyword.toLowerCase())) {
      visible = false;
    }
  }

  if (visible) {
    node.classList.remove('hidden');
  } else {
    node.classList.add('hidden');
  }
}

function filterAllMessages() {
  allMessages.forEach((msg, msgId) => {
    const node = document.getElementById(`msg-${msgId}`);
    if (node) {
      applyFilterAndSearchToNode(node, msg);
    }
  });
}

// Chat Controls & Message Sending
function setupChatControls() {
  const textInput = document.getElementById('message-text-input');
  const btnSend = document.getElementById('btn-send-message');
  const fileInput = document.getElementById('image-file-input');
  const previewBar = document.getElementById('attachment-preview');
  const previewImg = document.getElementById('preview-img');
  const btnRemoveAttachment = document.getElementById('btn-remove-attachment');
  const messagesBox = document.getElementById('chat-messages');

  // Textarea Auto resize & Enter send
  textInput.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageHandler();
    }
  });

  btnSend.addEventListener('click', sendMessageHandler);

  // Image Attachment Handling (Canvas Compression)
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('画像ファイルを選択してください', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        // Canvas リサイズ (最大幅/高さ 800px)
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 0.7 圧縮
        selectedImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
        previewImg.src = selectedImageBase64;
        previewBar.classList.remove('hidden');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

  btnRemoveAttachment.addEventListener('click', () => {
    selectedImageBase64 = null;
    fileInput.value = '';
    previewBar.classList.add('hidden');
  });

  // Message Sending Handler
  async function sendMessageHandler() {
    const text = textInput.value.trim();
    if (!text && !selectedImageBase64) return;

    try {
      const newMsgRef = push(ref(db, 'messages'));
      const msgObj = {
        userId: myUserId,
        name: myName,
        trip: myTrip,
        type: selectedImageBase64 ? 'image' : 'text',
        text: text,
        timestamp: Date.now()
      };

      if (selectedImageBase64) {
        msgObj.imageUrl = selectedImageBase64;
      }

      await set(newMsgRef, msgObj);

      // Reset Inputs
      textInput.value = '';
      textInput.style.height = 'auto';
      selectedImageBase64 = null;
      fileInput.value = '';
      previewBar.classList.add('hidden');

      playSound('send');
    } catch (err) {
      console.error("Send message error:", err);
      showToast('メッセージ送信に失敗しました', 'error');
    }
  }

  // Scroll Behavior
  messagesBox.addEventListener('scroll', () => {
    const threshold = 80;
    isScrolledToBottom = messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight <= threshold;
    if (isScrolledToBottom) {
      unreadMessagesCount = 0;
      updateScrollBottomButton();
    }
  });

  document.getElementById('btn-scroll-bottom').addEventListener('click', () => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
    unreadMessagesCount = 0;
    updateScrollBottomButton();
  });

  // Filter Buttons
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      filterAllMessages();
    });
  });

  // Search Input
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    filterAllMessages();
  });

  // Toggle Sound & Theme
  const soundBtn = document.getElementById('btn-toggle-sound');
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.classList.toggle('active', soundEnabled);
    soundBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
    showToast(`通知音を ${soundEnabled ? 'ON' : 'OFF'} に設定しました`);
  });

  const themeBtn = document.getElementById('btn-toggle-theme');
  themeBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') !== 'light';
    if (isDark) {
      document.body.setAttribute('data-theme', 'light');
      themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      document.body.removeAttribute('data-theme');
      themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
  });

  // Mobile Sidebar Toggle
  const sidebar = document.getElementById('sidebar');
  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
    sidebar.classList.add('open');
  });
  document.getElementById('btn-close-sidebar').addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

  // Emoji Picker Toggle
  const emojiBtn = document.getElementById('btn-emoji-toggle');
  const emojiPicker = document.getElementById('emoji-picker');
  emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
  });

  document.querySelectorAll('.emoji-grid span').forEach(span => {
    span.addEventListener('click', () => {
      textInput.value += span.textContent;
      emojiPicker.classList.add('hidden');
      textInput.focus();
    });
  });
}

function updateScrollBottomButton() {
  const btn = document.getElementById('btn-scroll-bottom');
  const badge = document.getElementById('unread-count');
  if (!isScrolledToBottom) {
    btn.classList.remove('hidden');
    if (unreadMessagesCount > 0) {
      badge.textContent = unreadMessagesCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } else {
    btn.classList.add('hidden');
  }
}

// System Message Helper
async function sendSystemMessage(text) {
  try {
    const sysRef = push(ref(db, 'messages'));
    await set(sysRef, {
      userId: 'system',
      type: 'system',
      text: text,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error("System message failed:", e);
  }
}

// Poll Creation Modal Logic
function setupPollModal() {
  const modal = document.getElementById('poll-modal');
  const openBtn = document.getElementById('btn-open-create-poll');
  const addOptBtn = document.getElementById('btn-add-poll-opt');
  const optionsContainer = document.getElementById('poll-options-container');
  const submitBtn = document.getElementById('btn-submit-poll');
  const errorMsg = document.getElementById('poll-error-msg');

  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  document.querySelectorAll('#poll-modal .modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  });

  addOptBtn.addEventListener('click', () => {
    const currentOpts = optionsContainer.querySelectorAll('.poll-opt-row').length;
    if (currentOpts >= 6) {
      showToast('選択肢は最大6個までです', 'error');
      return;
    }
    const row = document.createElement('div');
    row.className = 'poll-opt-row';
    row.innerHTML = `<input type="text" class="poll-opt-input" placeholder="選択肢 ${currentOpts + 1}" maxlength="30">`;
    optionsContainer.appendChild(row);
  });

  submitBtn.addEventListener('click', async () => {
    errorMsg.classList.add('hidden');
    const question = document.getElementById('poll-question').value.trim();
    const optInputs = optionsContainer.querySelectorAll('.poll-opt-input');
    const options = Array.from(optInputs).map(i => i.value.trim()).filter(val => val !== '');

    if (!question) {
      errorMsg.textContent = 'アンケートの質問を入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    if (options.length < 2) {
      errorMsg.textContent = '選択肢を少なくとも2つ以上入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;

    try {
      const newMsgRef = push(ref(db, 'messages'));
      await set(newMsgRef, {
        userId: myUserId,
        name: myName,
        trip: myTrip,
        type: 'poll',
        poll: {
          question: question,
          options: options,
          votes: {}
        },
        timestamp: Date.now()
      });

      modal.classList.add('hidden');
      document.getElementById('poll-question').value = '';
      optionsContainer.innerHTML = `
        <div class="poll-opt-row"><input type="text" class="poll-opt-input" placeholder="選択肢 1" maxlength="30"></div>
        <div class="poll-opt-row"><input type="text" class="poll-opt-input" placeholder="選択肢 2" maxlength="30"></div>
      `;
      showToast('アンケートを投稿しました', 'success');
      playSound('send');
    } catch (err) {
      console.error("Submit poll error:", err);
      errorMsg.textContent = 'アンケートの投稿に失敗しました。';
      errorMsg.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// Edit Profile Modal Logic (Name & Trip Free Change)
function setupProfileModal() {
  const modal = document.getElementById('profile-modal');
  const openBtn = document.getElementById('btn-open-edit-profile');
  const saveBtn = document.getElementById('btn-save-profile');
  const usernameInput = document.getElementById('edit-username');
  const tripkeyInput = document.getElementById('edit-tripkey');
  const errorMsg = document.getElementById('edit-profile-error');

  openBtn.addEventListener('click', () => {
    usernameInput.value = myName;
    tripkeyInput.value = '';
    document.getElementById('edit-trip-preview-code').textContent = myTrip;
    errorMsg.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  document.querySelectorAll('#profile-modal .modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  });

  saveBtn.addEventListener('click', async () => {
    errorMsg.classList.add('hidden');
    const newName = usernameInput.value.trim();
    const newTripKey = tripkeyInput.value;

    if (!newName) {
      errorMsg.textContent = 'ユーザー名を入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;

    try {
      // 名前が変更された場合は重複チェック
      if (newName.toLowerCase() !== myName.toLowerCase()) {
        const isDuplicate = await checkDuplicateName(newName, myUserId);
        if (isDuplicate) {
          errorMsg.textContent = `「${newName}」は現在オンラインの他ユーザーが使用しています。別の名前を入力してください。`;
          errorMsg.classList.remove('hidden');
          saveBtn.disabled = false;
          return;
        }
      }

      const oldName = myName;
      const oldTrip = myTrip;

      myName = newName;
      if (newTripKey) {
        myTrip = await generateTrip(newTripKey);
      }

      // オンライン情報の更新
      await registerOnlineUser();

      // UI更新
      updateMyProfileUI();
      modal.classList.add('hidden');

      // 変更通知メッセージ
      if (oldName !== myName || oldTrip !== myTrip) {
        sendSystemMessage(`${oldName} が名前/トリップを 「${myName} (${myTrip})」 に変更しました`);
      }

      showToast('プロフィールを変更しました', 'success');
    } catch (err) {
      console.error("Save profile error:", err);
      errorMsg.textContent = '変更の保存に失敗しました。';
      errorMsg.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// Fullscreen Image Modal
function setupImageModal() {
  const modal = document.getElementById('image-modal');
  const fullImg = document.getElementById('full-image-display');

  window.openImageModal = (src) => {
    fullImg.src = src;
    modal.classList.remove('hidden');
  };

  document.querySelectorAll('#image-modal .image-modal-close, #image-modal').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('.image-modal-close')) {
        modal.classList.add('hidden');
      }
    });
  });
}
