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

let friendsMap = new Map();
let friendRequestsMap = new Map();
let unsubscribeFriendRequests = null;
let unsubscribeFriends = null;

let deviceMode = localStorage.getItem('cyberchat_device_mode') || 'pc';
let currentTheme = localStorage.getItem('cyberchat_theme') || 'cyber';
let isAdminMode = false;
const ADMIN_PASSWORD = "Unei-Senyou-Password-hatosabure371";

let soundEnabled = true;
let isScrolledToBottom = true;
let unreadMessagesCount = 0;
let selectedFileObject = null;
let currentFilter = 'all';
let searchKeyword = '';
let allMessages = new Map();
let activeUsersMap = new Map();
let bannedUsersMap = new Map();
let ignoredUsersSet = new Set(JSON.parse(localStorage.getItem('cyberchat_ignored_users') || '[]'));
let starredMsgSet = new Set(JSON.parse(localStorage.getItem('cyberchat_starred_msgs') || '[]'));

// Active Quiz State
let activeMathQuizAnswer = null;

// Heartbeat & Typing Timer Handles
let heartbeatTimer = null;
let typingTimer = null;

// Screen Sharing State
let isScreenSharing = false;
let screenStream = null;
let screenFrameInterval = null;

// Sending Locks
let isSending = false;
let isSendingSpecial = false;

// Firebase Listener Handles
let unsubscribeActiveUsers = null;
let unsubscribeMessages = null;
let unsubscribeTyping = null;
let unsubscribeTopic = null;
let unsubscribeSignals = null;
let unsubscribeScreen = null;

// Whisper & Reply State
let whisperTargetId = null;
let whisperTargetName = null;
let replyTargetId = null;
let replyTargetName = null;
let replyTargetText = null;

// Voice Chat & WebRTC Peer Connections
let isVoiceRoomJoined = false;
let isMicMuted = false;
let localAudioStream = null;
let mediaRecorder = null;
let recordedAudioChunks = [];
let voiceRecTimer = null;
let voiceRecSeconds = 0;
let peerConnections = new Map();

// Ambient BGM State
let bgmAudioCtx = null;
let bgmOsc = null;
let bgmGain = null;
let isBgmPlaying = false;

// Canvas Paint Board State
let isPainting = false;

// Database Path Helpers
function roomRef(subPath) {
  return ref(db, `rooms/${currentRoomId}/${subPath}`);
}

function globalRef(subPath) {
  return ref(db, subPath);
}

// Web Audio API Synthesizer (SE & Soundboard)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (!soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
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

// Soundboard Effects
window.playSfx = (sfxType) => {
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;

    if (sfxType === 'applause' || sfxType === 'laugh') {
      const bufferSize = audioCtx.sampleRate * 0.8;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = sfxType === 'applause' ? 1000 : 500;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start(now);
    } else if (sfxType === 'fanfare') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.4);
      });
    } else if (sfxType === 'chime') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (sfxType === 'boom') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (sfxType === 'horn') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    sendSpecialMessage('game', `📢 効果音【${sfxType}】を再生しました！`);
  } catch (e) {
    console.warn("SFX error:", e);
  }
};

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

// 50 Icon Choices Array (Categorized)
const AVATAR_PRESETS_50 = [
  // SF & Cyber (10)
  { icon: '🤖', cat: 'cyber' }, { icon: '💻', cat: 'cyber' }, { icon: '🛸', cat: 'cyber' },
  { icon: '🚀', cat: 'cyber' }, { icon: '⚡', cat: 'cyber' }, { icon: '🛰️', cat: 'cyber' },
  { icon: '👾', cat: 'cyber' }, { icon: '🕹️', cat: 'cyber' }, { icon: '🦾', cat: 'cyber' },
  { icon: '🔮', cat: 'cyber' },

  // Werewolf & Fantasy (10)
  { icon: '🐺', cat: 'werewolf' }, { icon: '🧙‍♂️', cat: 'werewolf' }, { icon: '🛡️', cat: 'werewolf' },
  { icon: '⚔️', cat: 'werewolf' }, { icon: '🌙', cat: 'werewolf' }, { icon: '📜', cat: 'werewolf' },
  { icon: '🏹', cat: 'werewolf' }, { icon: '👑', cat: 'werewolf' }, { icon: '🏰', cat: 'werewolf' },
  { icon: '🕯️', cat: 'werewolf' },

  // Animals & Monsters (10)
  { icon: '🐱', cat: 'animal' }, { icon: '🦊', cat: 'animal' }, { icon: '🦁', cat: 'animal' },
  { icon: '🐯', cat: 'animal' }, { icon: '🐲', cat: 'animal' }, { icon: '🐻', cat: 'animal' },
  { icon: '🦉', cat: 'animal' }, { icon: '🦅', cat: 'animal' }, { icon: '🦄', cat: 'animal' },
  { icon: '🐼', cat: 'animal' },

  // Faces & Emotes (10)
  { icon: '😎', cat: 'face' }, { icon: '🤠', cat: 'face' }, { icon: '🥷', cat: 'face' },
  { icon: '🤡', cat: 'face' }, { icon: '👻', cat: 'face' }, { icon: '💀', cat: 'face' },
  { icon: '🎃', cat: 'face' }, { icon: '👽', cat: 'face' }, { icon: '👺', cat: 'face' },
  { icon: '🌸', cat: 'face' },

  // Hobbies & Items (10)
  { icon: '🎮', cat: 'hobby' }, { icon: '🎨', cat: 'hobby' }, { icon: '🎵', cat: 'hobby' },
  { icon: '💎', cat: 'hobby' }, { icon: '⚽', cat: 'hobby' }, { icon: '🍕', cat: 'hobby' },
  { icon: '☕', cat: 'hobby' }, { icon: '🌟', cat: 'hobby' }, { icon: '🔥', cat: 'hobby' },
  { icon: '🌈', cat: 'hobby' }
];

function renderAvatarHTML(avatar, customClass = '') {
  if (!avatar) return `<span class="${customClass}">🤖</span>`;
  if (avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return `<img src="${escapeHtml(avatar)}" class="avatar-img-obj ${customClass}" alt="avatar">`;
  }
  return `<span class="${customClass}">${escapeHtml(avatar)}</span>`;
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

// Insert Snippet Shortcut
window.insertSnippet = (text) => {
  const textInput = document.getElementById('message-text-input');
  if (textInput) {
    textInput.value += (textInput.value ? ' ' : '') + text;
    textInput.focus();
  }
};

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

// Device Mode Manager
function setDeviceMode(mode) {
  deviceMode = mode;
  localStorage.setItem('cyberchat_device_mode', mode);

  document.body.classList.remove('device-pc', 'device-mobile');
  document.body.classList.add(`device-${mode}`);

  document.querySelectorAll('.device-btn').forEach(btn => {
    if (btn.dataset.mode === mode) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  const toggleBtn = document.getElementById('btn-toggle-device-mode');
  if (toggleBtn) {
    toggleBtn.innerHTML = mode === 'mobile' ? '<i class="fa-solid fa-mobile-screen-button text-primary"></i>' : '<i class="fa-solid fa-desktop"></i>';
    toggleBtn.title = `現在の表示: ${mode === 'mobile' ? 'スマホモード' : 'PCモード'} (クリックで切り替え)`;
  }
}

function setupDeviceModeSelectors() {
  document.querySelectorAll('.device-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => setDeviceMode(btn.dataset.mode));
  });

  const toggleBtn = document.getElementById('btn-toggle-device-mode');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const nextMode = deviceMode === 'pc' ? 'mobile' : 'pc';
      setDeviceMode(nextMode);
      showToast(`「${nextMode === 'mobile' ? '📱 スマホ表示モード' : '💻 PC表示モード'}」に切り替えました`);
    });
  }

  setDeviceMode(deviceMode);
}

// Theme Picker Setup
function setupThemePicker() {
  const toggleBtn = document.getElementById('btn-theme-picker-toggle');
  const popup = document.getElementById('theme-picker-popup');

  if (toggleBtn && popup) {
    toggleBtn.addEventListener('click', () => {
      popup.classList.toggle('hidden');
    });

    document.querySelectorAll('.theme-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeName = btn.dataset.themeName;
        applyTheme(themeName);
        popup.classList.add('hidden');
      });
    });

    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !toggleBtn.contains(e.target)) {
          popup.classList.add('hidden');
        }
      });
    }, 100);
  }

  applyTheme(currentTheme);
}

function applyTheme(themeName) {
  currentTheme = themeName;
  localStorage.setItem('cyberchat_theme', themeName);

  if (themeName === 'cyber') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', themeName);
  }

  document.querySelectorAll('.theme-opt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeName === themeName);
  });
}

// App Initialization
function initApp() {
  setupDeviceModeSelectors();
  setupThemePicker();
  setupAvatarPickers();
  setupTripInputListeners();
  setupAuthForms();
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
  setupBgmPlayer();
  setupScreenShare();
  setupPaintModal();
  setupReplyBanner();
  setupAdminSystem();
  setupAiBotControls();
  setupWerewolfGameControls();
  setupFriendModalControls();
  setupMobileNavigation();
  renderIgnoredUsersUI();
  initBanCheckListener();
  setupPresenceConnectionHeartbeat();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// 🟢 部屋にいるのに消える・オフラインなのに残るバグ修正 Presence & Heartbeat Handler
function setupPresenceConnectionHeartbeat() {
  const connectedRef = ref(db, '.info/connected');
  onValue(connectedRef, (snap) => {
    if (snap.val() === true && myName) {
      registerOnlineUser();
    }
  });

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (myName && myUserId) {
      update(roomRef(`active_users/${myUserId}`), { lastSeen: Date.now() });
    }
  }, 8000);

  const cleanUpPresence = () => {
    if (myUserId) {
      remove(roomRef(`active_users/${myUserId}`));
    }
  };

  window.addEventListener('beforeunload', cleanUpPresence);
  window.addEventListener('pagehide', cleanUpPresence);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && myName) {
      registerOnlineUser();
    }
  });
}

// 🚫 リアルタイムBAN判定リスナー（IDおよびアカウント名チェック）
function initBanCheckListener() {
  onValue(globalRef(`banned_users/${myUserId}`), (snapshot) => {
    if (snapshot.exists()) {
      alert("⚠️ あなたのアカウントは運営によってBAN（アクセス禁止）されました。");
      localStorage.clear();
      location.reload();
    }
  });

  onValue(globalRef('banned_users'), (snapshot) => {
    bannedUsersMap.clear();
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.entries(data).forEach(([key, val]) => {
        bannedUsersMap.set(key, val);
        if (val && val.name && myName && val.name.trim().toLowerCase() === myName.trim().toLowerCase()) {
          alert("⚠️ お使いのユーザー名・アカウントは運営によって永久BANされました。");
          localStorage.clear();
          location.reload();
        }
      });
    }
    renderAdminBannedUsersUI();
  });
}

