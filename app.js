// Import Firebase v10 Modular SDK via CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
  getDatabase, ref, set, push, onValue, onChildAdded, onChildChanged, onChildRemoved,
  remove, get, update, serverTimestamp, onDisconnect, query, limitToLast 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// Firebase Configuration
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

// Global State
let myUserId = localStorage.getItem('cyberchat_user_id') || 'usr_' + Math.random().toString(36).substring(2, 10);
localStorage.setItem('cyberchat_user_id', myUserId);

let myName = '';
let myTrip = '◆(なし)';
let myAvatar = '🤖';
let myStatus = '💬 雑談歓迎';
let currentRoomId = 'public_main';

let soundEnabled = true;
let isScrolledToBottom = true;
let unreadMessagesCount = 0;
let selectedFileObject = null;
let currentFilter = 'all';
let searchKeyword = '';
let allMessages = new Map();
let activeUsersMap = new Map();
let ignoredUsersSet = new Set(JSON.parse(localStorage.getItem('cyberchat_ignored_users') || '[]'));

// Whisper (DM) State
let whisperTargetId = null;
let whisperTargetName = null;

// Typing Indicator Timer
let typingTimer = null;
let activeTypingUsers = new Set();

// Voice State
let isVoiceRoomJoined = false;
let isMicMuted = false;
let localAudioStream = null;
let mediaRecorder = null;
let recordedAudioChunks = [];
let voiceRecTimer = null;
let voiceRecSeconds = 0;

// Room Database Path Helper
function roomRef(subPath) {
  return ref(db, `rooms/${currentRoomId}/${subPath}`);
}

