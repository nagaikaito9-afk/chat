// Global Application State Object
export const state = {
  myUserId: localStorage.getItem('cyberchat_user_id') || 'usr_' + Math.random().toString(36).substring(2, 10),
  myName: '',
  myTrip: '◆(なし)',
  myAvatar: localStorage.getItem('cyberchat_user_avatar') || '🤖',
  myStatus: '💬 雑談歓迎',
  myBubbleColor: localStorage.getItem('cyberchat_bubble_color') || '#00f0ff',
  myLevel: parseInt(localStorage.getItem('cyberchat_user_level') || '1'),
  myExp: parseInt(localStorage.getItem('cyberchat_user_exp') || '0'),
  lastExpMsgTime: 0,
  currentRoomId: 'public_main',
  unlockedRoomsSet: new Set(['public_main']),
  pendingPassRoom: null,

  friendsMap: new Map(),
  friendRequestsMap: new Map(),
  unsubscribeFriendRequests: null,
  unsubscribeFriends: null,

  deviceMode: localStorage.getItem('cyberchat_device_mode') || 'pc',
  currentTheme: localStorage.getItem('cyberchat_theme') || 'cyber',
  ultraLightweight: localStorage.getItem('cyberchat_ultra_lightweight') !== 'false',
  isAdminMode: localStorage.getItem('cyberchat_is_admin') === 'true',
  ADMIN_PASSWORD: "Unei-Senyou-Password-hatosabure371-hatosabure371-ta-da-no-cat-like-unei",
  trustedUsersSet: new Set(),
  adminUsersSet: new Set(),
  userEffectsMap: new Map(),

  globalOnlineUsersMap: new Map(),
  currentFriendChatUid: null,
  unsubscribeFriendChat: null,

  soundEnabled: true,
  isScrolledToBottom: true,
  unreadMessagesCount: 0,
  selectedFileObject: null,
  currentFilter: 'all',
  searchKeyword: '',
  allMessages: new Map(),
  activeUsersMap: new Map(),
  previousActiveUsersMap: null,
  bannedUsersMap: new Map(),
  ignoredUsersSet: new Set(JSON.parse(localStorage.getItem('cyberchat_ignored_users') || '[]')),
  starredMsgSet: new Set(JSON.parse(localStorage.getItem('cyberchat_starred_msgs') || '[]')),
  iceCandidateQueue: new Map(),

  activeMathQuizAnswer: null,

  heartbeatTimer: null,
  typingTimer: null,

  isScreenSharing: false,
  screenStream: null,
  screenFrameInterval: null,

  isSending: false,
  isSendingSpecial: false,

  unsubscribeActiveUsers: null,
  unsubscribeMessages: null,
  unsubscribeTyping: null,
  unsubscribeTopic: null,
  unsubscribeSignals: null,
  unsubscribeScreen: null,

  whisperTargetId: null,
  whisperTargetName: null,
  replyTargetId: null,
  replyTargetName: null,
  replyTargetText: null,

  isVoiceRoomJoined: false,
  isMicMuted: false,
  localAudioStream: null,
  mediaRecorder: null,
  recordedAudioChunks: [],
  voiceRecTimer: null,
  voiceRecSeconds: 0,
  peerConnections: new Map(),

  bgmAudioCtx: null,
  bgmOsc: null,
  bgmGain: null,
  isBgmPlaying: false,

  isPainting: false
};

// Persist user ID to LocalStorage
localStorage.setItem('cyberchat_user_id', state.myUserId);