// 👑 運営管理システム
function setupAdminSystem() {
  const openAuthBtn = document.getElementById('btn-open-admin-auth');
  const authModal = document.getElementById('admin-auth-modal');
  const passInput = document.getElementById('admin-password-input');
  const authSubmitBtn = document.getElementById('btn-submit-admin-auth');
  const authError = document.getElementById('admin-auth-error');
  const togglePassVis = document.getElementById('toggle-admin-pass-vis');

  const panelModal = document.getElementById('admin-panel-modal');

  openAuthBtn.addEventListener('click', () => {
    if (isAdminMode) {
      openAdminPanel();
    } else {
      passInput.value = '';
      authError.classList.add('hidden');
      authModal.classList.remove('hidden');
      passInput.focus();
    }
  });

  document.querySelectorAll('#admin-auth-modal .modal-close').forEach(b => {
    b.addEventListener('click', () => authModal.classList.add('hidden'));
  });

  document.querySelectorAll('#admin-panel-modal .modal-close').forEach(b => {
    b.addEventListener('click', () => panelModal.classList.add('hidden'));
  });

  if (togglePassVis) {
    togglePassVis.addEventListener('click', () => {
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    });
  }

  const handleAuthSubmit = () => {
    authError.classList.add('hidden');
    const inputPass = passInput.value.trim();

    if (inputPass === ADMIN_PASSWORD) {
      isAdminMode = true;
      authModal.classList.add('hidden');
      openAuthBtn.classList.add('active');
      openAuthBtn.innerHTML = '<i class="fa-solid fa-crown text-warning"></i> <span>運営（認証済み）</span>';
      showToast('👑 運営認証に成功しました！管理コントロールパネルを開きます。', 'success');
      openAdminPanel();
    } else {
      authError.textContent = 'パスワードが正しくありません。';
      authError.classList.remove('hidden');
    }
  };

  authSubmitBtn.addEventListener('click', handleAuthSubmit);
  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  document.getElementById('btn-admin-clear-messages').addEventListener('click', async () => {
    if (!confirm('【警告】このルームの全メッセージを消去します。よろしいですか？')) return;
    try {
      await remove(roomRef('messages'));
      sendSystemMessage('⚠️ 運営によって部屋のすべてのメッセージが消去されました');
      showToast('発言を全消去しました', 'success');
    } catch (e) {
      showToast('消去に失敗しました', 'error');
    }
  });

  document.getElementById('btn-admin-clear-topic').addEventListener('click', async () => {
    try {
      await remove(roomRef('topic'));
      showToast('お題をリセットしました', 'success');
    } catch (e) {
      showToast('リセット失敗', 'error');
    }
  });

  document.getElementById('btn-admin-toggle-crown').addEventListener('click', async () => {
    myAvatar = myAvatar.includes('👑') ? '🤖' : '👑 運営';
    await registerOnlineUser();
    updateMyProfileUI();
    showToast(`アバターマークを変更しました (${myAvatar})`);
  });

  document.getElementById('btn-admin-send-announce').addEventListener('click', async () => {
    const input = document.getElementById('admin-announce-input');
    const text = input.value.trim();
    if (!text) return;

    await sendSpecialMessage('game', `📢 【運営公式アナウンス】\n${text}`);
    input.value = '';
    showToast('全体アナウンスを放送しました！', 'success');
  });

  // 🔑 Admin AI API Key Management (Unlock with "hatosabure-Unei-API-key")
  const API_UNLOCK_PASSWORD = "hatosabure-Unei-API-key";
  const btnUnlockApi = document.getElementById('btn-unlock-admin-api');
  const passUnlockInput = document.getElementById('admin-api-unlock-pass');
  const unlockMsg = document.getElementById('admin-api-unlock-msg');
  const keyEditBox = document.getElementById('admin-api-key-edit-box');
  const adminAiKeyInput = document.getElementById('admin-ai-key-input');
  const btnSaveAdminAiKey = document.getElementById('btn-save-admin-ai-key');
  const toggleAdminAiKeyVis = document.getElementById('toggle-admin-ai-key-vis');

  if (toggleAdminAiKeyVis && adminAiKeyInput) {
    toggleAdminAiKeyVis.addEventListener('click', () => {
      adminAiKeyInput.type = adminAiKeyInput.type === 'password' ? 'text' : 'password';
    });
  }

  if (btnUnlockApi && passUnlockInput) {
    btnUnlockApi.addEventListener('click', () => {
      unlockMsg.classList.add('hidden');
      const inputPass = passUnlockInput.value.trim();

      if (inputPass === API_UNLOCK_PASSWORD) {
        keyEditBox.classList.remove('hidden');
        if (adminAiKeyInput) adminAiKeyInput.value = getAiApiKey();
        showToast('🔑 APIキー編集のロックを解除しました！', 'success');
      } else {
        unlockMsg.textContent = 'ロック解除パスワードが正しくありません。(hatosabure-Unei-API-key を入力してください)';
        unlockMsg.classList.remove('hidden');
      }
    });
  }

  if (btnSaveAdminAiKey && adminAiKeyInput) {
    btnSaveAdminAiKey.addEventListener('click', () => {
      const newKey = adminAiKeyInput.value.trim();
      localStorage.setItem('cyberchat_ai_key', newKey);
      showToast('💾 AI APIキーを保存しました！', 'success');
    });
  }

  // 🎯 手動ユーザー名指定BAN
  const btnManualBan = document.getElementById('btn-admin-manual-ban');
  const manualBanInput = document.getElementById('admin-manual-ban-name-input');
  if (btnManualBan && manualBanInput) {
    btnManualBan.addEventListener('click', async () => {
      const targetName = manualBanInput.value.trim();
      if (!targetName) {
        showToast('BAN対象のユーザー名を入力してください', 'error');
        return;
      }
      if (!confirm(`【警告】ユーザー名「${targetName}」を永久BAN（アクセス拒否）しますか？`)) return;

      await window.adminBanByName(targetName);
      manualBanInput.value = '';
    });
  }
}

function openAdminPanel() {
  renderAdminUsersTable();
  renderAdminBannedUsersUI();
  document.getElementById('admin-panel-modal').classList.remove('hidden');
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-user-tbody');
  tbody.innerHTML = '';

  activeUsersMap.forEach((uData, uid) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${renderAvatarHTML(uData.avatar || '🤖')} ${escapeHtml(uData.name || '')} ${uid === myUserId ? '<strong>(あなた)</strong>' : ''}</td>
      <td><span class="trip-badge">${escapeHtml(uData.trip || '')}</span></td>
      <td><code>${uid.substring(0, 8)}...</code></td>
      <td>
        ${uid !== myUserId ? `
          <button class="btn-secondary btn-sm danger" onclick="window.adminBanUser('${uid}', '${escapeHtml(uData.name)}')"><i class="fa-solid fa-ban"></i> BAN・追放</button>
        ` : '<span style="opacity:0.5;">-</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminBannedUsersUI() {
  const ul = document.getElementById('admin-banned-list');
  if (!ul) return;
  ul.innerHTML = '';

  if (bannedUsersMap.size === 0) {
    ul.innerHTML = '<li style="color:var(--text-muted); font-size:0.8rem;">現在BANされたユーザーはいません</li>';
    return;
  }

  bannedUsersMap.forEach((bData, uid) => {
    const li = document.createElement('li');
    li.className = 'admin-banned-item';
    li.innerHTML = `
      <span>🚫 <strong>${escapeHtml(bData.name || '不明')}</strong> (ID: ${uid.substring(0, 10)}) - ${formatTime(bData.timestamp)}</span>
      <button class="btn-secondary btn-sm" onclick="window.adminUnbanUser('${uid}', '${escapeHtml(bData.name)}')">BAN解除</button>
    `;
    ul.appendChild(li);
  });
}

window.adminBanUser = async (uid, name) => {
  if (!confirm(`【確認】「${name}」をBAN（アクセス禁止）にしますか？`)) return;
  try {
    await set(globalRef(`banned_users/${uid}`), {
      name: name,
      timestamp: Date.now()
    });
    const key = sanitizeAccountKey(name);
    if (key) {
      await set(globalRef(`banned_users/name_${key}`), {
        name: name,
        timestamp: Date.now()
      });
    }

    await remove(roomRef(`active_users/${uid}`));
    sendSystemMessage(`🚫 運営によって ${name} がBAN（アクセス禁止）処理されました`);
    showToast(`「${name}」をBANしました`, 'success');
    renderAdminUsersTable();
  } catch (e) {
    showToast('BAN処理に失敗しました', 'error');
  }
};

window.adminBanByName = async (name) => {
  try {
    const key = sanitizeAccountKey(name);
    let targetUid = null;

    activeUsersMap.forEach((uData, uid) => {
      if (uData.name && uData.name.trim().toLowerCase() === name.trim().toLowerCase()) {
        targetUid = uid;
      }
    });

    if (targetUid) {
      await set(globalRef(`banned_users/${targetUid}`), {
        name: name,
        timestamp: Date.now()
      });
      await remove(roomRef(`active_users/${targetUid}`));
    }

    await set(globalRef(`banned_users/name_${key}`), {
      name: name,
      timestamp: Date.now()
    });

    sendSystemMessage(`🚫 運営によって ユーザー名「${name}」が永久BAN（アクセス禁止）処理されました`);
    showToast(`「${name}」を永久BANリストに追加しました！`, 'success');
    renderAdminUsersTable();
    renderAdminBannedUsersUI();
  } catch (e) {
    console.error("Manual BAN error:", e);
    showToast('BAN処理に失敗しました', 'error');
  }
};

window.adminUnbanUser = async (uid, name) => {
  try {
    await remove(globalRef(`banned_users/${uid}`));
    const key = sanitizeAccountKey(name);
    if (key) {
      await remove(globalRef(`banned_users/name_${key}`));
    }
    showToast(`「${name}」のBANを解除しました`, 'success');
    renderAdminBannedUsersUI();
  } catch (e) {
    showToast('解除失敗', 'error');
  }
};

// Password Hashing and Key Sanitization
async function hashPassword(passStr) {
  const encoder = new TextEncoder();
  const data = encoder.encode(passStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeAccountKey(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[^a-z0-9_a-zA-Z0-9ぁ-んァ-ン一-龥]/g, '_');
}

// 🔑 Account Authentication System (Login & Signup)
function setupAuthForms() {
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.add('active');
      loginForm.classList.remove('hidden');
      regForm.classList.remove('active');
      regForm.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      regForm.classList.add('active');
      regForm.classList.remove('hidden');
      loginForm.classList.remove('active');
      loginForm.classList.add('hidden');
    });
  }

  const toggleVis = (btnId, inputId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input) {
      btn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }
  };
  toggleVis('toggle-login-pass-vis', 'login-password');
  toggleVis('toggle-reg-pass-vis', 'reg-password');

  // Handle Login Submission
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    const errorMsg = document.getElementById('login-error-msg');
    errorMsg.classList.add('hidden');

    const accName = document.getElementById('login-account-name').value.trim();
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-submit-login');

    if (!accName || !pass) {
      errorMsg.textContent = 'アカウント名とパスワードを入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ログイン中...';

    try {
      const key = sanitizeAccountKey(accName);
      const nameBanSnap = await get(globalRef(`banned_users/name_${key}`));
      if (nameBanSnap.exists()) {
        errorMsg.textContent = '⚠️ このアカウント・ユーザー名は運営によって永久BANされています。アクセスできません。';
        errorMsg.classList.remove('hidden');
        return;
      }

      const passHash = await hashPassword(pass);

      const snap = await get(globalRef(`accounts/${key}`));
      if (!snap.exists()) {
        errorMsg.textContent = 'アカウントが見つかりません。アカウント名を確認するか、新規登録を行ってください。';
        errorMsg.classList.remove('hidden');
        return;
      }

      const accData = snap.val();
      if (accData.passwordHash !== passHash) {
        errorMsg.textContent = 'パスワードが正しくありません。';
        errorMsg.classList.remove('hidden');
        return;
      }

      myUserId = accData.userId || ('usr_' + Math.random().toString(36).substring(2, 10));
      myName = accData.username || accName;
      myAvatar = accData.avatar || '🤖';
      myStatus = accData.status || '💬 雑談歓迎';
      myTrip = await generateTrip(accName);

      localStorage.setItem('cyberchat_user_id', myUserId);
      localStorage.setItem('cyberchat_account_key', key);
      localStorage.setItem('cyberchat_account_name', myName);

      await completeUserLogin();
      showToast(`ログイン成功！おかえりなさい、${myName} さん！`, 'success');

    } catch (err) {
      console.error("Login error:", err);
      errorMsg.textContent = `ログイン処理エラー: ${err.message}`;
      errorMsg.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> ログインする';
    }
  };

  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  // Handle Registration Submission
  const handleRegSubmit = async (e) => {
    if (e) e.preventDefault();
    const errorMsg = document.getElementById('reg-error-msg');
    errorMsg.classList.add('hidden');

    const accName = document.getElementById('reg-account-name').value.trim();
    const pass = document.getElementById('reg-password').value;
    const passConf = document.getElementById('reg-password-confirm').value;
    const status = document.getElementById('reg-status').value;
    const btn = document.getElementById('btn-submit-register');

    if (!accName || accName.length < 3) {
      errorMsg.textContent = 'アカウント名は3文字以上で入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    if (!pass || pass.length < 4) {
      errorMsg.textContent = 'パスワードは4文字以上で入力してください。';
      errorMsg.classList.remove('hidden');
      return;
    }

    if (pass !== passConf) {
      errorMsg.textContent = 'パスワードと確認用パスワードが一致しません。';
      errorMsg.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 登録処理中...';

    try {
      const key = sanitizeAccountKey(accName);
      const nameBanSnap = await get(globalRef(`banned_users/name_${key}`));
      if (nameBanSnap.exists()) {
        errorMsg.textContent = '⚠️ このユーザー名は運営によって禁止されています。別の名前を指定してください。';
        errorMsg.classList.remove('hidden');
        return;
      }

      const snap = await get(globalRef(`accounts/${key}`));
      if (snap.exists()) {
        errorMsg.textContent = `「${accName}」は既に登録されています。別の名前を指定するかログインしてください。`;
        errorMsg.classList.remove('hidden');
        return;
      }

      const passHash = await hashPassword(pass);
      myUserId = 'usr_' + Math.random().toString(36).substring(2, 10);
      myName = accName;
      myStatus = status;
      myTrip = await generateTrip(accName);

      await set(globalRef(`accounts/${key}`), {
        userId: myUserId,
        username: myName,
        accountKey: key,
        passwordHash: passHash,
        avatar: myAvatar,
        status: myStatus,
        createdAt: Date.now()
      });

      localStorage.setItem('cyberchat_user_id', myUserId);
      localStorage.setItem('cyberchat_account_key', key);
      localStorage.setItem('cyberchat_account_name', myName);

      await completeUserLogin();
      showToast(`新規会員登録完了！ようこそ ${myName} さん！`, 'success');

    } catch (err) {
      console.error("Register error:", err);
      errorMsg.textContent = `登録処理エラー: ${err.message}`;
      errorMsg.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-check"></i> 新規登録して始める';
    }
  };

  if (regForm) regForm.addEventListener('submit', handleRegSubmit);

  const logoutBtn = document.getElementById('btn-logout-account');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!confirm('ログアウトしますか？')) return;
      localStorage.removeItem('cyberchat_account_key');
      localStorage.removeItem('cyberchat_account_name');
      await remove(roomRef(`active_users/${myUserId}`));
      location.reload();
    });
  }

  checkSavedSession();
}