// Web Audio API Synthesizer
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
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// SHA-256 Trip Generator
async function generateTrip(tripKey) {
  if (!tripKey || tripKey.trim() === '') return '◆(なし)';
  const encoder = new TextEncoder();
  const data = encoder.encode(tripKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '◆' + hashHex.substring(0, 10);
}

// Toast Notifications
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Duplicate Name Check
async function checkDuplicateName(nameToCheck, excludeUserId = null) {
  try {
    const snapshot = await get(roomRef('active_users'));
    if (!snapshot.exists()) return false;
    const users = snapshot.val();
    const targetLower = nameToCheck.trim().toLowerCase();
    for (const uid in users) {
      if (excludeUserId && uid === excludeUserId) continue;
      if (users[uid] && users[uid].name && users[uid].name.trim().toLowerCase() === targetLower) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn("Duplicate check error:", e);
    return false;
  }
}

// App Initialization
function initApp() {
  setupAvatarPickers();
  setupTripInputListeners();
  setupJoinForm();
  setupChatControls();
  setupRoomTabs();
  setupStampsAndMinigames();
  setupTopicModal();
  setupPollModal();
  setupProfileModal();
  setupEditMsgModal();
  setupCustomRoomModal();
  setupImageModal();
  setupVoiceChatAndRec();
  renderIgnoredUsersUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Avatar Grid Selector
function setupAvatarPickers() {
  document.querySelectorAll('#join-avatar-picker .avatar-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#join-avatar-picker .avatar-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      myAvatar = opt.dataset.avatar;
    });
  });

  document.querySelectorAll('#edit-avatar-picker .avatar-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#edit-avatar-picker .avatar-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });
}

function setupTripInputListeners() {
  const joinTripKeyInput = document.getElementById('join-tripkey');
  const joinTripPreview = document.getElementById('trip-preview-code');
  if (joinTripKeyInput) {
    joinTripKeyInput.addEventListener('input', async () => {
      joinTripPreview.textContent = await generateTrip(joinTripKeyInput.value);
    });
  }

  const editTripKeyInput = document.getElementById('edit-tripkey');
  const editTripPreview = document.getElementById('edit-trip-preview-code');
  if (editTripKeyInput) {
    editTripKeyInput.addEventListener('input', async () => {
      editTripPreview.textContent = await generateTrip(editTripKeyInput.value);
    });
  }

  const toggleJoinVis = document.getElementById('toggle-trip-vis');
  if (toggleJoinVis && joinTripKeyInput) {
    toggleJoinVis.addEventListener('click', () => {
      joinTripKeyInput.type = joinTripKeyInput.type === 'password' ? 'text' : 'password';
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
    const inputStatus = document.getElementById('join-status').value;

    if (!inputName) {
      errorMsg.textContent = 'ユーザー名を入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    btnStart.disabled = true;
    btnStart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 接続中...';

    try {
      const isDuplicate = await checkDuplicateName(inputName, myUserId);
      if (isDuplicate) {
        errorMsg.textContent = `「${inputName}」は現在オンラインの他ユーザーが使用しています。別の名前を入力してください。`;
        errorMsg.classList.remove('hidden');
        btnStart.disabled = false;
        btnStart.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> チャットを開始する';
        return;
      }

      myName = inputName;
      myTrip = await generateTrip(inputTripKey);
      myStatus = inputStatus;

      await registerOnlineUser();

      const joinModal = document.getElementById('join-modal');
      if (joinModal) {
        joinModal.classList.remove('active');
        joinModal.classList.add('hidden');
        joinModal.style.display = 'none';
      }
      document.getElementById('app-container').classList.remove('hidden');

      updateMyProfileUI();
      sendSystemMessage(`${myAvatar} ${myName} (${myTrip}) がチャットに参加しました！`);
      initFirebaseRealtimeSync();

    } catch (err) {
      console.error("Join error:", err);
      errorMsg.textContent = `接続エラー: ${err.message || 'Firebaseデータベースにアクセスできませんでした。'}`;
      errorMsg.classList.remove('hidden');
    } finally {
      btnStart.disabled = false;
      btnStart.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> チャットを開始する';
    }
  };

  if (joinForm) joinForm.addEventListener('submit', handleJoinSubmit);
  if (btnStart) btnStart.addEventListener('click', handleJoinSubmit);
}

async function registerOnlineUser() {
  const userRef = roomRef(`active_users/${myUserId}`);
  await set(userRef, {
    name: myName,
    trip: myTrip,
    avatar: myAvatar,
    status: myStatus,
    joinedAt: Date.now()
  });
  onDisconnect(userRef).remove();
}

function updateMyProfileUI() {
  document.getElementById('my-name-display').textContent = myName;
  document.getElementById('my-trip-display').textContent = myTrip;
  document.getElementById('my-avatar').textContent = myAvatar;
  document.getElementById('my-status-display').textContent = myStatus;
}

// Room Switching Logic
function setupRoomTabs() {
  document.querySelectorAll('.room-tab[data-room]').forEach(tab => {
    tab.addEventListener('click', () => {
      switchRoom(tab.dataset.room, tab.textContent);
    });
  });
}

async function switchRoom(newRoomId, roomTitle) {
  if (currentRoomId === newRoomId) return;

  // 旧ルームのオンライン離脱
  await remove(roomRef(`active_users/${myUserId}`));

  currentRoomId = newRoomId;
  document.getElementById('current-room-title').innerHTML = escapeHtml(roomTitle);

  // ルームタブのアクティブ切替
  document.querySelectorAll('.room-tab').forEach(t => {
    if (t.dataset.room === newRoomId) t.classList.add('active');
    else t.classList.remove('active');
  });

  // コンテナ初期化
  const container = document.getElementById('messages-container');
  container.innerHTML = '';
  allMessages.clear();

  // 新ルーム登録 & 同期
  await registerOnlineUser();
  sendSystemMessage(`${myAvatar} ${myName} がこの部屋に入室しました`);
  initFirebaseRealtimeSync();
  showToast(`「${roomTitle.trim()}」に移動しました`);
}

// Realtime Listeners
function initFirebaseRealtimeSync() {
  // 1. オンラインリスト
  onValue(roomRef('active_users'), (snapshot) => {
    const userListEl = document.getElementById('online-user-list');
    const onlineCountEl = document.getElementById('online-count');
    userListEl.innerHTML = '';
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      activeUsersMap.clear();
      const count = Object.keys(users).length;
      onlineCountEl.textContent = `${count}人`;

      Object.entries(users).forEach(([uid, uData]) => {
        activeUsersMap.set(uid, uData);
        if (ignoredUsersSet.has(uid)) return;

        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
          <div class="avatar-sm">${escapeHtml(uData.avatar || '🤖')}</div>
          <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(uData.name)} ${uid === myUserId ? '<span style="font-size:0.75rem; opacity:0.6;">(あなた)</span>' : ''}</div>
            <div class="user-item-status">${escapeHtml(uData.status || '💬 雑談歓迎')}</div>
          </div>
          <button class="btn-secondary btn-sm" onclick="window.startWhisper('${uid}', '${escapeHtml(uData.name)}')" title="内緒話（DM）"><i class="fa-solid fa-lock"></i></button>
          ${uid !== myUserId ? `<button class="btn-mute-user" onclick="window.ignoreUser('${uid}', '${escapeHtml(uData.name)}')" title="無視（ブロック）"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        userListEl.appendChild(li);
      });
    } else {
      onlineCountEl.textContent = '0人';
    }
  });

  // 2. メッセージ同期
  const messagesQuery = query(roomRef('messages'), limitToLast(50));
  const loadingEl = document.getElementById('messages-loading');

  onChildAdded(messagesQuery, (snapshot) => {
    if (loadingEl) loadingEl.style.display = 'none';
    const msgId = snapshot.key;
    const msgData = snapshot.val();
    
    allMessages.set(msgId, { id: msgId, ...msgData });
    renderSingleMessage(msgId, msgData);

    const container = document.getElementById('messages-container');
    if (container && container.children.length > 60) {
      container.removeChild(container.firstChild);
    }

    if (msgData.userId !== myUserId && msgData.type !== 'system' && !ignoredUsersSet.has(msgData.userId)) {
      playSound('receive');
    }
  });

  onChildChanged(roomRef('messages'), (snapshot) => {
    const msgId = snapshot.key;
    const msgData = snapshot.val();
    allMessages.set(msgId, { id: msgId, ...msgData });
    updateMessageUI(msgId, msgData);
  });

  onChildRemoved(roomRef('messages'), (snapshot) => {
    const msgId = snapshot.key;
    allMessages.delete(msgId);
    const node = document.getElementById(`msg-${msgId}`);
    if (node) node.remove();
  });

  // 3. タイピング監視
  onValue(roomRef('typing'), (snapshot) => {
    const indicator = document.getElementById('typing-indicator');
    const textEl = document.getElementById('typing-users-text');
    if (!snapshot.exists()) {
      indicator.classList.add('hidden');
      return;
    }

    const typingUsers = snapshot.val();
    const now = Date.now();
    const names = [];

    Object.entries(typingUsers).forEach(([uid, tData]) => {
      if (uid !== myUserId && tData.name && (now - tData.timestamp < 3500)) {
        names.push(tData.name);
      }
    });

    if (names.length > 0) {
      textEl.textContent = `${names.join('、 ')} がメッセージを入力中...`;
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  });

  // 4. お題・トピック監視
  onValue(roomRef('topic'), (snapshot) => {
    const topicEl = document.getElementById('room-topic-text');
    if (snapshot.exists()) {
      topicEl.textContent = snapshot.val();
    } else {
      topicEl.textContent = 'みんなの好きな食べ物や最近ハマっていることは？';
    }
  });
}

// Render Single Message
function renderSingleMessage(msgId, msg) {
  if (ignoredUsersSet.has(msg.userId)) return;

  // 内緒話（Whisper）フィルタ判定: 自分宛てまたは自分が送信した内緒話のみ表示
  if (msg.whisperTo) {
    if (msg.userId !== myUserId && msg.whisperTo !== myUserId) {
      return; // 他人の内緒話は非表示
    }
  }

  const container = document.getElementById('messages-container');
  const isSelf = msg.userId === myUserId;

  const msgWrapper = document.createElement('div');
  msgWrapper.className = `msg-wrapper ${isSelf ? 'self' : ''} ${msg.type === 'system' ? 'system-msg' : ''}`;
  msgWrapper.id = `msg-${msgId}`;
  msgWrapper.dataset.type = msg.type || 'text';

  if (msg.type === 'system') {
    msgWrapper.innerHTML = `<div class="system-bubble"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(msg.text)}</div>`;
  } else {
    const actionsMenuHtml = `
      <button class="msg-actions-menu-btn" onclick="window.toggleMsgMenu('${msgId}')">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>
      <div id="msg-menu-${msgId}" class="msg-dropdown-menu hidden animate-scale-up">
        ${isSelf && !msg.deleted ? `<button onclick="window.openEditMsgModal('${msgId}')"><i class="fa-solid fa-pen"></i> 編集</button>` : ''}
        ${isSelf && !msg.deleted ? `<button class="danger" onclick="window.deleteMsg('${msgId}')"><i class="fa-solid fa-trash"></i> 削除</button>` : ''}
        ${!isSelf ? `<button onclick="window.startWhisper('${msg.userId}', '${escapeHtml(msg.name)}')"><i class="fa-solid fa-lock"></i> 内緒話</button>` : ''}
        ${!isSelf ? `<button class="danger" onclick="window.ignoreUser('${msg.userId}', '${escapeHtml(msg.name)}')"><i class="fa-solid fa-user-slash"></i> 無視する</button>` : ''}
      </div>
    `;

    const whisperHeader = msg.whisperTo ? `<span style="color:#f472b6; font-weight:700;"><i class="fa-solid fa-lock"></i> 【内緒話】</span>` : '';

    const metaHtml = `
      <div class="msg-meta">
        <span class="msg-avatar-icon">${escapeHtml(msg.avatar || '🤖')}</span>
        <span class="msg-sender-name">${whisperHeader} ${escapeHtml(msg.name)} <span class="trip-badge">${escapeHtml(msg.trip)}</span></span>
        <span class="msg-time">${formatTime(msg.timestamp)} ${msg.edited ? '<span style="font-size:0.7rem; opacity:0.6;">(編集済み)</span>' : ''}</span>
      </div>
    `;

    let contentHtml = '';
    const bubbleClass = `msg-bubble ${msg.whisperTo ? 'whisper' : ''}`;

    if (msg.deleted) {
      contentHtml = `<div class="${bubbleClass}" style="opacity:0.6; font-style:italic;">(このメッセージは削除されました)</div>`;
    } else if (msg.type === 'stamp') {
      contentHtml = `<div class="${bubbleClass}"><div class="stamp-card-img">${escapeHtml(msg.text)}</div></div>`;
    } else if (msg.type === 'game') {
      contentHtml = `<div class="${bubbleClass}"><div class="game-card">${formatMessageText(msg.text)}</div></div>`;
    } else if (msg.type === 'image') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${msg.text ? `<p>${formatMessageText(msg.text)}</p>` : ''}
          <img src="${msg.fileUrl}" class="msg-image" alt="投稿画像" onclick="window.openImageModal('${msg.fileUrl}')">
        </div>
      `;
    } else if (msg.type === 'video') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${msg.text ? `<p>${formatMessageText(msg.text)}</p>` : ''}
          <video src="${msg.fileUrl}" controls class="msg-video"></video>
        </div>
      `;
    } else if (msg.type === 'audio' || msg.type === 'voice') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${msg.type === 'voice' ? '<div style="font-size:0.8rem; font-weight:600; margin-bottom:4px;"><i class="fa-solid fa-microphone text-success"></i> ボイスメッセージ</div>' : ''}
          <audio src="${msg.fileUrl}" controls class="msg-audio"></audio>
        </div>
      `;
    } else if (msg.type === 'file') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${msg.text ? `<p>${formatMessageText(msg.text)}</p>` : ''}
          <div class="msg-file-card">
            <i class="fa-solid fa-file-lines file-icon"></i>
            <div class="file-details">
              <div class="file-name">${escapeHtml(msg.fileName || '添付ファイル')}</div>
              <div class="file-size">${formatFileSize(msg.fileSize || 0)}</div>
            </div>
            <a href="${msg.fileUrl}" download="${escapeHtml(msg.fileName || 'file')}" class="btn-file-download" title="ダウンロード">
              <i class="fa-solid fa-download"></i>
            </a>
          </div>
        </div>
      `;
    } else if (msg.type === 'poll') {
      contentHtml = renderPollCardHtml(msgId, msg.poll);
    } else {
      contentHtml = `<div class="${bubbleClass}">${formatMessageText(msg.text)}</div>`;
    }

    const reactionsHtml = `<div class="msg-reactions" id="reactions-${msgId}">${renderReactionsHtml(msgId, msg.reactions)}</div>`;

    msgWrapper.innerHTML = actionsMenuHtml + metaHtml + contentHtml + reactionsHtml;
  }

  applyFilterAndSearchToNode(msgWrapper, msg);
  container.appendChild(msgWrapper);

  const messagesBox = document.getElementById('chat-messages');
  if (isSelf || isScrolledToBottom) {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  } else {
    unreadMessagesCount++;
    updateScrollBottomButton();
  }
}

function formatMessageText(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  escaped = escaped.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-primary); text-decoration:underline;">${url}</a>`);
  return escaped.replace(/\n/g, '<br>');
}

// Poll & Reactions
function renderPollCardHtml(msgId, pollData) {
  if (!pollData) return '';
  const totalVotes = pollData.votes ? Object.keys(pollData.votes).length : 0;
  const userVoteOption = pollData.votes ? pollData.votes[myUserId] : undefined;

  const optionCounts = (pollData.options || []).map(() => 0);
  if (pollData.votes) {
    Object.values(pollData.votes).forEach(optIdx => {
      if (optionCounts[optIdx] !== undefined) optionCounts[optIdx]++;
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

  html += `
    <button class="reaction-trigger-btn" onclick="window.toggleQuickReactionMenu('${msgId}')" title="リアクション">
      <i class="fa-regular fa-face-smile"></i>
    </button>
  `;
  return html;
}

// Global Actions & Whisper
window.startWhisper = (targetUid, targetName) => {
  if (targetUid === myUserId) return;
  whisperTargetId = targetUid;
  whisperTargetName = targetName;
  document.getElementById('whisper-target-name').textContent = targetName;
  document.getElementById('whisper-banner').classList.remove('hidden');
  document.getElementById('message-text-input').focus();
  showToast(`「${targetName}」さんへ内緒話モードを設定しました`);
};

document.getElementById('btn-cancel-whisper').addEventListener('click', () => {
  whisperTargetId = null;
  whisperTargetName = null;
  document.getElementById('whisper-banner').classList.add('hidden');
});

window.toggleMsgMenu = (msgId) => {
  const menu = document.getElementById(`msg-menu-${msgId}`);
  if (!menu) return;
  document.querySelectorAll('.msg-dropdown-menu').forEach(m => {
    if (m !== menu) m.classList.add('hidden');
  });
  menu.classList.toggle('hidden');

  setTimeout(() => {
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && !e.target.closest('.msg-actions-menu-btn')) {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 50);
};

window.deleteMsg = async (msgId) => {
  if (!confirm('このメッセージを削除しますか？')) return;
  try {
    await update(roomRef(`messages/${msgId}`), {
      deleted: true,
      text: '(このメッセージは削除されました)'
    });
    showToast('メッセージを削除しました');
  } catch (err) {
    showToast('削除に失敗しました', 'error');
  }
};

window.openEditMsgModal = (msgId) => {
  const msg = allMessages.get(msgId);
  if (!msg) return;
  document.getElementById('edit-msg-id').value = msgId;
  document.getElementById('edit-msg-textarea').value = msg.text || '';
  document.getElementById('edit-msg-modal').classList.remove('hidden');
};

function setupEditMsgModal() {
  const modal = document.getElementById('edit-msg-modal');
  const saveBtn = document.getElementById('btn-save-edit-msg');

  document.querySelectorAll('#edit-msg-modal .modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.classList.add('hidden'));
  });

  saveBtn.addEventListener('click', async () => {
    const msgId = document.getElementById('edit-msg-id').value;
    const newText = document.getElementById('edit-msg-textarea').value.trim();
    if (!newText) return;

    try {
      await update(roomRef(`messages/${msgId}`), {
        text: newText,
        edited: true
      });
      modal.classList.add('hidden');
      showToast('メッセージを更新しました', 'success');
    } catch (err) {
      showToast('更新に失敗しました', 'error');
    }
  });
}

window.ignoreUser = (uid, name) => {
  if (!confirm(`「${name}」を無視（ブロック）リストに追加しますか？`)) return;
  ignoredUsersSet.add(uid);
  localStorage.setItem('cyberchat_ignored_users', JSON.stringify(Array.from(ignoredUsersSet)));
  
  allMessages.forEach((msg, mId) => {
    if (msg.userId === uid) {
      const node = document.getElementById(`msg-${mId}`);
      if (node) node.remove();
    }
  });

  renderIgnoredUsersUI();
  showToast(`「${name}」を無視リストに追加しました`);
};

window.unignoreUser = (uid) => {
  ignoredUsersSet.delete(uid);
  localStorage.setItem('cyberchat_ignored_users', JSON.stringify(Array.from(ignoredUsersSet)));
  renderIgnoredUsersUI();
  showToast('無視を解除しました');
};

function renderIgnoredUsersUI() {
  const listEl = document.getElementById('ignored-user-list');
  const countEl = document.getElementById('ignored-count');
  listEl.innerHTML = '';
  countEl.textContent = `${ignoredUsersSet.size}人`;

  ignoredUsersSet.forEach(uid => {
    const uData = activeUsersMap.get(uid) || { name: 'ユーザー ' + uid.substring(0, 6), avatar: '👤' };
    const li = document.createElement('li');
    li.className = 'user-item';
    li.innerHTML = `
      <div class="avatar-sm">${escapeHtml(uData.avatar)}</div>
      <div class="user-item-info">
        <div class="user-item-name">${escapeHtml(uData.name)}</div>
      </div>
      <button class="btn-secondary btn-sm" onclick="window.unignoreUser('${uid}')">解除</button>
    `;
    listEl.appendChild(li);
  });
}

window.votePoll = async (msgId, optionIndex) => {
  try {
    await set(roomRef(`messages/${msgId}/poll/votes/${myUserId}`), optionIndex);
  } catch (err) {
    showToast('投票に失敗しました', 'error');
  }
};

window.toggleReaction = async (msgId, emoji) => {
  try {
    const reactionUserRef = roomRef(`messages/${msgId}/reactions/${emoji}/${myUserId}`);
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

function updateMessageUI(msgId, msgData) {
  const wrapper = document.getElementById(`msg-${msgId}`);
  if (!wrapper) return;
  renderSingleMessage(msgId, msgData);
}

function applyFilterAndSearchToNode(node, msg) {
  let visible = true;
  if (currentFilter === 'image' && (msg.type !== 'image' && msg.type !== 'video')) visible = false;
  if (currentFilter === 'poll' && msg.type !== 'poll') visible = false;
  if (currentFilter === 'file' && (msg.type !== 'file' && msg.type !== 'audio' && msg.type !== 'voice')) visible = false;

  if (searchKeyword && visible) {
    const textToSearch = (msg.text || '') + (msg.name || '') + (msg.fileName || '') + (msg.poll ? msg.poll.question : '');
    if (!textToSearch.toLowerCase().includes(searchKeyword.toLowerCase())) {
      visible = false;
    }
  }

  if (visible) node.classList.remove('hidden');
  else node.classList.add('hidden');
}

function filterAllMessages() {
  allMessages.forEach((msg, msgId) => {
    const node = document.getElementById(`msg-${msgId}`);
    if (node) applyFilterAndSearchToNode(node, msg);
  });
}

// Stamps & Minigames Setup
function setupStampsAndMinigames() {
  const stampBtn = document.getElementById('btn-stamp-toggle');
  const stampPicker = document.getElementById('stamp-picker');

  stampBtn.addEventListener('click', () => stampPicker.classList.toggle('hidden'));

  document.querySelectorAll('.stamp-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stampText = btn.dataset.stamp;
      stampPicker.classList.add('hidden');
      sendSpecialMessage('stamp', stampText);
    });
  });

  // ミニゲーム: 🎲 ダイス
  document.getElementById('btn-game-dice').addEventListener('click', () => {
    const roll = Math.floor(Math.random() * 100) + 1;
    const text = `<i class="fa-solid fa-dice"></i> さいころを振った！ <span class="game-card-val">【出目: ${roll} / 100】</span>`;
    sendSpecialMessage('game', text);
  });

  // ミニゲーム: ⛩️ おみくじ
  document.getElementById('btn-game-omikuji').addEventListener('click', () => {
    const fortunes = [
      '✨ 大吉 ✨ 願望は叶うでしょう！',
      '🌟 中吉 🌟 良いことが起きる予感！',
      '😊 吉 今日は穏やかな一日。',
      '👍 小吉 コツコツ努力が実を結ぶ！',
      '🍀 末吉 幸運のヒントはすぐそばに。'
    ];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    const text = `<i class="fa-solid fa-torii-gate text-success"></i> 今日の運勢おみくじ <span class="game-card-val">${fortune}</span>`;
    sendSpecialMessage('game', text);
  });

  // ミニゲーム: 🪙 コイントス
  document.getElementById('btn-game-coin').addEventListener('click', () => {
    const isHeads = Math.random() < 0.5;
    const text = `<i class="fa-solid fa-coins"></i> コイントス！ <span class="game-card-val">結果: 【${isHeads ? '表 (Heads)' : '裏 (Tails)'}】</span>`;
    sendSpecialMessage('game', text);
  });
}

async function sendSpecialMessage(msgType, text) {
  try {
    const newMsgRef = push(roomRef('messages'));
    const msgObj = {
      userId: myUserId,
      name: myName,
      trip: myTrip,
      avatar: myAvatar,
      type: msgType,
      text: text,
      timestamp: Date.now()
    };
    if (whisperTargetId) {
      msgObj.whisperTo = whisperTargetId;
    }

    await set(newMsgRef, msgObj);
    playSound('send');
  } catch (err) {
    showToast('送信に失敗しました', 'error');
  }
}

// Media & Input Controls
function setupChatControls() {
  const textInput = document.getElementById('message-text-input');
  const btnSend = document.getElementById('btn-send-message');
  const fileInput = document.getElementById('media-file-input');
  const previewBar = document.getElementById('attachment-preview');
  const previewImg = document.getElementById('preview-img');
  const previewIcon = document.getElementById('preview-file-icon');
  const previewName = document.getElementById('preview-filename');
  const previewSize = document.getElementById('preview-filesize');
  const btnRemoveAttachment = document.getElementById('btn-remove-attachment');
  const messagesBox = document.getElementById('chat-messages');

  textInput.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';

    // タイピング状態同期
    sendTypingStatus();
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageHandler();
    }
  });

  btnSend.addEventListener('click', sendMessageHandler);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('ファイルサイズは2MB以下にしてください', 'error');
      fileInput.value = '';
      return;
    }

    selectedFileObject = file;
    previewName.textContent = file.name;
    previewSize.textContent = formatFileSize(file.size);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 450;
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

          selectedFileObject.dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          selectedFileObject.msgType = 'image';

          previewImg.src = selectedFileObject.dataUrl;
          previewImg.classList.remove('hidden');
          previewIcon.classList.add('hidden');
          previewBar.classList.remove('hidden');
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        selectedFileObject.dataUrl = evt.target.result;
        if (file.type.startsWith('video/')) selectedFileObject.msgType = 'video';
        else if (file.type.startsWith('audio/')) selectedFileObject.msgType = 'audio';
        else selectedFileObject.msgType = 'file';

        previewImg.classList.add('hidden');
        previewIcon.classList.remove('hidden');
        previewBar.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  btnRemoveAttachment.addEventListener('click', () => {
    selectedFileObject = null;
    fileInput.value = '';
    previewBar.classList.add('hidden');
  });

  async function sendMessageHandler() {
    const text = textInput.value.trim();
    if (!text && !selectedFileObject) return;

    try {
      const newMsgRef = push(roomRef('messages'));
      const msgObj = {
        userId: myUserId,
        name: myName,
        trip: myTrip,
        avatar: myAvatar,
        type: selectedFileObject ? selectedFileObject.msgType : 'text',
        text: text,
        timestamp: Date.now()
      };

      if (whisperTargetId) {
        msgObj.whisperTo = whisperTargetId;
      }

      if (selectedFileObject) {
        msgObj.fileUrl = selectedFileObject.dataUrl;
        msgObj.fileName = selectedFileObject.name;
        msgObj.fileSize = selectedFileObject.size;
      }

      await set(newMsgRef, msgObj);

      textInput.value = '';
      textInput.style.height = 'auto';
      selectedFileObject = null;
      fileInput.value = '';
      previewBar.classList.add('hidden');

      playSound('send');
    } catch (err) {
      console.error("Send message error:", err);
      showToast('メッセージ送信に失敗しました', 'error');
    }
  }

  messagesBox.addEventListener('scroll', () => {
    isScrolledToBottom = messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight <= 80;
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

  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      filterAllMessages();
    });
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    filterAllMessages();
  });

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

  const sidebar = document.getElementById('sidebar');
  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => sidebar.classList.add('open'));
  document.getElementById('btn-close-sidebar').addEventListener('click', () => sidebar.classList.remove('open'));

  const emojiBtn = document.getElementById('btn-emoji-toggle');
  const emojiPicker = document.getElementById('emoji-picker');
  emojiBtn.addEventListener('click', () => emojiPicker.classList.toggle('hidden'));

  document.querySelectorAll('.emoji-grid span').forEach(span => {
    span.addEventListener('click', () => {
      textInput.value += span.textContent;
      emojiPicker.classList.add('hidden');
      textInput.focus();
    });
  });
}

function sendTypingStatus() {
  set(roomRef(`typing/${myUserId}`), {
    name: myName,
    timestamp: Date.now()
  });

  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    remove(roomRef(`typing/${myUserId}`));
  }, 3000);
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

async function sendSystemMessage(text) {
  try {
    const sysRef = push(roomRef('messages'));
    await set(sysRef, {
      userId: 'system',
      type: 'system',
      text: text,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error("System msg error:", e);
  }
}

// Topic Modal Setup
function setupTopicModal() {
  const modal = document.getElementById('topic-modal');
  const openBtn = document.getElementById('btn-edit-topic');
  const saveBtn = document.getElementById('btn-save-topic');
  const input = document.getElementById('topic-input');

  openBtn.addEventListener('click', () => {
    input.value = document.getElementById('room-topic-text').textContent;
    modal.classList.remove('hidden');
  });

  document.querySelectorAll('#topic-modal .modal-close').forEach(b => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });

  saveBtn.addEventListener('click', async () => {
    const newTopic = input.value.trim();
    if (!newTopic) return;

    try {
      await set(roomRef('topic'), newTopic);
      modal.classList.add('hidden');
      showToast('ルームのお題を更新しました', 'success');
    } catch (e) {
      showToast('お題の更新に失敗しました', 'error');
    }
  });
}

// Custom Room Modal Setup
function setupCustomRoomModal() {
  const modal = document.getElementById('custom-room-modal');
  const openBtn = document.getElementById('btn-custom-room');
  const joinBtn = document.getElementById('btn-join-custom-room');
  const roomInput = document.getElementById('custom-room-name');

  openBtn.addEventListener('click', () => {
    roomInput.value = '';
    modal.classList.remove('hidden');
  });

  document.querySelectorAll('#custom-room-modal .modal-close').forEach(b => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });

  joinBtn.addEventListener('click', () => {
    const keyword = roomInput.value.trim();
    if (!keyword) return;
    const roomId = 'custom_' + keyword.replace(/[^a-zA-Z0-9_-]/g, '_');
    modal.classList.add('hidden');
    switchRoom(roomId, `🔒 部屋: ${keyword}`);
  });
}