async function checkSavedSession() {
  const savedKey = localStorage.getItem('cyberchat_account_key');
  if (savedKey) {
    try {
      const snap = await get(globalRef(`accounts/${savedKey}`));
      if (snap.exists()) {
        const accData = snap.val();
        myUserId = accData.userId || localStorage.getItem('cyberchat_user_id');
        myName = accData.username;
        myAvatar = accData.avatar || '🤖';
        myStatus = accData.status || '💬 雑談歓迎';
        myTrip = await generateTrip(myName);

        await completeUserLogin();
        return;
      }
    } catch (e) {
      console.warn("Session restore error:", e);
    }
  }

  const authModal = document.getElementById('auth-modal');
  if (authModal) authModal.classList.add('active');
}

async function completeUserLogin() {
  await registerOnlineUser();

  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.classList.remove('active');
    authModal.classList.add('hidden');
  }

  document.getElementById('app-container').classList.remove('hidden');
  updateMyProfileUI();
  initFirebaseRealtimeSync();
  initFriendListeners();
}

// Avatar Grid Selector & Custom Image Uploader
function setupAvatarPickers() {
  const joinGrid = document.getElementById('join-avatar-picker');
  const regGrid = document.getElementById('reg-avatar-picker');
  const editGrid = document.getElementById('edit-avatar-picker');

  // Populate 50 icons in grids
  const populateGrid = (gridEl, pickerType) => {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    AVATAR_PRESETS_50.forEach((item, idx) => {
      const opt = document.createElement('span');
      opt.className = `avatar-opt ${idx === 0 ? 'active' : ''}`;
      opt.dataset.avatar = item.icon;
      opt.dataset.cat = item.cat;
      opt.textContent = item.icon;

      opt.addEventListener('click', () => {
        gridEl.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        myAvatar = item.icon;
        updateMyProfileUI();
      });
      gridEl.appendChild(opt);
    });
  };

  populateGrid(joinGrid, 'join');
  populateGrid(regGrid, 'reg');
  populateGrid(editGrid, 'edit');

  // Tab Switching (Presets vs Custom Image)
  document.querySelectorAll('.avatar-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parentGroup = btn.closest('.input-group');
      if (!parentGroup) return;
      parentGroup.querySelectorAll('.avatar-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.dataset.target;
      parentGroup.querySelectorAll('.avatar-tab-content').forEach(c => c.classList.add('hidden'));
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.remove('hidden');
    });
  });

  // Category Filtering
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.dataset.cat;
      const parentTab = pill.closest('.avatar-tab-content');
      if (!parentTab) return;

      parentTab.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const grid = parentTab.querySelector('.avatar-picker-grid-50');
      if (!grid) return;
      grid.querySelectorAll('.avatar-opt').forEach(opt => {
        if (cat === 'all' || opt.dataset.cat === cat) {
          opt.style.display = 'flex';
        } else {
          opt.style.display = 'none';
        }
      });
    });
  });

  // Custom Image Upload Listeners
  const bindImageFileUploader = (inputId, previewId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      processCustomAvatarFile(file, previewId);
    });
  };

  const bindImageUrlApplier = (btnId, inputId, previewId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      processCustomAvatarUrl(input.value, previewId);
    });
  };

  bindImageFileUploader('join-avatar-file-input', 'join-avatar-preview');
  bindImageFileUploader('reg-avatar-file-input', 'reg-avatar-preview');
  bindImageFileUploader('edit-avatar-file-input', 'edit-avatar-preview');
  bindImageUrlApplier('btn-join-apply-url', 'join-avatar-url-input', 'join-avatar-preview');
  bindImageUrlApplier('btn-reg-apply-url', 'reg-avatar-url-input', 'reg-avatar-preview');
  bindImageUrlApplier('btn-edit-apply-url', 'edit-avatar-url-input', 'edit-avatar-preview');
}

function processCustomAvatarFile(file, previewElemId) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxSize = 128;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        }
      } else {
        if (h > maxSize) {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png', 0.85);
      myAvatar = dataUrl;
      updateMyProfileUI();
      showToast('画像アイコンを設定しました！', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function processCustomAvatarUrl(urlStr, previewElemId) {
  if (!urlStr || (!urlStr.startsWith('http://') && !urlStr.startsWith('https://') && !urlStr.startsWith('data:image/'))) {
    showToast('有効な画像URLを入力してください (http/https/data:image)', 'error');
    return;
  }
  myAvatar = urlStr.trim();
  updateMyProfileUI();
  showToast('画像URLアイコンを設定しました！', 'success');
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
  onDisconnect(userRef).remove();
  await set(userRef, {
    name: myName,
    trip: myTrip,
    avatar: myAvatar,
    status: myStatus,
    joinedAt: Date.now(),
    lastSeen: Date.now()
  });
}

function updateMyProfileUI() {
  document.getElementById('my-name-display').textContent = myName;
  document.getElementById('my-trip-display').textContent = myTrip;
  document.getElementById('my-avatar').innerHTML = renderAvatarHTML(myAvatar);
  document.getElementById('my-status-display').textContent = myStatus;

  const joinPrev = document.getElementById('join-avatar-preview');
  if (joinPrev) joinPrev.innerHTML = renderAvatarHTML(myAvatar);
  const editPrev = document.getElementById('edit-avatar-preview');
  if (editPrev) editPrev.innerHTML = renderAvatarHTML(myAvatar);
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

  await remove(roomRef(`active_users/${myUserId}`));

  currentRoomId = newRoomId;
  document.getElementById('current-room-title').innerHTML = escapeHtml(roomTitle);

  document.querySelectorAll('.room-tab').forEach(t => {
    if (t.dataset.room === newRoomId) t.classList.add('active');
    else t.classList.remove('active');
  });

  const container = document.getElementById('messages-container');
  container.innerHTML = '';
  allMessages.clear();

  await registerOnlineUser();
  sendSystemMessage(`${myAvatar} ${myName} がこの部屋に入室しました`);
  initFirebaseRealtimeSync();
  showToast(`「${roomTitle.trim()}」に移動しました`);
}

// Realtime Listeners
function initFirebaseRealtimeSync() {
  if (unsubscribeActiveUsers) unsubscribeActiveUsers();
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeTyping) unsubscribeTyping();
  if (unsubscribeTopic) unsubscribeTopic();
  if (unsubscribeScreen) unsubscribeScreen();

  // 1. オンラインリスト（30秒以内の生存確認で確実表示＆古いデータの自動削除）
  unsubscribeActiveUsers = onValue(roomRef('active_users'), (snapshot) => {
    const userListEl = document.getElementById('online-user-list');
    const onlineCountEl = document.getElementById('online-count');
    userListEl.innerHTML = '';
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      activeUsersMap.clear();
      const now = Date.now();
      let count = 0;

      Object.entries(users).forEach(([uid, uData]) => {
        if (!uData || (uData.lastSeen && (now - uData.lastSeen > 30000))) {
          remove(roomRef(`active_users/${uid}`)).catch(() => {});
          return;
        }

        activeUsersMap.set(uid, uData);
        count++;
        if (ignoredUsersSet.has(uid)) return;

        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
          <div class="avatar-sm">${renderAvatarHTML(uData.avatar || '🤖')}</div>
          <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(uData.name)} ${uid === myUserId ? '<span style="font-size:0.75rem; opacity:0.6;">(あなた)</span>' : ''}</div>
            <div class="user-item-status">${escapeHtml(uData.status || '💬 雑談歓迎')}</div>
          </div>
          <button class="btn-secondary btn-sm" onclick="window.startWhisper('${uid}', '${escapeHtml(uData.name)}')" title="内緒話（DM）"><i class="fa-solid fa-lock"></i></button>
          ${uid !== myUserId ? `<button class="btn-secondary btn-sm" onclick="window.sendFriendRequest('${uid}', '${escapeHtml(uData.name)}')" title="フレンド申請"><i class="fa-solid fa-user-plus text-primary"></i></button>` : ''}
          ${uid !== myUserId ? `<button class="btn-mute-user" onclick="window.ignoreUser('${uid}', '${escapeHtml(uData.name)}')" title="無視（ブロック）"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        userListEl.appendChild(li);
      });
      onlineCountEl.textContent = `${count}人`;
    } else {
      onlineCountEl.textContent = '0人';
    }

    if (typeof renderFriendsListUI === 'function') {
      renderFriendsListUI();
    }
  });

  // 2. メッセージ同期
  const messagesQuery = query(roomRef('messages'), limitToLast(50));
  const loadingEl = document.getElementById('messages-loading');

  unsubscribeMessages = onChildAdded(messagesQuery, (snapshot) => {
    if (loadingEl) loadingEl.style.display = 'none';
    const msgId = snapshot.key;
    const msgData = snapshot.val();
    
    if (allMessages.has(msgId)) return;

    allMessages.set(msgId, { id: msgId, ...msgData });
    renderSingleMessage(msgId, msgData);

    // クイズ回答判定
    checkQuizAnswer(msgData);

    // AI Bot自動応答判定 (@bot)
    checkAiBotTrigger(msgData);

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
  unsubscribeTyping = onValue(roomRef('typing'), (snapshot) => {
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
  unsubscribeTopic = onValue(roomRef('topic'), (snapshot) => {
    const topicEl = document.getElementById('room-topic-text');
    if (snapshot.exists()) {
      topicEl.textContent = snapshot.val();
    } else {
      topicEl.textContent = 'みんなの好きな食べ物や最近ハマっていることは？';
    }
  });

  // 5. 画面共有状態
  unsubscribeScreen = onValue(roomRef('screen_share'), (snapshot) => {
    const box = document.getElementById('screen-share-overlay');
    const sharerNameEl = document.getElementById('screen-sharer-name');
    const videoEl = document.getElementById('screen-share-video');
    const remoteImgEl = document.getElementById('screen-share-remote-img');

    if (snapshot.exists() && snapshot.val().active) {
      const data = snapshot.val();
      sharerNameEl.textContent = data.userId === myUserId ? 'あなた' : data.name;
      box.classList.remove('hidden');

      if (data.userId !== myUserId && data.frameData) {
        videoEl.classList.add('hidden');
        remoteImgEl.src = data.frameData;
        remoteImgEl.classList.remove('hidden');
      } else if (data.userId === myUserId) {
        remoteImgEl.classList.add('hidden');
        videoEl.classList.remove('hidden');
      }
    } else {
      if (!isScreenSharing) {
        box.classList.add('hidden');
        document.getElementById('app-container').classList.remove('screen-share-expanded');
      }
    }
  });
}

// 🤖 AI CyberBot Responder (@bot Integration)
function getAiApiKey() {
  return localStorage.getItem('cyberchat_ai_key') || '';
}

function setupAiBotControls() {
  const callBotBtn = document.getElementById('btn-call-ai-bot');
  if (callBotBtn) {
    callBotBtn.addEventListener('click', () => {
      insertSnippet('🤖 @bot ');
    });
  }
}

async function fetchAiBotResponse(prompt, senderName) {
  if (!prompt || prompt.trim() === '') {
    return `こんにちは！${senderName} さん！🤖 CyberBot です。質問、計算、お悩み相談、会話など何でも気軽に話しかけてくださいね！\n例: 「@bot 今日の運勢は？」「@bot 12 x 15 は？」「@bot 最新のAIニュースを教えて」`;
  }

  const apiKey = getAiApiKey();
  if (apiKey) {
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: `あなたはCyberChatの知性的でフレンドリーなAIアシスタント CyberBot 🤖 です。ユーザー「${senderName}」からの次のメッセージに対して、丁寧かつ分かりやすく、親しみやすい日本語で回答してください。\n\n質問: ${prompt}`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 600
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            return text.trim();
          }
        }
      } catch (e) {
        console.warn(`Gemini API fetch error (${model}):`, e);
      }
    }
  }

  return generateLocalAiResponse(prompt, senderName);
}

function checkAiBotTrigger(msgData) {
  if (!msgData.text || msgData.userId === 'cyberbot_ai' || msgData.type === 'system' || msgData.whisperTo) return;

  const text = msgData.text.trim();
  if (text.startsWith('@bot') || text.startsWith('@CyberBot') || text.includes('@bot')) {
    const prompt = text.replace(/@bot|@CyberBot/g, '').trim();

    setTimeout(async () => {
      try {
        const botResponse = await fetchAiBotResponse(prompt, msgData.name);
        const botRef = push(roomRef('messages'));
        await set(botRef, {
          userId: 'cyberbot_ai',
          name: '🤖 CyberBot [AIアシスタント]',
          trip: '◆AI_BOT_01',
          avatar: '🤖',
          type: 'text',
          text: botResponse,
          replyTo: {
            msgId: msgData.id,
            senderName: msgData.name,
            text: msgData.text
          },
          timestamp: Date.now()
        });
        playSound('receive');
      } catch (e) {
        console.warn("AI Bot response error:", e);
      }
    }, 600);
  }
}

function generateLocalAiResponse(prompt, senderName) {
  if (!prompt) {
    return `こんにちは！${senderName}さん！🤖 何か聞きたいことや、計算・占い・雑談の相手なら任せてください！`;
  }

  const p = prompt.toLowerCase();
  
  if (p.includes('運勢') || p.includes('占い') || p.includes('おみくじ')) {
    const fortunes = ['✨ 超大吉 (最高の一日！)', '🌟 大吉 (願い事が叶うかも)', '😊 中吉 (良い感じ！)', '👍 吉 (穏やか)', '🍀 小吉 (ラッキーアイテムはコーヒー)'];
    return `${senderName}さんの今日の運勢は... ${fortunes[Math.floor(Math.random() * fortunes.length)]} です！🎉`;
  }

  if (p.includes('冗談') || p.includes('ジョーク') || p.includes('笑わせて')) {
    const jokes = [
      '【AIジョーク】プログラマーがスーパーに買い物に行きました。「牛乳を1つ買ってきて。もし卵があったら6個買ってきて」と言われたプログラマーは、牛乳を6つ買って帰りました。',
      '【AIダジャレ】アルミ缶の上にあるミカン！🍊',
      '【AI雑学】ペンギンの膝は実は曲がっていて、常に空気椅子状態なんですよ！🐧'
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  const mathMatch = prompt.match(/(\d+)\s*([\+\-\*\/x×÷])\s*(\d+)/);
  if (mathMatch) {
    const num1 = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const num2 = parseFloat(mathMatch[3]);
    let result = 0;
    if (op === '+') result = num1 + num2;
    else if (op === '-') result = num1 - num2;
    else if (op === '*' || op === 'x' || op === '×') result = num1 * num2;
    else if (op === '/' || op === '÷') result = num2 !== 0 ? (num1 / num2) : '0で割ることはできません';
    return `計算結果: ${num1} ${op} ${num2} = ${result} です！🧮`;
  }

  return `「${prompt}」についてのお問い合わせですね！${senderName}さん、AIとしてお答えします！何か他にお手伝いできることはありますか？🤖`;
}

// 🧠 数学スピードクイズ機能
window.startMathQuizGame = async () => {
  const num1 = Math.floor(Math.random() * 20) + 5;
  const num2 = Math.floor(Math.random() * 15) + 3;
  const isMult = Math.random() > 0.5;

  const questionText = isMult ? `${num1} × ${num2}` : `${num1 * num2} ÷ ${num1}`;
  activeMathQuizAnswer = isMult ? (num1 * num2) : num2;

  try {
    const quizRef = push(roomRef('messages'));
    await set(quizRef, {
      userId: 'quiz_bot',
      name: '🧠 数学スピードクイズ',
      trip: '◆MATH_QUIZ',
      avatar: '🧠',
      type: 'game',
      text: `<div class="quiz-card"><div class="quiz-title">🧠 早押し数学クイズ問題！</div><div class="quiz-question">【問題】 ${questionText} = ?</div><div class="quiz-hint">答えを数字でメッセージ送信してください！一番早い人が勝ち！</div></div>`,
      timestamp: Date.now()
    });
    showToast('数学スピードクイズを出題しました！', 'success');
  } catch (e) {
    showToast('クイズ出題失敗', 'error');
  }
};

function checkQuizAnswer(msgData) {
  if (!activeMathQuizAnswer || msgData.userId === 'quiz_bot' || !msgData.text) return;

  const userNum = parseInt(msgData.text.trim(), 10);
  if (!isNaN(userNum) && userNum === activeMathQuizAnswer) {
    const winAns = activeMathQuizAnswer;
    activeMathQuizAnswer = null;

    setTimeout(async () => {
      sendSystemMessage(`🎉 【${msgData.name}】さんが数学クイズに見事正解しました！！ 👏 (正解: ${winAns})`);
      playSound('fanfare');
    }, 500);
  }
}

// ✌️ じゃんけん対戦機能
window.startRpsBattle = async () => {
  try {
    const rpsRef = push(roomRef('messages'));
    const msgId = rpsRef.key;
    await set(rpsRef, {
      userId: myUserId,
      name: myName,
      trip: myTrip,
      avatar: myAvatar,
      type: 'rps',
      text: `<div class="rps-card" id="rps-box-${msgId}"><div class="rps-title">✌️ じゃんけん対戦者募集！</div><div>手を1つ選んで勝負！</div><div class="rps-btns"><button class="rps-choice-btn" onclick="window.playRpsChallenge('${msgId}', '✊')">✊ グー</button><button class="rps-choice-btn" onclick="window.playRpsChallenge('${msgId}', '✌️')">✌️ チョキ</button><button class="rps-choice-btn" onclick="window.playRpsChallenge('${msgId}', '✋')">✋ パー</button></div></div>`,
      timestamp: Date.now()
    });
    showToast('じゃんけん対戦募集を投稿しました！', 'success');
  } catch (e) {
    showToast('じゃんけん投稿失敗', 'error');
  }
};

window.playRpsChallenge = (msgId, myChoice) => {
  const choices = ['✊', '✌️', '✋'];
  const botChoice = choices[Math.floor(Math.random() * choices.length)];

  let resultText = '';
  if (myChoice === botChoice) resultText = '引き分け！ (あいこ)';
  else if (
    (myChoice === '✊' && botChoice === '✌️') ||
    (myChoice === '✌️' && botChoice === '✋') ||
    (myChoice === '✋' && botChoice === '✊')
  ) {
    resultText = '🎉 あなたの勝ち！';
  } else {
    resultText = '💀 あなたの負け！';
  }

  showToast(`あなた: ${myChoice} vs 相手: ${botChoice} -> ${resultText}`, 'info');
  sendSpecialMessage('game', `✌️ じゃんけん対戦結果: 【${myName}】 ${myChoice} vs ${botChoice} 相手 ➡ ${resultText}`);
};

// Reply Manager (返信機能)
window.replyToMsg = (msgId) => {
  const msg = allMessages.get(msgId);
  if (!msg) return;

  replyTargetId = msgId;
  replyTargetName = msg.name || 'ゲスト';
  replyTargetText = msg.text || (msg.type === 'image' ? '[画像]' : msg.type === 'stamp' ? '[スタンプ]' : '[ファイル]');

  document.getElementById('reply-target-name').textContent = replyTargetName;
  document.getElementById('reply-target-text').textContent = `"${replyTargetText}"`;
  document.getElementById('reply-banner').classList.remove('hidden');

  document.getElementById('message-text-input').focus();
  showToast(`「${replyTargetName}」さんへ返信を作成中`);
};

function setupReplyBanner() {
  const btnCancel = document.getElementById('btn-cancel-reply');
  if (btnCancel) {
    btnCancel.addEventListener('click', cancelReply);
  }
}

function cancelReply() {
  replyTargetId = null;
  replyTargetName = null;
  replyTargetText = null;
  const banner = document.getElementById('reply-banner');
  if (banner) banner.classList.add('hidden');
}

window.scrollToMsg = (msgId) => {
  const node = document.getElementById(`msg-${msgId}`);
  if (node) {
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.remove('msg-highlight-glow');
    void node.offsetWidth; // trigger reflow
    node.classList.add('msg-highlight-glow');
  } else {
    showToast('返信元のメッセージが見つかりませんでした');
  }
};

// Render Single Message
function renderSingleMessage(msgId, msg) {
  if (ignoredUsersSet.has(msg.userId)) return;

  if (msg.whisperTo) {
    if (msg.userId !== myUserId && msg.whisperTo !== myUserId) {
      return;
    }
  }

  const container = document.getElementById('messages-container');
  const isSelf = msg.userId === myUserId;
  const isStarred = starredMsgSet.has(msgId);

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
        <button onclick="window.replyToMsg('${msgId}')"><i class="fa-solid fa-reply text-primary"></i> 返信</button>
        <button onclick="window.toggleStarMsg('${msgId}')"><i class="fa-solid fa-star ${isStarred ? 'text-warning' : ''}"></i> ${isStarred ? 'しおり解除' : 'しおり保存'}</button>
        ${(isSelf || isAdminMode) && !msg.deleted ? `<button onclick="window.openEditMsgModal('${msgId}')"><i class="fa-solid fa-pen"></i> 編集</button>` : ''}
        ${(isSelf || isAdminMode) && !msg.deleted ? `<button class="danger" onclick="window.deleteMsg('${msgId}')"><i class="fa-solid fa-trash"></i> 削除</button>` : ''}
        ${!isSelf ? `<button onclick="window.startWhisper('${msg.userId}', '${escapeHtml(msg.name)}')"><i class="fa-solid fa-lock"></i> 内緒話</button>` : ''}
        ${!isSelf ? `<button onclick="window.sendFriendRequest('${msg.userId}', '${escapeHtml(msg.name)}')"><i class="fa-solid fa-user-plus text-primary"></i> フレンド申請</button>` : ''}
        ${!isSelf ? `<button class="danger" onclick="window.ignoreUser('${msg.userId}', '${escapeHtml(msg.name)}')"><i class="fa-solid fa-user-slash"></i> 無視する</button>` : ''}
        ${isAdminMode && !isSelf ? `<button class="danger" onclick="window.adminBanUser('${msg.userId}', '${escapeHtml(msg.name)}')"><i class="fa-solid fa-ban"></i> BAN・追放</button>` : ''}
      </div>
    `;

    const whisperHeader = msg.whisperTo ? `<span style="color:#f472b6; font-weight:700;"><i class="fa-solid fa-lock"></i> 【内緒話】</span>` : '';
    const starBadge = isStarred ? `<i class="fa-solid fa-star text-warning" title="お気に入り"></i> ` : '';

    const metaHtml = `
      <div class="msg-meta">
        <span class="msg-avatar-icon">${renderAvatarHTML(msg.avatar || '🤖')}</span>
        <span class="msg-sender-name">${starBadge}${whisperHeader} ${escapeHtml(msg.name)} <span class="trip-badge">${escapeHtml(msg.trip)}</span></span>
        <span class="msg-time">${formatTime(msg.timestamp)} ${msg.edited ? '<span style="font-size:0.7rem; opacity:0.6;">(編集済み)</span>' : ''}</span>
      </div>
    `;

    let quoteCardHtml = '';
    if (msg.replyTo) {
      quoteCardHtml = `
        <div class="msg-quote-card" onclick="window.scrollToMsg('${msg.replyTo.msgId}')">
          <div class="quote-sender"><i class="fa-solid fa-reply"></i> ${escapeHtml(msg.replyTo.senderName)}</div>
          <div class="quote-text">${escapeHtml(msg.replyTo.text)}</div>
        </div>
      `;
    }

    let contentHtml = '';
    const bubbleClass = `msg-bubble ${msg.whisperTo ? 'whisper' : ''}`;

    if (msg.deleted) {
      contentHtml = `<div class="${bubbleClass}" style="opacity:0.6; font-style:italic;">(このメッセージは削除されました)</div>`;
    } else if (msg.type === 'stamp') {
      contentHtml = `<div class="${bubbleClass}">${quoteCardHtml}<div class="stamp-card-img">${escapeHtml(msg.text)}</div></div>`;
    } else if (msg.type === 'game' || msg.type === 'rps') {
      contentHtml = `<div class="${bubbleClass}">${quoteCardHtml}${msg.text}</div>`;
    } else if (msg.type === 'image') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${quoteCardHtml}
          ${msg.text ? `<p>${formatMessageText(msg.text)}</p>` : ''}
          <img src="${msg.fileUrl}" class="msg-image" alt="投稿画像" onclick="window.openImageModal('${msg.fileUrl}')">
        </div>
      `;
    } else if (msg.type === 'video') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${quoteCardHtml}
          ${msg.text ? `<p>${formatMessageText(msg.text)}</p>` : ''}
          <video src="${msg.fileUrl}" controls class="msg-video"></video>
        </div>
      `;
    } else if (msg.type === 'audio' || msg.type === 'voice') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${quoteCardHtml}
          ${msg.type === 'voice' ? '<div style="font-size:0.8rem; font-weight:600; margin-bottom:4px;"><i class="fa-solid fa-microphone text-success"></i> ボイスメッセージ</div>' : ''}
          <audio src="${msg.fileUrl}" controls class="msg-audio"></audio>
        </div>
      `;
    } else if (msg.type === 'file') {
      contentHtml = `
        <div class="${bubbleClass}">
          ${quoteCardHtml}
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
      const ytEmbedHtml = getYouTubeEmbedHtml(msg.text);
      contentHtml = `<div class="${bubbleClass}">${quoteCardHtml}${formatMessageText(msg.text)}${ytEmbedHtml}</div>`;
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

// YouTube Video URL Detector
function getYouTubeEmbedHtml(text) {
  if (!text) return '';
  const match = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    const videoId = match[1];
    return `<br><iframe class="msg-youtube-iframe" src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
  }
  return '';
}

// Markdown Formatting
function formatMessageText(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; font-family:monospace; color:#00f0ff;">$1</code>');
  escaped = escaped.replace(/~(.*?)~/g, '<del>$1</del>');

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

function updateMessageUI(msgId, msgData) {
  if (msgData.whisperTo) {
    if (msgData.userId !== myUserId && msgData.whisperTo !== myUserId) {
      const node = document.getElementById(`msg-${msgId}`);
      if (node) node.remove();
      return;
    }
  }

  const reactionsContainer = document.getElementById(`reactions-${msgId}`);
  if (reactionsContainer) {
    reactionsContainer.innerHTML = renderReactionsHtml(msgId, msgData.reactions);
  }

  const wrapper = document.getElementById(`msg-${msgId}`);
  if (!wrapper) return;

  if (msgData.type === 'poll') {
    const bubble = wrapper.querySelector('.msg-bubble');
    if (bubble) bubble.outerHTML = renderPollCardHtml(msgId, msgData.poll);
  }

  if (msgData.deleted) {
    const bubble = wrapper.querySelector('.msg-bubble');
    if (bubble) bubble.innerHTML = '<span style="opacity:0.6; font-style:italic;">(このメッセージは削除されました)</span>';
  }
}

// Global Actions & Bookmark
window.toggleStarMsg = (msgId) => {
  if (starredMsgSet.has(msgId)) {
    starredMsgSet.delete(msgId);
    showToast('しおりを解除しました');
  } else {
    starredMsgSet.add(msgId);
    showToast('お気に入りメッセージに保存しました', 'success');
  }
  localStorage.setItem('cyberchat_starred_msgs', JSON.stringify(Array.from(starredMsgSet)));
  
  const msgData = allMessages.get(msgId);
  if (msgData) updateMessageUI(msgId, msgData);
};

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

function applyFilterAndSearchToNode(node, msg) {
  if (msg.whisperTo) {
    if (msg.userId !== myUserId && msg.whisperTo !== myUserId) {
      node.classList.add('hidden');
      return;
    }
  }

  let visible = true;
  if (currentFilter === 'star' && !starredMsgSet.has(msg.id)) visible = false;
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

// Canvas Paint Board Popup Setup
function setupPaintModal() {
  const modal = document.getElementById('paint-modal');
  const openBtn = document.getElementById('btn-open-paint');
  const canvas = document.getElementById('paint-canvas');
  const ctx = canvas.getContext('2d');
  const colorPicker = document.getElementById('paint-color');
  const sizePicker = document.getElementById('paint-size');
  const clearBtn = document.getElementById('btn-clear-paint');
  const submitBtn = document.getElementById('btn-submit-paint');

  openBtn.addEventListener('click', () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    modal.classList.remove('hidden');
  });

  document.querySelectorAll('#paint-modal .modal-close').forEach(b => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });

  clearBtn.addEventListener('click', () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  const startDraw = (e) => {
    isPainting = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isPainting) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = sizePicker.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDraw = () => { isPainting = false; };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
  canvas.addEventListener('touchend', stopDraw);

  submitBtn.addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    modal.classList.add('hidden');
    
    sendSpecialMessageWithMedia('image', '🎨 手書きイラスト', dataUrl);
    showToast('イラストを投稿しました！', 'success');
  });
}

async function sendSpecialMessageWithMedia(msgType, text, fileUrl) {
  if (isSendingSpecial) return;
  isSendingSpecial = true;
  try {
    const newMsgRef = push(roomRef('messages'));
    const msgObj = {
      userId: myUserId,
      name: myName,
      trip: myTrip,
      avatar: myAvatar,
      type: msgType,
      text: text,
      fileUrl: fileUrl,
      timestamp: Date.now()
    };
    if (whisperTargetId) msgObj.whisperTo = whisperTargetId;
    if (replyTargetId) {
      msgObj.replyTo = {
        msgId: replyTargetId,
        senderName: replyTargetName,
        text: replyTargetText
      };
    }

    await set(newMsgRef, msgObj);
    cancelReply();
    playSound('send');
  } catch (err) {
    showToast('送信に失敗しました', 'error');
  } finally {
    isSendingSpecial = false;
  }
}

// Screen Sharing Logic
function setupScreenShare() {
  const btnToggle = document.getElementById('btn-toggle-screen');
  const box = document.getElementById('screen-share-overlay');
  const videoEl = document.getElementById('screen-share-video');
  const remoteImgEl = document.getElementById('screen-share-remote-img');
  const btnSnap = document.getElementById('btn-snap-screen');
  const btnStop = document.getElementById('btn-stop-screen');
  const btnExpand = document.getElementById('btn-expand-screen');
  const titleClickable = document.getElementById('screen-share-title-clickable');
  const appContainer = document.getElementById('app-container');

  let isExpanded = false;

  function toggleTheaterMode(e) {
    if (e && (e.target.closest('#btn-snap-screen') || e.target.closest('#btn-stop-screen'))) {
      return;
    }

    isExpanded = !isExpanded;
    if (isExpanded) {
      appContainer.classList.add('screen-share-expanded');
      btnExpand.innerHTML = '<i class="fa-solid fa-compress"></i>';
      btnExpand.title = '小画面に戻す';
      showToast('大画面（シアターモード）に切り替えました。右側でチャットができます！');
    } else {
      appContainer.classList.remove('screen-share-expanded');
      btnExpand.innerHTML = '<i class="fa-solid fa-expand"></i>';
      btnExpand.title = '大画面切り替え';
      showToast('小画面（左下）に戻しました');
    }
  }

  if (btnExpand) btnExpand.addEventListener('click', toggleTheaterMode);
  if (titleClickable) titleClickable.addEventListener('click', toggleTheaterMode);
  if (videoEl) videoEl.addEventListener('click', toggleTheaterMode);
  if (remoteImgEl) remoteImgEl.addEventListener('click', toggleTheaterMode);

  btnToggle.addEventListener('click', async () => {
    if (!isScreenSharing) {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false
        });

        isScreenSharing = true;
        btnToggle.classList.add('sharing');
        btnToggle.innerHTML = '<i class="fa-solid fa-desktop text-danger"></i> <span>共有停止</span>';

        videoEl.srcObject = screenStream;
        videoEl.classList.remove('hidden');
        box.classList.remove('hidden');

        await set(roomRef('screen_share'), {
          active: true,
          userId: myUserId,
          name: myName,
          timestamp: Date.now()
        });

        screenFrameInterval = setInterval(() => {
          if (!isScreenSharing || !videoEl || videoEl.videoWidth === 0) return;
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = Math.round((videoEl.videoHeight * 480) / videoEl.videoWidth);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.4);

          update(roomRef('screen_share'), {
            frameData: frameDataUrl,
            timestamp: Date.now()
          });
        }, 1200);

        sendSystemMessage(`🖥️ ${myName} が画面共有を開始しました`);
        showToast('画面共有を開始しました！(クリックで大画面化できます)', 'success');

        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };

      } catch (err) {
        console.warn("Screen share cancel or error:", err);
        showToast('画面共有がキャンセルされました');
      }
    } else {
      stopScreenShare();
    }
  });

  btnStop.addEventListener('click', stopScreenShare);

  btnSnap.addEventListener('click', () => {
    if (!videoEl || videoEl.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const snapDataUrl = canvas.toDataURL('image/jpeg', 0.6);
    sendSpecialMessageWithMedia('image', '📸 共有画面のスナップショット', snapDataUrl);
    showToast('共有画面のスナップショットを投稿しました！', 'success');
  });

  function stopScreenShare() {
    isScreenSharing = false;
    isExpanded = false;
    appContainer.classList.remove('screen-share-expanded');
    if (screenFrameInterval) clearInterval(screenFrameInterval);
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
    }
    btnToggle.classList.remove('sharing');
    btnToggle.innerHTML = '<i class="fa-solid fa-desktop"></i> <span>画面共有</span>';
    box.classList.add('hidden');

    remove(roomRef('screen_share'));
    sendSystemMessage(`🖥️ ${myName} が画面共有を終了しました`);
    showToast('画面共有を終了しました');
  }
}

// Stamps & Minigames & Soundboard
function setupStampsAndMinigames() {
  const stampBtn = document.getElementById('btn-stamp-toggle');
  const stampPicker = document.getElementById('stamp-picker');
  const soundboardBtn = document.getElementById('btn-soundboard-toggle');
  const soundboardPicker = document.getElementById('soundboard-picker');

  stampBtn.addEventListener('click', () => {
    soundboardPicker.classList.add('hidden');
    stampPicker.classList.toggle('hidden');
  });

  soundboardBtn.addEventListener('click', () => {
    stampPicker.classList.add('hidden');
    soundboardPicker.classList.toggle('hidden');
  });

  document.querySelectorAll('.stamp-btn[data-stamp]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stampText = btn.dataset.stamp;
      stampPicker.classList.add('hidden');
      sendSpecialMessage('stamp', stampText);
    });
  });

  document.getElementById('btn-game-dice').addEventListener('click', () => {
    const roll = Math.floor(Math.random() * 100) + 1;
    sendSpecialMessage('game', `<i class="fa-solid fa-dice"></i> さいころを振った！ <span class="game-card-val">【出目: ${roll} / 100】</span>`);
  });

  document.getElementById('btn-game-omikuji').addEventListener('click', () => {
    const fortunes = [
      '✨ 大吉 ✨ 願望は叶うでしょう！',
      '🌟 中吉 🌟 良いことが起きる予感！',
      '😊 吉 今日は穏やかな一日。',
      '👍 小吉 コツコツ努力が実を結ぶ！',
      '🍀 末吉 幸運のヒントはすぐそばに。'
    ];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    sendSpecialMessage('game', `<i class="fa-solid fa-torii-gate text-success"></i> 今日の運勢おみくじ <span class="game-card-val">${fortune}</span>`);
  });

  document.getElementById('btn-game-coin').addEventListener('click', () => {
    const isHeads = Math.random() < 0.5;
    sendSpecialMessage('game', `<i class="fa-solid fa-coins"></i> コイントス！ <span class="game-card-val">結果: 【${isHeads ? '表 (Heads)' : '裏 (Tails)'}】</span>`);
  });
}

// 🛡️ Anti-Spam Rate Limiter & Flood Prevention
let lastMessageTime = 0;
const MESSAGE_COOLDOWN_MS = 1200;

function checkAntiSpam(text) {
  const now = Date.now();
  if (now - lastMessageTime < MESSAGE_COOLDOWN_MS) {
    showToast('⚠️ 連投防止：少し時間をおいてから送信してください', 'error');
    return false;
  }

  if (text && text.length > 1000) {
    showToast('⚠️ メッセージが長すぎます（最大1000文字まで）', 'error');
    return false;
  }

  if (text && /(.)\1{35,}/.test(text)) {
    showToast('⚠️ 意味のない長文連投パターンは送信できません', 'error');
    return false;
  }

  lastMessageTime = now;
  return true;
}

async function sendSpecialMessage(msgType, text) {
  if (isSendingSpecial) return;
  if (!checkAntiSpam(text)) return;
  isSendingSpecial = true;
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
    if (whisperTargetId) msgObj.whisperTo = whisperTargetId;
    if (replyTargetId) {
      msgObj.replyTo = {
        msgId: replyTargetId,
        senderName: replyTargetName,
        text: replyTargetText
      };
    }

    await set(newMsgRef, msgObj);
    cancelReply();
    playSound('send');
  } catch (err) {
    showToast('送信に失敗しました', 'error');
  } finally {
    isSendingSpecial = false;
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
    if (isSending) return;
    const text = textInput.value.trim();
    if (!text && !selectedFileObject) return;

    if (!checkAntiSpam(text)) return;

    isSending = true;
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

      if (replyTargetId) {
        msgObj.replyTo = {
          msgId: replyTargetId,
          senderName: replyTargetName,
          text: replyTargetText
        };
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
      cancelReply();

      playSound('send');
    } catch (err) {
      console.error("Send message error:", err);
      showToast('メッセージ送信に失敗しました', 'error');
    } finally {
      isSending = false;
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

// Ambient BGM Synthesizer
function setupBgmPlayer() {
  const bgmBtn = document.getElementById('btn-toggle-bgm');
  bgmBtn.addEventListener('click', () => {
    isBgmPlaying = !isBgmPlaying;
    bgmBtn.classList.toggle('active', isBgmPlaying);

    if (isBgmPlaying) {
      startBgm();
      showToast('作業用BGMを再生開始しました 🎵');
    } else {
      stopBgm();
      showToast('作業用BGMを停止しました');
    }
  });
}

function startBgm() {
  try {
    bgmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmOsc = bgmAudioCtx.createOscillator();
    bgmGain = bgmAudioCtx.createGain();

    bgmOsc.type = 'sine';
    bgmOsc.frequency.setValueAtTime(220, bgmAudioCtx.currentTime);
    bgmGain.gain.setValueAtTime(0.04, bgmAudioCtx.currentTime);

    bgmOsc.connect(bgmGain);
    bgmGain.connect(bgmAudioCtx.destination);
    bgmOsc.start();
  } catch (e) {
    console.warn("BGM start error:", e);
  }
}

function stopBgm() {
  if (bgmOsc) {
    try { bgmOsc.stop(); } catch (e) {}
    bgmOsc = null;
  }
  if (bgmAudioCtx) {
    try { bgmAudioCtx.close(); } catch (e) {}
    bgmAudioCtx = null;
  }
}

// WebRTC Voice Chat Implementation
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
            if (replyTargetId) {
              msgObj.replyTo = {
                msgId: replyTargetId,
                senderName: replyTargetName,
                text: replyTargetText
              };
            }

            await set(newMsgRef, msgObj);
            cancelReply();
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

        initWebRtcSignaling();
        showToast('ボイスチャットに参加しました！', 'success');
      } catch (err) {
        showToast('マイクアクセスの許可が必要です', 'error');
      }
    } else {
      leaveVoiceRoom();
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

function leaveVoiceRoom() {
  isVoiceRoomJoined = false;
  if (localAudioStream) {
    localAudioStream.getTracks().forEach(track => track.stop());
    localAudioStream = null;
  }

  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();

  const container = document.getElementById('remote-audio-container');
  if (container) container.innerHTML = '';

  const btnVcToggle = document.getElementById('btn-toggle-vc');
  const btnMicToggle = document.getElementById('btn-toggle-mic');

  btnVcToggle.classList.remove('joined');
  btnVcToggle.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>ボイスチャット</span>';
  btnMicToggle.classList.add('hidden');
  document.getElementById('vc-section').classList.add('hidden');

  remove(roomRef(`voice_room/${myUserId}`));
  if (unsubscribeSignals) unsubscribeSignals();
  showToast('ボイスチャットから退出しました');
}

// WebRTC Signaling Handler
function initWebRtcSignaling() {
  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  unsubscribeSignals = onValue(roomRef('voice_signals'), (snapshot) => {
    if (!snapshot.exists() || !isVoiceRoomJoined) return;
    const signals = snapshot.val();

    Object.entries(signals).forEach(async ([pairKey, signalData]) => {
      const [fromUid, toUid] = pairKey.split('_');
      if (toUid !== myUserId) return;

      if (signalData.type === 'offer') {
        const pc = createPeerConnection(fromUid, rtcConfig);
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await set(roomRef(`voice_signals/${myUserId}_${fromUid}`), {
          type: 'answer',
          sdp: answer
        });
      } else if (signalData.type === 'answer') {
        const pc = peerConnections.get(fromUid);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        }
      } else if (signalData.candidate) {
        const pc = peerConnections.get(fromUid);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      }
    });
  });

  get(roomRef('voice_room')).then((snapshot) => {
    if (!snapshot.exists()) return;
    const users = snapshot.val();
    Object.keys(users).forEach(async (targetUid) => {
      if (targetUid === myUserId) return;

      const pc = createPeerConnection(targetUid, rtcConfig);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await set(roomRef(`voice_signals/${myUserId}_${targetUid}`), {
        type: 'offer',
        sdp: offer
      });
    });
  });
}

function createPeerConnection(targetUid, rtcConfig) {
  if (peerConnections.has(targetUid)) {
    return peerConnections.get(targetUid);
  }

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections.set(targetUid, pc);

  if (localAudioStream) {
    localAudioStream.getTracks().forEach(track => pc.addTrack(track, localAudioStream));
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      set(roomRef(`voice_signals/${myUserId}_${targetUid}_ice`), {
        candidate: e.candidate.toJSON()
      });
    }
  };

  pc.ontrack = (e) => {
    const container = document.getElementById('remote-audio-container');
    let audioEl = document.getElementById(`audio-${targetUid}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `audio-${targetUid}`;
      audioEl.autoplay = true;
      container.appendChild(audioEl);
    }
    audioEl.srcObject = e.streams[0];
  };

  return pc;
}

// Modals Setup
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
      if (replyTargetId) {
        msgObj.replyTo = {
          msgId: replyTargetId,
          senderName: replyTargetName,
          text: replyTargetText
        };
      }

      await set(newMsgRef, msgObj);
      modal.classList.add('hidden');
      cancelReply();
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

/* ==========================================================================
   🐺 Werewolf (人狼) Game Engine
   ========================================================================== */
class WerewolfGameEngine {
  constructor() {
    this.players = [];
    this.phase = 'lobby'; // lobby, role, night, day_chat, vote, result
    this.dayNum = 1;
    this.myRole = null;
    this.myPlayerId = null;
    this.selectedTargetId = null;
    this.discussionTimer = null;
    this.timerSeconds = 45;
    this.nightResultMsg = '';
  }

  initLobby() {
    this.phase = 'lobby';
    document.getElementById('werewolf-phase-badge').textContent = 'ロビー';
    document.getElementById('werewolf-timer-display').classList.add('hidden');
    this.showScreen('werewolf-screen-lobby');
  }

  showScreen(screenId) {
    document.querySelectorAll('.werewolf-screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
  }

  startNewGame() {
    const totalCount = parseInt(document.getElementById('werewolf-player-count').value, 10) || 5;

    let rolePool = [];
    if (totalCount === 4) {
      rolePool = ['wolf', 'seer', 'villager', 'villager'];
    } else if (totalCount === 5) {
      rolePool = ['wolf', 'seer', 'knight', 'villager', 'villager'];
    } else if (totalCount === 6) {
      rolePool = ['wolf', 'madman', 'seer', 'knight', 'villager', 'villager'];
    } else if (totalCount === 7) {
      rolePool = ['wolf', 'wolf', 'seer', 'knight', 'medium', 'villager', 'villager'];
    } else {
      rolePool = ['wolf', 'wolf', 'madman', 'seer', 'knight', 'medium', 'villager', 'villager'];
    }

    rolePool.sort(() => Math.random() - 0.5);

    const botPresets = [
      { name: 'AIたくや', avatar: '🤖' },
      { name: 'AIねこ丸', avatar: '🐱' },
      { name: 'AIきつね先生', avatar: '🦊' },
      { name: 'AIウルフ', avatar: '🐺' },
      { name: 'AIオラクル', avatar: '🔮' },
      { name: 'AIマスター', avatar: '🧙‍♂️' },
      { name: 'AIアーサー', avatar: '🛡️' },
      { name: 'AIキング', avatar: '👑' }
    ];

    this.players = [];
    this.myPlayerId = 'p_me';

    this.players.push({
      id: 'p_me',
      name: myName || 'あなた',
      avatar: myAvatar || '🤖',
      role: rolePool[0],
      isAlive: true,
      isCpu: false
    });

    for (let i = 1; i < totalCount; i++) {
      const preset = botPresets[(i - 1) % botPresets.length];
      this.players.push({
        id: `p_bot_${i}`,
        name: preset.name,
        avatar: preset.avatar,
        role: rolePool[i],
        isAlive: true,
        isCpu: true
      });
    }

    this.dayNum = 1;
    this.myRole = this.players[0].role;
    document.getElementById('wf-chat-messages').innerHTML = '';

    this.showRoleRevealScreen();
  }

  showRoleRevealScreen() {
    this.phase = 'role';
    document.getElementById('werewolf-phase-badge').textContent = '役職確認';

    const roleInfo = this.getRoleInfo(this.myRole);
    document.getElementById('wf-my-role-icon').textContent = roleInfo.icon;
    document.getElementById('wf-my-role-title').textContent = roleInfo.name;
    document.getElementById('wf-my-role-team').textContent = roleInfo.team;
    document.getElementById('wf-my-role-team').style.background = roleInfo.teamColor;
    document.getElementById('wf-my-role-desc').textContent = roleInfo.desc;

    this.showScreen('werewolf-screen-role');
  }

  getRoleInfo(role) {
    const rolesMap = {
      wolf: { icon: '🐺', name: '人狼', team: '人狼陣営', teamColor: 'rgba(255,51,102,0.4)', desc: '毎晩1人の人間を襲撃します。仲間の人狼と協力し、村人を人狼と同数以下まで減らせば勝利です。' },
      seer: { icon: '🔮', name: '占い師', team: '市民陣営', teamColor: 'rgba(0,240,255,0.4)', desc: '毎晩1人を占い、その人が「市民(白)」か「人狼(黒)」かを判別できます。人狼をあばこう！' },
      knight: { icon: '🛡️', name: '騎士', team: '市民陣営', teamColor: 'rgba(0,255,136,0.4)', desc: '毎晩1人を人狼の襲撃から護衛します。自分自身を守ることはできません。' },
      madman: { icon: '🃏', name: '狂人', team: '人狼陣営', teamColor: 'rgba(167,139,250,0.4)', desc: '人間ですが心は人狼に売った狂信者。能力はありませんが人狼陣営が勝利すれば勝ちとなります。' },
      medium: { icon: '👻', name: '霊媒師', team: '市民陣営', teamColor: 'rgba(255,184,0,0.4)', desc: '昼の投票で追放された人物が「市民」か「人狼」だったかを夜に知ることができます。' },
      villager: { icon: '👱', name: '市民', team: '市民陣営', teamColor: 'rgba(255,255,255,0.2)', desc: '特殊能力を持たない一般市民。昼の議論と投票で人狼を追放しよう！' }
    };
    return rolesMap[role] || rolesMap.villager;
  }

  startNightPhase() {
    this.phase = 'night';
    this.selectedTargetId = null;
    document.getElementById('werewolf-phase-badge').textContent = `夜 (${this.dayNum}日目)`;
    playSound('receive');

    const promptTitle = document.getElementById('wf-night-prompt-title');
    const promptDesc = document.getElementById('wf-night-prompt-desc');
    const btnSubmit = document.getElementById('btn-submit-night-action');

    const me = this.players.find(p => p.id === 'p_me');

    if (!me.isAlive) {
      promptTitle.textContent = '👻 観戦中 (死亡)';
      promptDesc.textContent = '夜の行動が行われています...';
      btnSubmit.disabled = true;
      this.renderNightTargets([]);
      setTimeout(() => this.resolveNightActions(), 2500);
      this.showScreen('werewolf-screen-night');
      return;
    }

    if (this.myRole === 'wolf') {
      promptTitle.textContent = '🐺 人狼の襲撃対象を選択';
      promptDesc.textContent = '今夜命を奪うプレイヤーを選んでください。';
      btnSubmit.disabled = true;
      this.renderNightTargets(this.players.filter(p => p.isAlive && p.role !== 'wolf'));
    } else if (this.myRole === 'seer') {
      promptTitle.textContent = '🔮 占うプレイヤーを選択';
      promptDesc.textContent = '正体を明かしたいプレイヤーを選んでください。';
      btnSubmit.disabled = true;
      this.renderNightTargets(this.players.filter(p => p.isAlive && p.id !== 'p_me'));
    } else if (this.myRole === 'knight') {
      promptTitle.textContent = '🛡️ 守るプレイヤーを選択';
      promptDesc.textContent = '人狼の襲撃から庇いたいプレイヤーを選んでください。';
      btnSubmit.disabled = true;
      this.renderNightTargets(this.players.filter(p => p.isAlive && p.id !== 'p_me'));
    } else {
      promptTitle.textContent = '🌙 夜が更けていきます';
      promptDesc.textContent = '恐ろしい夜が明けるのを待ちましょう...';
      btnSubmit.disabled = false;
      btnSubmit.textContent = '朝を迎える';
      this.renderNightTargets([]);
    }

    this.showScreen('werewolf-screen-night');
  }

  renderNightTargets(targetablePlayers) {
    const grid = document.getElementById('wf-night-target-list');
    grid.innerHTML = '';

    if (targetablePlayers.length === 0) {
      grid.innerHTML = '<div style="text-align:center; width:100%; color:var(--text-muted); padding:20px;">今夜行える行動はありません</div>';
      return;
    }

    targetablePlayers.forEach(p => {
      const card = document.createElement('div');
      card.className = `wf-player-card ${this.selectedTargetId === p.id ? 'selected' : ''}`;
      card.onclick = () => {
        this.selectedTargetId = p.id;
        document.querySelectorAll('#wf-night-target-list .wf-player-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const btn = document.getElementById('btn-submit-night-action');
        btn.disabled = false;
        btn.textContent = '決定する';
      };

      card.innerHTML = `
        <div class="wf-player-avatar">${renderAvatarHTML(p.avatar)}</div>
        <div class="wf-player-name">${escapeHtml(p.name)}</div>
      `;
      grid.appendChild(card);
    });
  }

  submitNightAction() {
    this.resolveNightActions();
  }

  resolveNightActions() {
    let wolfTarget = null;
    let guardTarget = null;
    let seerTarget = null;

    const me = this.players.find(p => p.id === 'p_me');
    if (me.isAlive && this.selectedTargetId) {
      if (this.myRole === 'wolf') wolfTarget = this.selectedTargetId;
      if (this.myRole === 'knight') guardTarget = this.selectedTargetId;
      if (this.myRole === 'seer') seerTarget = this.selectedTargetId;
    }

    this.players.filter(p => p.isAlive && p.isCpu).forEach(cpu => {
      const livingOthers = this.players.filter(p => p.isAlive && p.id !== cpu.id);
      if (cpu.role === 'wolf' && !wolfTarget) {
        const nonWolves = livingOthers.filter(p => p.role !== 'wolf');
        if (nonWolves.length > 0) wolfTarget = nonWolves[Math.floor(Math.random() * nonWolves.length)].id;
      }
      if (cpu.role === 'knight' && !guardTarget) {
        if (livingOthers.length > 0) guardTarget = livingOthers[Math.floor(Math.random() * livingOthers.length)].id;
      }
      if (cpu.role === 'seer' && !seerTarget) {
        if (livingOthers.length > 0) seerTarget = livingOthers[Math.floor(Math.random() * livingOthers.length)].id;
      }
    });

    if (this.myRole === 'seer' && seerTarget) {
      const targetP = this.players.find(p => p.id === seerTarget);
      const isWolf = targetP.role === 'wolf';
      showToast(`🔮 【占い結果】 ${targetP.name} は 『${isWolf ? '人狼 🐺 (黒)' : '市民 👱 (白)'}』 でした！`, isWolf ? 'error' : 'success');
    }

    let victim = null;
    if (wolfTarget && wolfTarget !== guardTarget) {
      victim = this.players.find(p => p.id === wolfTarget);
      if (victim) {
        victim.isAlive = false;
        this.nightResultMsg = `昨夜、${victim.name} さんが無惨な姿で発見されました... 💀`;
      }
    } else {
      this.nightResultMsg = `昨夜は恐ろしい遠吠えが響き渡りましたが、犠牲者は誰も居ませんでした！ ✨`;
    }

    this.startDayPhase();
  }

  startDayPhase() {
    this.phase = 'day_chat';
    document.getElementById('werewolf-phase-badge').textContent = `昼 議論 (${this.dayNum}日目)`;
    playSound('send');

    document.getElementById('wf-day-announce-text').textContent = this.nightResultMsg;

    if (this.checkWinCondition()) return;

    this.renderDayPlayerGrid();

    this.timerSeconds = 45;
    document.getElementById('werewolf-timer-display').classList.remove('hidden');
    document.getElementById('werewolf-timer-sec').textContent = this.timerSeconds;

    if (this.discussionTimer) clearInterval(this.discussionTimer);
    this.discussionTimer = setInterval(() => {
      this.timerSeconds--;
      document.getElementById('werewolf-timer-sec').textContent = this.timerSeconds;
      if (this.timerSeconds <= 0) {
        clearInterval(this.discussionTimer);
        this.startVotePhase();
      }
    }, 1000);

    this.addWfChatMessage('システム', `昼の議論を開始します (${this.timerSeconds}秒)。人狼と思われる人物について話し合ってください！`);
    this.simulateAiDiscussion();

    this.showScreen('werewolf-screen-day');
  }

  renderDayPlayerGrid() {
    const grid = document.getElementById('wf-day-player-grid');
    grid.innerHTML = '';

    this.players.forEach(p => {
      const card = document.createElement('div');
      card.className = `wf-player-card ${!p.isAlive ? 'dead' : ''}`;
      card.innerHTML = `
        <div class="wf-player-avatar">${renderAvatarHTML(p.avatar)}</div>
        <div class="wf-player-name">${escapeHtml(p.name)}</div>
        <div class="wf-player-status">${p.isAlive ? '🟢 生存' : '💀 死亡'}</div>
      `;
      grid.appendChild(card);
    });
  }

  addWfChatMessage(speakerName, text) {
    const box = document.getElementById('wf-chat-messages');
    if (!box) return;

    const line = document.createElement('div');
    line.className = 'wf-chat-line';
    line.innerHTML = `<span class="wf-speaker">${escapeHtml(speakerName)}:</span> <span>${escapeHtml(text)}</span>`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  simulateAiDiscussion() {
    const livingBots = this.players.filter(p => p.isAlive && p.isCpu);
    if (livingBots.length === 0) return;

    const speechTemplates = [
      "私市民です！みなさん誰が怪しいと思いますか？",
      "前日の発言から考えると、静かな人が怪しい気がします...",
      "私は白です！変な投票はやめましょう！",
      "人狼を探すために占い師の方はCO(宣言)してください！",
      "直感を信じて慎重に投票しましょう！"
    ];

    setTimeout(() => {
      if (this.phase !== 'day_chat') return;
      const bot = livingBots[Math.floor(Math.random() * livingBots.length)];
      const line = speechTemplates[Math.floor(Math.random() * speechTemplates.length)];
      this.addWfChatMessage(bot.name, line);
    }, 4000);

    setTimeout(() => {
      if (this.phase !== 'day_chat') return;
      const bot2 = livingBots[Math.floor(Math.random() * livingBots.length)];
      const targetP = this.players.filter(p => p.isAlive && p.id !== bot2.id)[0];
      if (targetP) {
        this.addWfChatMessage(bot2.name, `${targetP.name} さん、どう思われますか？`);
      }
    }, 12000);
  }

  sendUserWfChat() {
    const input = document.getElementById('wf-chat-input');
    const text = input.value.trim();
    if (!text) return;

    this.addWfChatMessage(myName || 'あなた', text);
    input.value = '';
  }

  skipDiscussionToVote() {
    if (this.discussionTimer) clearInterval(this.discussionTimer);
    this.startVotePhase();
  }

  startVotePhase() {
    this.phase = 'vote';
    this.selectedTargetId = null;
    document.getElementById('werewolf-phase-badge').textContent = '追放投票';
    document.getElementById('werewolf-timer-display').classList.add('hidden');
    playSound('receive');

    const me = this.players.find(p => p.id === 'p_me');
    const btnSubmit = document.getElementById('btn-submit-vote');

    if (!me.isAlive) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = '観戦中 (自動開票)';
      this.renderVoteTargets([]);
      setTimeout(() => this.resolveVotes(), 3000);
      this.showScreen('werewolf-screen-vote');
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = '投票を完了する';
    this.renderVoteTargets(this.players.filter(p => p.isAlive && p.id !== 'p_me'));
    this.showScreen('werewolf-screen-vote');
  }

  renderVoteTargets(targetablePlayers) {
    const grid = document.getElementById('wf-vote-target-grid');
    grid.innerHTML = '';

    targetablePlayers.forEach(p => {
      const card = document.createElement('div');
      card.className = `wf-player-card ${this.selectedTargetId === p.id ? 'selected' : ''}`;
      card.onclick = () => {
        this.selectedTargetId = p.id;
        document.querySelectorAll('#wf-vote-target-grid .wf-player-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const btn = document.getElementById('btn-submit-vote');
        btn.disabled = false;
      };

      card.innerHTML = `
        <div class="wf-player-avatar">${renderAvatarHTML(p.avatar)}</div>
        <div class="wf-player-name">${escapeHtml(p.name)}</div>
      `;
      grid.appendChild(card);
    });
  }

  resolveVotes() {
    const voteCounts = {};
    this.players.forEach(p => voteCounts[p.id] = 0);

    if (this.selectedTargetId) {
      voteCounts[this.selectedTargetId]++;
    }

    this.players.filter(p => p.isAlive && p.isCpu).forEach(cpu => {
      const candidates = this.players.filter(p => p.isAlive && p.id !== cpu.id);
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        voteCounts[target.id]++;
      }
    });

    let maxVotes = -1;
    let executedPlayer = null;

    Object.entries(voteCounts).forEach(([pid, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        executedPlayer = this.players.find(p => p.id === pid);
      }
    });

    if (executedPlayer) {
      executedPlayer.isAlive = false;
      showToast(`投票の結果、${executedPlayer.name} さんが追放されました (${maxVotes}票) 💀`, 'error');
    }

    if (!this.checkWinCondition()) {
      this.dayNum++;
      setTimeout(() => this.startNightPhase(), 2500);
    }
  }

  checkWinCondition() {
    const livingPlayers = this.players.filter(p => p.isAlive);
    const livingWolves = livingPlayers.filter(p => p.role === 'wolf');
    const livingHumans = livingPlayers.filter(p => p.role !== 'wolf');

    if (livingWolves.length === 0) {
      this.showResultScreen('villager');
      return true;
    } else if (livingWolves.length >= livingHumans.length) {
      this.showResultScreen('wolf');
      return true;
    }
    return false;
  }

  showResultScreen(winnerTeam) {
    this.phase = 'result';
    document.getElementById('werewolf-phase-badge').textContent = '決着！';
    document.getElementById('werewolf-timer-display').classList.add('hidden');
    playSound('fanfare');

    const banner = document.getElementById('wf-result-banner');
    const title = document.getElementById('wf-result-title');
    const subtitle = document.getElementById('wf-result-subtitle');

    if (winnerTeam === 'villager') {
      banner.className = 'result-banner';
      title.textContent = '🎉 市民陣営の完全勝利！';
      subtitle.textContent = '村に平和が戻りました！人狼を全員追放することに成功！';
    } else {
      banner.className = 'result-banner wolf-win';
      title.textContent = '🐺 人狼陣営の完全勝利！';
      subtitle.textContent = '村は人狼の支配下に落ちました... 闇が包み込みます。';
    }

    const list = document.getElementById('wf-result-player-list');
    list.innerHTML = '';

    this.players.forEach(p => {
      const rInfo = this.getRoleInfo(p.role);
      const row = document.createElement('div');
      row.className = 'result-player-row';
      row.innerHTML = `
        <div class="wf-player-avatar" style="width:36px; height:36px; font-size:1.2rem;">${renderAvatarHTML(p.avatar)}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:0.85rem;">${escapeHtml(p.name)} ${p.isAlive ? '🟢' : '💀'}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${rInfo.icon} ${rInfo.name} (${rInfo.team})</div>
        </div>
      `;
      list.appendChild(row);
    });

    this.showScreen('werewolf-screen-result');
  }

  shareResultToMainChat() {
    const winnerText = this.phase === 'result' ? document.getElementById('wf-result-title').textContent : '人狼ゲーム';
    const summary = `🐺 <strong>【サイバー人狼 ゲーム結果発表】</strong><br>${winnerText}<br>参加プレイヤー数: ${this.players.length}名 (${this.dayNum}日目で決着！)`;
    sendSpecialMessage('game', summary);
    showToast('結果をメインチャットに共有しました！', 'success');
  }
}

const werewolfEngine = new WerewolfGameEngine();

window.openWerewolfModal = () => {
  const modal = document.getElementById('werewolf-game-modal');
  if (modal) {
    werewolfEngine.initLobby();
    modal.classList.remove('hidden');
  }
};

function setupWerewolfGameControls() {
  const btnStart = document.getElementById('btn-start-werewolf-game');
  if (btnStart) btnStart.addEventListener('click', () => werewolfEngine.startNewGame());

  const btnConfirmRole = document.getElementById('btn-confirm-role');
  if (btnConfirmRole) btnConfirmRole.addEventListener('click', () => werewolfEngine.startNightPhase());

  const btnNightSubmit = document.getElementById('btn-submit-night-action');
  if (btnNightSubmit) btnNightSubmit.addEventListener('click', () => werewolfEngine.submitNightAction());

  const btnWfSendChat = document.getElementById('btn-wf-send-chat');
  if (btnWfSendChat) btnWfSendChat.addEventListener('click', () => werewolfEngine.sendUserWfChat());

  const wfChatInput = document.getElementById('wf-chat-input');
  if (wfChatInput) {
    wfChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') werewolfEngine.sendUserWfChat();
    });
  }

  const btnSkipDisc = document.getElementById('btn-wf-skip-discussion');
  if (btnSkipDisc) btnSkipDisc.addEventListener('click', () => werewolfEngine.skipDiscussionToVote());

  const btnSubmitVote = document.getElementById('btn-submit-vote');
  if (btnSubmitVote) btnSubmitVote.addEventListener('click', () => werewolfEngine.resolveVotes());

  const btnPlayAgain = document.getElementById('btn-wf-play-again');
  if (btnPlayAgain) btnPlayAgain.addEventListener('click', () => werewolfEngine.initLobby());

  const btnShareChat = document.getElementById('btn-wf-share-chat');
  if (btnShareChat) btnShareChat.addEventListener('click', () => werewolfEngine.shareResultToMainChat());

  const btnCloseWf = document.getElementById('btn-close-werewolf');
  if (btnCloseWf) {
    btnCloseWf.addEventListener('click', () => {
      document.getElementById('werewolf-game-modal').classList.add('hidden');
    });
  }
}

/* ==========================================================================
   🤝 Friend System Logic & Controls
   ========================================================================== */
function initFriendListeners() {
  if (unsubscribeFriendRequests) unsubscribeFriendRequests();
  if (unsubscribeFriends) unsubscribeFriends();

  if (!myUserId) return;

  unsubscribeFriendRequests = onValue(globalRef(`friend_requests/${myUserId}`), (snapshot) => {
    friendRequestsMap.clear();
    if (snapshot.exists()) {
      const reqs = snapshot.val();
      Object.entries(reqs).forEach(([reqUid, reqData]) => {
        friendRequestsMap.set(reqUid, reqData);
      });
    }
    renderFriendRequestsUI();
  });

  unsubscribeFriends = onValue(globalRef(`friends/${myUserId}`), (snapshot) => {
    friendsMap.clear();
    if (snapshot.exists()) {
      const fList = snapshot.val();
      Object.entries(fList).forEach(([fUid, fData]) => {
        friendsMap.set(fUid, fData);
      });
    }
    renderFriendsListUI();
  });
}

function renderFriendRequestsUI() {
  const badge = document.getElementById('friend-req-notify-badge');
  const cntSpan = document.getElementById('friend-req-cnt');
  const reqUl = document.getElementById('friend-req-ul');

  const count = friendRequestsMap.size;
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (cntSpan) cntSpan.textContent = count;

  if (!reqUl) return;
  reqUl.innerHTML = '';

  if (count === 0) {
    reqUl.innerHTML = '<li style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">届いているフレンド申請はありません</li>';
    return;
  }

  friendRequestsMap.forEach((reqData, fromUid) => {
    const li = document.createElement('li');
    li.className = 'friend-item-card';
    li.innerHTML = `
      <div class="avatar-sm">${renderAvatarHTML(reqData.fromAvatar)}</div>
      <div class="friend-item-info">
        <div class="friend-item-name">${escapeHtml(reqData.fromName)}</div>
        <div class="friend-item-status">フレンド申請が届いています</div>
      </div>
      <button class="btn-primary btn-sm" onclick="window.acceptFriendRequest('${fromUid}', '${escapeHtml(reqData.fromName)}', '${escapeHtml(reqData.fromAvatar)}')">承認</button>
      <button class="btn-secondary btn-sm danger" onclick="window.declineFriendRequest('${fromUid}')">拒否</button>
    `;
    reqUl.appendChild(li);
  });
}

function renderFriendsListUI() {
  const sidebarUl = document.getElementById('friends-sidebar-ul');
  const modalUl = document.getElementById('friend-modal-ul');
  const cntBadge = document.getElementById('friends-count-badge');
  const listCntSpan = document.getElementById('friend-list-cnt');

  const count = friendsMap.size;
  if (cntBadge) cntBadge.textContent = `${count}人`;
  if (listCntSpan) listCntSpan.textContent = count;

  if (sidebarUl) sidebarUl.innerHTML = '';
  if (modalUl) modalUl.innerHTML = '';

  if (count === 0) {
    if (sidebarUl) sidebarUl.innerHTML = '<li style="color:var(--text-muted); font-size:0.8rem; padding:6px 10px;">フレンドはいません</li>';
    if (modalUl) modalUl.innerHTML = '<li style="color:var(--text-muted); font-size:0.85rem; padding:16px; text-align:center;">まだフレンドはいません。「探す / 申請」タブから登録しましょう！</li>';
    return;
  }

  friendsMap.forEach((fData, fUid) => {
    const isOnline = activeUsersMap.has(fUid);

    if (sidebarUl) {
      const li = document.createElement('li');
      li.className = 'user-item';
      li.innerHTML = `
        <div class="avatar-sm">${renderAvatarHTML(fData.friendAvatar)}</div>
        <div class="user-item-info">
          <div class="user-item-name"><span class="friend-online-dot ${isOnline ? 'online' : 'offline'}"></span>${escapeHtml(fData.friendName)}</div>
          <div class="user-item-status">${isOnline ? '🟢 オンライン' : '⚪ オフライン'}</div>
        </div>
        <button class="btn-secondary btn-sm" onclick="window.startWhisper('${fUid}', '${escapeHtml(fData.friendName)}')" title="会話する"><i class="fa-solid fa-comments text-primary"></i></button>
      `;
      sidebarUl.appendChild(li);
    }

    if (modalUl) {
      const mLi = document.createElement('li');
      mLi.className = 'friend-item-card';
      mLi.innerHTML = `
        <div class="avatar-sm">${renderAvatarHTML(fData.friendAvatar)}</div>
        <div class="friend-item-info">
          <div class="friend-item-name"><span class="friend-online-dot ${isOnline ? 'online' : 'offline'}"></span>${escapeHtml(fData.friendName)}</div>
          <div class="friend-item-status">${isOnline ? '🟢 オンライン' : '⚪ オフライン'}</div>
        </div>
        <button class="btn-primary btn-sm" onclick="window.startWhisper('${fUid}', '${escapeHtml(fData.friendName)}'); document.getElementById('friend-modal').classList.add('hidden');"><i class="fa-solid fa-comments"></i> 会話する</button>
      `;
      modalUl.appendChild(mLi);
    }
  });
}

window.sendFriendRequest = async (targetUid, targetName) => {
  if (targetUid === myUserId) {
    showToast('自分自身にフレンド申請は送れません', 'error');
    return;
  }
  if (friendsMap.has(targetUid)) {
    showToast(`「${targetName}」さんは既にフレンドです！`, 'info');
    return;
  }

  try {
    await set(globalRef(`friend_requests/${targetUid}/${myUserId}`), {
      fromUserId: myUserId,
      fromName: myName,
      fromAvatar: myAvatar,
      timestamp: Date.now()
    });
    showToast(`「${targetName}」さんにフレンド申請を送信しました！`, 'success');
  } catch (e) {
    showToast('フレンド申請の送信に失敗しました', 'error');
  }
};

window.acceptFriendRequest = async (fromUid, fromName, fromAvatar) => {
  try {
    await set(globalRef(`friends/${myUserId}/${fromUid}`), {
      friendUserId: fromUid,
      friendName: fromName,
      friendAvatar: fromAvatar,
      addedAt: Date.now()
    });

    await set(globalRef(`friends/${fromUid}/${myUserId}`), {
      friendUserId: myUserId,
      friendName: myName,
      friendAvatar: myAvatar,
      addedAt: Date.now()
    });

    await remove(globalRef(`friend_requests/${myUserId}/${fromUid}`));

    playSound('fanfare');
    showToast(`🎉 「${fromName}」さんとフレンドになりました！`, 'success');
  } catch (e) {
    showToast('承認処理に失敗しました', 'error');
  }
};

window.declineFriendRequest = async (fromUid) => {
  try {
    await remove(globalRef(`friend_requests/${myUserId}/${fromUid}`));
    showToast('フレンド申請を辞退しました', 'info');
  } catch (e) {
    showToast('処理に失敗しました', 'error');
  }
};

function setupFriendModalControls() {
  const btnOpen = document.getElementById('btn-open-friend-modal');
  const modal = document.getElementById('friend-modal');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  }

  if (modal) {
    document.querySelectorAll('#friend-modal .modal-close').forEach(btn => {
      btn.addEventListener('click', () => modal.classList.add('hidden'));
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  document.querySelectorAll('.friend-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.friend-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.dataset.target;
      document.querySelectorAll('#friend-modal .friend-tab-content').forEach(c => c.classList.add('hidden'));
      const target = document.getElementById(targetId);
      if (target) target.classList.remove('hidden');
    });
  });

  const btnSendByName = document.getElementById('btn-send-friend-req-by-name');
  const searchInput = document.getElementById('friend-search-input');
  if (btnSendByName && searchInput) {
    btnSendByName.addEventListener('click', async () => {
      const targetName = searchInput.value.trim();
      if (!targetName) return;

      const key = sanitizeAccountKey(targetName);
      try {
        const snap = await get(globalRef(`accounts/${key}`));
        if (!snap.exists()) {
          showToast(`「${targetName}」というアカウントは見つかりませんでした`, 'error');
          return;
        }

        const accData = snap.val();
        await window.sendFriendRequest(accData.userId, accData.username);
        searchInput.value = '';
      } catch (e) {
        showToast('検索エラーが発生しました', 'error');
      }
    });
  }
}

/* ==========================================================================
   📱 Mobile Navigation Drawer Controls
   ========================================================================== */
function setupMobileNavigation() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const closeBtn = document.getElementById('btn-close-sidebar');

  const openDrawer = () => {
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
  };

  const closeDrawer = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  };

  if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);
}