// Voice Chat
function setupVoiceChatAndRec() {
  const recBtn = document.getElementById('btn-record-voice');
  const recBar = document.getElementById('voice-rec-preview');
  const recTimeEl = document.getElementById('voice-rec-time');
  const btnCancelRec = document.getElementById('btn-cancel-voice');
  const btnSendRec = document.getElementById('btn-send-voice');

  recBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedAudioChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedAudioChunks.push(e.data);
      };

      mediaRecorder.start();
      recBar.classList.remove('hidden');
      voiceRecSeconds = 0;
      recTimeEl.textContent = '00:00';

      voiceRecTimer = setInterval(() => {
        voiceRecSeconds++;
        const mins = Math.floor(voiceRecSeconds / 60).toString().padStart(2, '0');
        const secs = (voiceRecSeconds % 60).toString().padStart(2, '0');
        recTimeEl.textContent = `${mins}:${secs}`;
      }, 1000);

    } catch (err) {
      showToast('マイクの使用許可が必要です', 'error');
    }
  });

  btnCancelRec.addEventListener('click', () => stopRecording(false));
  btnSendRec.addEventListener('click', () => stopRecording(true));

  function stopRecording(send = false) {
    if (voiceRecTimer) clearInterval(voiceRecTimer);
    recBar.classList.add('hidden');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = async () => {
        if (send && recordedAudioChunks.length > 0) {
          const audioBlob = new Blob(recordedAudioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = async (evt) => {
            const dataUrl = evt.target.result;
            const newMsgRef = push(roomRef('messages'));
            const msgObj = {
              userId: myUserId,
              name: myName,
              trip: myTrip,
              avatar: myAvatar,
              type: 'voice',
              fileUrl: dataUrl,
              timestamp: Date.now()
            };
            if (whisperTargetId) msgObj.whisperTo = whisperTargetId;

            await set(newMsgRef, msgObj);
            playSound('send');
          };
          reader.readAsDataURL(audioBlob);
        }
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.stop();
    }
  }

  const btnVcToggle = document.getElementById('btn-toggle-vc');
  const btnMicToggle = document.getElementById('btn-toggle-mic');

  btnVcToggle.addEventListener('click', async () => {
    if (!isVoiceRoomJoined) {
      try {
        localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isVoiceRoomJoined = true;
        isMicMuted = false;

        btnVcToggle.classList.add('joined');
        btnVcToggle.innerHTML = '<i class="fa-solid fa-phone-slash"></i> <span>退出</span>';
        btnMicToggle.classList.remove('hidden');
        document.getElementById('vc-section').classList.remove('hidden');

        const vcUserRef = roomRef(`voice_room/${myUserId}`);
        await set(vcUserRef, {
          name: myName,
          avatar: myAvatar,
          muted: false,
          joinedAt: Date.now()
        });
        onDisconnect(vcUserRef).remove();

        showToast('ボイスチャットに参加しました', 'success');
      } catch (err) {
        showToast('マイクへのアクセスに失敗しました', 'error');
      }
    } else {
      isVoiceRoomJoined = false;
      if (localAudioStream) {
        localAudioStream.getTracks().forEach(track => track.stop());
        localAudioStream = null;
      }

      btnVcToggle.classList.remove('joined');
      btnVcToggle.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>ボイスチャット</span>';
      btnMicToggle.classList.add('hidden');
      document.getElementById('vc-section').classList.add('hidden');

      await remove(roomRef(`voice_room/${myUserId}`));
      showToast('ボイスチャットから退出しました');
    }
  });

  btnMicToggle.addEventListener('click', async () => {
    if (!localAudioStream) return;
    isMicMuted = !isMicMuted;
    localAudioStream.getAudioTracks().forEach(track => track.enabled = !isMicMuted);
    btnMicToggle.innerHTML = isMicMuted ? '<i class="fa-solid fa-microphone-slash" style="color:var(--danger-color)"></i>' : '<i class="fa-solid fa-microphone"></i>';
    
    await update(roomRef(`voice_room/${myUserId}`), { muted: isMicMuted });
    showToast(`マイクを ${isMicMuted ? 'ミュート' : '解除'} にしました`);
  });

  onValue(roomRef('voice_room'), (snapshot) => {
    const vcListEl = document.getElementById('vc-user-list');
    const vcCountEl = document.getElementById('vc-count');
    if (!vcListEl) return;
    vcListEl.innerHTML = '';

    if (snapshot.exists()) {
      const users = snapshot.val();
      vcCountEl.textContent = `${Object.keys(users).length}人`;
      Object.entries(users).forEach(([uid, uData]) => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
          <div class="avatar-sm">${escapeHtml(uData.avatar || '🤖')}</div>
          <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(uData.name)}</div>
          </div>
          <i class="fa-solid ${uData.muted ? 'fa-microphone-slash style="color:var(--danger-color)"' : 'fa-microphone text-success'}"></i>
        `;
        vcListEl.appendChild(li);
      });
    } else {
      vcCountEl.textContent = '0人';
    }
  });
}

function setupPollModal() {
  const modal = document.getElementById('poll-modal');
  const openBtn = document.getElementById('btn-open-create-poll');
  const addOptBtn = document.getElementById('btn-add-poll-opt');
  const optionsContainer = document.getElementById('poll-options-container');
  const submitBtn = document.getElementById('btn-submit-poll');
  const errorMsg = document.getElementById('poll-error-msg');

  openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  document.querySelectorAll('#poll-modal .modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.classList.add('hidden'));
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

    if (!question || options.length < 2) {
      errorMsg.textContent = '質問と少なくとも2つの選択肢を入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    try {
      const newMsgRef = push(roomRef('messages'));
      const msgObj = {
        userId: myUserId,
        name: myName,
        trip: myTrip,
        avatar: myAvatar,
        type: 'poll',
        poll: { question: question, options: options, votes: {} },
        timestamp: Date.now()
      };
      if (whisperTargetId) msgObj.whisperTo = whisperTargetId;

      await set(newMsgRef, msgObj);
      modal.classList.add('hidden');
      showToast('アンケートを投稿しました', 'success');
      playSound('send');
    } catch (err) {
      errorMsg.textContent = 'アンケートの投稿に失敗しました。';
      errorMsg.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function setupProfileModal() {
  const modal = document.getElementById('profile-modal');
  const openBtn = document.getElementById('btn-open-edit-profile');
  const saveBtn = document.getElementById('btn-save-profile');
  const usernameInput = document.getElementById('edit-username');
  const statusInput = document.getElementById('edit-status');
  const tripkeyInput = document.getElementById('edit-tripkey');
  const errorMsg = document.getElementById('edit-profile-error');

  openBtn.addEventListener('click', () => {
    usernameInput.value = myName;
    statusInput.value = myStatus;
    tripkeyInput.value = '';
    document.getElementById('edit-trip-preview-code').textContent = myTrip;
    errorMsg.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  document.querySelectorAll('#profile-modal .modal-close').forEach(btn => {
    btn.addEventListener('click', () => modal.classList.add('hidden'));
  });

  saveBtn.addEventListener('click', async () => {
    errorMsg.classList.add('hidden');
    const newName = usernameInput.value.trim();
    const newStatus = statusInput.value;
    const newTripKey = tripkeyInput.value;

    if (!newName) {
      errorMsg.textContent = 'ユーザー名を入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    try {
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
      myName = newName;
      myStatus = newStatus;
      if (newTripKey) myTrip = await generateTrip(newTripKey);

      await registerOnlineUser();
      updateMyProfileUI();
      modal.classList.add('hidden');

      sendSystemMessage(`${oldName} がプロフィールを更新しました`);
      showToast('プロフィールを変更しました', 'success');
    } catch (err) {
      errorMsg.textContent = '変更の保存に失敗しました。';
      errorMsg.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

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
