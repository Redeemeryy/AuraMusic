// AuraMusic (灵音) - App Logic
(function () {
  const state = {
    currentTrack: JSON.parse(localStorage.getItem('jelly_current_track') || 'null'),
    queue: JSON.parse(localStorage.getItem('jelly_queue') || '[]'),
    queueIndex: parseInt(localStorage.getItem('jelly_queue_index') || '-1', 10),
    queueTitle: localStorage.getItem('jelly_queue_title') || '当前播放列表',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playMode: 'sequence', // 'sequence', 'loop', 'shuffle'
    currentSource: 'mix',
    searchType: 'song', // 'song' or 'playlist'
    playerMode: 'vinyl', // 'vinyl' or 'lyrics'
    preferredQuality: localStorage.getItem('jelly_preferred_quality') || 'hires',
    currentQuality: localStorage.getItem('jelly_current_quality') || localStorage.getItem('jelly_preferred_quality') || 'hires',
    favorites: JSON.parse(localStorage.getItem('jelly_favs') || '[]'),
    favoritePlaylists: JSON.parse(localStorage.getItem('jelly_fav_playlists') || '[]'),
    history: JSON.parse(localStorage.getItem('jelly_history') || '[]'),
    dailyRecTracks: JSON.parse(localStorage.getItem('jelly_daily_rec_tracks') || '[]'),
    dailyRecDate: localStorage.getItem('jelly_daily_rec_date') || '',
    dailyRecSummary: JSON.parse(localStorage.getItem('jelly_daily_rec_summary') || 'null'),
    lyrics: [],
    currentLyricIndex: -1,
    isSeeking: false,
    isUserScrollingLyrics: false
  };

  // DOM Elements
  const el = {
    // Views
    views: {
      discover: document.getElementById('view-discover'),
      search: document.getElementById('view-search'),
      library: document.getElementById('view-library'),
      settings: document.getElementById('view-settings')
    },
    navItems: document.querySelectorAll('.nav-item'),

    // Search
    searchInput: document.getElementById('searchInput'),
    btnDoSearch: document.getElementById('btnDoSearch'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    searchTypeTabs: document.querySelectorAll('.search-type-tab'),
    sourceTabs: document.querySelectorAll('.source-tab'),
    hotSearchSection: document.getElementById('hotSearchSection'),
    hotSearchPills: document.getElementById('hotSearchPills'),
    searchLoading: document.getElementById('searchLoading'),
    searchResultsSection: document.getElementById('searchResultsSection'),
    searchResultsList: document.getElementById('searchResultsList'),
    searchPlaylistsList: document.getElementById('searchPlaylistsList'),
    searchResultCount: document.getElementById('searchResultCount'),

    // Discover & Library
    discoverRankList: document.getElementById('discoverRankList'),
    discoverPlaylists: document.getElementById('discoverPlaylists'),
    dailyRecCard: document.getElementById('dailyRecCard'),
    dailyRecBadgeText: document.getElementById('dailyRecBadgeText'),
    dailyRecDateTag: document.getElementById('dailyRecDateTag'),
    btnRefreshDailyRec: document.getElementById('btnRefreshDailyRec'),
    dailyRecHeaderClick: document.getElementById('dailyRecHeaderClick'),
    dailyCalendarMonth: document.getElementById('dailyCalendarMonth'),
    dailyCalendarDay: document.getElementById('dailyCalendarDay'),
    dailyRecTitle: document.getElementById('dailyRecTitle'),
    dailyRecSubtitle: document.getElementById('dailyRecSubtitle'),
    dailyRecTagsRow: document.getElementById('dailyRecTagsRow'),
    dailyRecTagsList: document.getElementById('dailyRecTagsList'),
    btnQuickPlayFeatured: document.getElementById('btnQuickPlayFeatured'),
    btnPlayAllDailyRecText: document.getElementById('btnPlayAllDailyRecText'),
    btnViewDailyRecDetail: document.getElementById('btnViewDailyRecDetail'),
    btnExpandDailyRec: document.getElementById('btnExpandDailyRec'),
    dailyRecPreviewContainer: document.getElementById('dailyRecPreviewContainer'),
    dailyRecPreviewList: document.getElementById('dailyRecPreviewList'),
    libraryPlaylistsList: document.getElementById('libraryPlaylistsList'),
    librarySongList: document.getElementById('librarySongList'),
    favSongCount: document.getElementById('favSongCount'),
    favPlaylistSummary: document.getElementById('favPlaylistSummary'),
    historyCount: document.getElementById('historyCount'),
    tabFavPlaylists: document.getElementById('tabFavPlaylists'),
    tabFavs: document.getElementById('tabFavs'),
    tabHistory: document.getElementById('tabHistory'),
    btnPlayAllFav: document.getElementById('btnPlayAllFav'),

    // Mini Player
    miniPlayer: document.getElementById('miniPlayer'),
    miniPlayerContent: document.getElementById('miniPlayerContent'),
    miniCover: document.getElementById('miniCover'),
    miniTitle: document.getElementById('miniTitle'),
    miniArtist: document.getElementById('miniArtist'),
    miniQualityBadge: document.getElementById('miniQualityBadge'),
    miniSourceTag: document.getElementById('miniSourceTag'),
    miniPlayBtn: document.getElementById('miniPlayBtn'),
    miniPlayIcon: document.getElementById('miniPlayIcon'),
    miniPrevBtn: document.getElementById('miniPrevBtn'),
    miniNextBtn: document.getElementById('miniNextBtn'),
    miniProgressBar: document.getElementById('miniProgressBar'),

    // Full Player
    fullPlayerOverlay: document.getElementById('fullPlayerOverlay'),
    btnCloseFullPlayer: document.getElementById('btnCloseFullPlayer'),
    fullCover: document.getElementById('fullCover'),
    vinylDisc: document.getElementById('vinylDisc'),
    vinylStage: document.getElementById('vinylStage'),
    vinylTonearm: document.getElementById('vinylTonearm'),
    vinylAura: document.getElementById('vinylAura'),
    playerWaveIndicator: document.getElementById('playerWaveIndicator'),
    lyricsStage: document.getElementById('lyricsStage'),
    fullTitle: document.getElementById('fullTitle'),
    fullArtist: document.getElementById('fullArtist'),
    fullSourceLabel: document.getElementById('fullSourceLabel'),
    fullQualityPill: document.getElementById('fullQualityPill'),
    fullQualityText: document.getElementById('fullQualityText'),
    btnFavCurrent: document.getElementById('btnFavCurrent'),
    favHeartIcon: document.getElementById('favHeartIcon'),
    favHeartText: document.getElementById('favHeartText'),
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    progressThumb: document.getElementById('progressThumb'),
    currentTime: document.getElementById('currentTime'),
    totalDuration: document.getElementById('totalDuration'),
    btnPlayMode: document.getElementById('btnPlayMode'),
    playModeIcon: document.getElementById('playModeIcon'),
    btnPlayPause: document.getElementById('btnPlayPause'),
    fullPlayIcon: document.getElementById('fullPlayIcon'),
    btnPrev: document.getElementById('btnPrev'),
    btnNext: document.getElementById('btnNext'),
    btnPlaylistQueue: document.getElementById('btnPlaylistQueue'),
    btnToggleLyrics: document.getElementById('btnToggleLyrics'),
    flipStageIcon: document.getElementById('flipStageIcon'),
    btnFlipStage: document.getElementById('btnFlipStage'),
    btnFlipStageIcon: document.getElementById('btnFlipStageIcon'),
    btnFlipStageText: document.getElementById('btnFlipStageText'),
    btnComments: document.getElementById('btnComments'),
    commentCountBadge: document.getElementById('commentCountBadge'),

    // Lyrics
    lyricsScrollContainer: document.getElementById('lyricsScrollContainer'),
    lyricsTimelineGuide: document.getElementById('lyricsTimelineGuide'),
    lyricsTimelineTime: document.getElementById('lyricsTimelineTime'),
    btnLyricsTimelinePlay: document.getElementById('btnLyricsTimelinePlay'),

    // Modals
    playlistDetailOverlay: document.getElementById('playlistDetailOverlay'),
    btnClosePlaylistDetail: document.getElementById('btnClosePlaylistDetail'),
    btnPlayAllPlaylist: document.getElementById('btnPlayAllPlaylist'),
    btnFavPlaylist: document.getElementById('btnFavPlaylist'),
    favPlaylistIcon: document.getElementById('favPlaylistIcon'),
    favPlaylistText: document.getElementById('favPlaylistText'),
    btnExportPlaylist: document.getElementById('btnExportPlaylist'),
    btnOpenImportPlaylist: document.getElementById('btnOpenImportPlaylist'),
    importPlaylistOverlay: document.getElementById('importPlaylistOverlay'),
    btnCloseImportPlaylist: document.getElementById('btnCloseImportPlaylist'),
    btnChoosePlaylistFile: document.getElementById('btnChoosePlaylistFile'),
    playlistFileInput: document.getElementById('playlistFileInput'),
    btnImportFromClipboard: document.getElementById('btnImportFromClipboard'),
    inputImportPlaylistName: document.getElementById('inputImportPlaylistName'),
    textareaImportContent: document.getElementById('textareaImportContent'),
    btnConfirmTextImport: document.getElementById('btnConfirmTextImport'),
    importStatusCard: document.getElementById('importStatusCard'),
    importStatusTitle: document.getElementById('importStatusTitle'),
    importStatusDesc: document.getElementById('importStatusDesc'),
    plDetailCover: document.getElementById('plDetailCover'),
    plDetailTitle: document.getElementById('plDetailTitle'),
    plDetailAuthor: document.getElementById('plDetailAuthor'),
    plDetailCount: document.getElementById('plDetailCount'),
    plDetailSourceBadge: document.getElementById('plDetailSourceBadge'),
    plDetailTracksList: document.getElementById('plDetailTracksList'),

    commentsOverlay: document.getElementById('commentsOverlay'),
    btnCloseComments: document.getElementById('btnCloseComments'),
    commentsList: document.getElementById('commentsList'),
    commentsSongTitle: document.getElementById('commentsSongTitle'),

    queueOverlay: document.getElementById('queueOverlay'),
    btnCloseQueue: document.getElementById('btnCloseQueue'),
    btnClearQueue: document.getElementById('btnClearQueue'),
    queueList: document.getElementById('queueList'),
    queueTotalCount: document.getElementById('queueTotalCount'),
    queueSourceTag: document.getElementById('queueSourceTag'),
    btnQueuePlayMode: document.getElementById('btnQueuePlayMode'),
    queuePlayModeIcon: document.getElementById('queuePlayModeIcon'),
    queuePlayModeText: document.getElementById('queuePlayModeText'),

    // Quality Picker Modal
    qualityModalOverlay: document.getElementById('qualityModalOverlay'),
    btnCloseQualityModal: document.getElementById('btnCloseQualityModal'),
    qualityOptionsList: document.getElementById('qualityOptionsList'),
    qualityPickerOptions: document.querySelectorAll('.quality-picker-option'),

    // Header Source Badge
    headerSourceBadge: document.getElementById('headerSourceBadge'),
    headerSourceDot: document.getElementById('headerSourceDot'),
    headerSourceText: document.getElementById('headerSourceText'),

    // Discover Banner
    discoverNoSourceBanner: document.getElementById('discoverNoSourceBanner'),
    btnDiscoverOpenPlugin: document.getElementById('btnDiscoverOpenPlugin'),

    // Plugin Manager Modal & Settings
    btnOpenPluginManager: document.getElementById('btnOpenPluginManager'),
    btnOpenPluginManagerText: document.getElementById('btnOpenPluginManagerText'),
    settingsPluginIconBg: document.getElementById('settingsPluginIconBg'),
    settingsPluginIcon: document.getElementById('settingsPluginIcon'),
    settingsPluginStatusText: document.getElementById('settingsPluginStatusText'),
    settingsPluginDot: document.getElementById('settingsPluginDot'),
    settingsPluginBadge: document.getElementById('settingsPluginBadge'),
    settingsPluginDesc: document.getElementById('settingsPluginDesc'),

    pluginModalOverlay: document.getElementById('pluginModalOverlay'),
    btnClosePluginModal: document.getElementById('btnClosePluginModal'),
    btnCheckPluginUpdate: document.getElementById('btnCheckPluginUpdate'),
    btnReloadPlugin: document.getElementById('btnReloadPlugin'),
    btnUninstallPlugin: document.getElementById('btnUninstallPlugin'),
    pluginActiveIconBg: document.getElementById('pluginActiveIconBg'),
    pluginActiveIcon: document.getElementById('pluginActiveIcon'),
    pluginActiveName: document.getElementById('pluginActiveName'),
    pluginActiveStatusTag: document.getElementById('pluginActiveStatusTag'),
    pluginActiveVersion: document.getElementById('pluginActiveVersion'),
    pluginActiveDesc: document.getElementById('pluginActiveDesc'),
    pluginActivePlatforms: document.getElementById('pluginActivePlatforms'),
    pluginActiveActions: document.getElementById('pluginActiveActions'),
    pluginDangerActions: document.getElementById('pluginDangerActions'),

    pluginUpdateCard: document.getElementById('pluginUpdateCard'),
    pluginUpdateStatusText: document.getElementById('pluginUpdateStatusText'),
    pluginUpdateNotes: document.getElementById('pluginUpdateNotes'),
    btnOpenUpdateUrl: document.getElementById('btnOpenUpdateUrl'),
    btnOpenUpdateUrlText: document.getElementById('btnOpenUpdateUrlText'),

    pluginNoticeOverlay: document.getElementById('pluginNoticeOverlay'),
    pluginNoticeCard: document.getElementById('pluginNoticeCard'),
    pluginNoticeIcon: document.getElementById('pluginNoticeIcon'),
    pluginNoticeTitle: document.getElementById('pluginNoticeTitle'),
    pluginNoticeSubtitle: document.getElementById('pluginNoticeSubtitle'),
    pluginNoticeCurrentVer: document.getElementById('pluginNoticeCurrentVer'),
    pluginNoticeNewVer: document.getElementById('pluginNoticeNewVer'),
    pluginNoticeMsg: document.getElementById('pluginNoticeMsg'),
    pluginNoticeProgressCard: document.getElementById('pluginNoticeProgressCard'),
    pluginNoticeProgressText: document.getElementById('pluginNoticeProgressText'),
    pluginNoticeActionBtns: document.getElementById('pluginNoticeActionBtns'),
    btnCancelPluginUpdate: document.getElementById('btnCancelPluginUpdate'),
    btnConfirmPluginUpdate: document.getElementById('btnConfirmPluginUpdate'),
    btnOpenPluginUpdateBrowser: document.getElementById('btnOpenPluginUpdateBrowser'),

    inputPluginFile: document.getElementById('inputPluginFile'),
    btnImportFromFile: document.getElementById('btnImportFromFile'),
    inputPluginUrl: document.getElementById('inputPluginUrl'),
    btnImportFromUrl: document.getElementById('btnImportFromUrl'),
    inputPluginCode: document.getElementById('inputPluginCode'),
    btnImportFromCode: document.getElementById('btnImportFromCode'),

    // Settings
    qualityButtons: document.querySelectorAll('.quality-btn'),
    btnClearCache: document.getElementById('btnClearCache')
  };

  // Format mm:ss
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Liquid Jelly Dynamic Capsule Toast (灵动果冻胶囊提示)
  const toastContainer = document.getElementById('jellyToastContainer');
  function toast(msg, customIcon = null, duration = 2200) {
    if (!msg) return;
    if (!toastContainer) {
      console.log('[TOAST]', msg);
      return;
    }

    // Determine icon and color scheme based on message content
    let icon = customIcon || 'auto_awesome';
    let iconBg = 'from-primary to-primary-container';
    let isSpin = false;

    if (msg.includes('解析') || msg.includes('加载') || msg.includes('正在')) {
      icon = 'motion_photos_on';
      iconBg = 'from-blue-600 to-indigo-600';
      isSpin = true;
    } else if (msg.includes('喜欢') || msg.includes('收藏') || msg.includes('爱心')) {
      icon = 'favorite';
      iconBg = 'from-rose-500 to-pink-500';
    } else if (msg.includes('取消') || msg.includes('清空') || msg.includes('移除') || msg.includes('删除')) {
      icon = 'delete_sweep';
      iconBg = 'from-slate-600 to-zinc-700';
    } else if (msg.includes('单曲循环')) {
      icon = 'repeat_one';
      iconBg = 'from-indigo-500 to-purple-600';
    } else if (msg.includes('随机播放')) {
      icon = 'shuffle';
      iconBg = 'from-violet-500 to-fuchsia-600';
    } else if (msg.includes('顺序播放')) {
      icon = 'repeat';
      iconBg = 'from-sky-500 to-blue-600';
    } else if (msg.includes('播放') || msg.includes('开始') || msg.includes('畅听')) {
      icon = 'play_arrow';
      iconBg = 'from-emerald-500 to-teal-600';
    } else if (msg.includes('音质') || msg.includes('无损') || msg.includes('FLAC')) {
      icon = 'graphic_eq';
      iconBg = 'from-amber-500 to-orange-600';
    } else if (msg.includes('失败') || msg.includes('错误') || msg.includes('异常') || msg.includes('超时')) {
      icon = 'error';
      iconBg = 'from-red-500 to-rose-600';
    }

    // Keep max 2 active toasts to avoid stacking clutter
    while (toastContainer.children.length >= 2) {
      toastContainer.removeChild(toastContainer.firstChild);
    }

    const pill = document.createElement('div');
    pill.className = 'jelly-toast-pill jelly-glass-solid px-4 py-2 rounded-full flex items-center gap-2.5 shadow-2xl border border-white/90 backdrop-blur-2xl pointer-events-auto active-squish cursor-pointer transform transition-all duration-300 animate-toast-in';
    pill.innerHTML = `
      <div class="w-6 h-6 rounded-full bg-gradient-to-tr ${iconBg} flex items-center justify-center text-white flex-shrink-0 shadow-sm">
        <span class="material-symbols-outlined text-[15px] ${isSpin ? 'animate-spin' : ''}">${icon}</span>
      </div>
      <span class="text-[13px] font-bold text-on-surface tracking-tight">${escapeHtml(msg)}</span>
    `;

    pill.addEventListener('click', () => dismissPill(pill));
    toastContainer.appendChild(pill);

    const timer = setTimeout(() => {
      dismissPill(pill);
    }, duration);

    function dismissPill(el) {
      clearTimeout(timer);
      el.classList.remove('animate-toast-in');
      el.classList.add('animate-toast-out');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }
  }

  window.toast = toast;

  // Native Edge-to-Edge & System Insets Adaptation (Vivo X200 Pro mini / Xiaomi 13 Ultra)
  window.applyNativeInsets = function(topDp, bottomDp, leftDp, rightDp) {
    if (typeof topDp === 'number' && topDp > 0) {
      document.documentElement.style.setProperty('--safe-top', `${topDp}px`);
    }
    if (typeof bottomDp === 'number' && bottomDp >= 0) {
      document.documentElement.style.setProperty('--safe-bottom', `${bottomDp}px`);
    }
    if (typeof leftDp === 'number' && leftDp >= 0) {
      document.documentElement.style.setProperty('--safe-left', `${leftDp}px`);
    }
    if (typeof rightDp === 'number' && rightDp >= 0) {
      document.documentElement.style.setProperty('--safe-right', `${rightDp}px`);
    }
  };

  try {
    if (window.AndroidBridge && typeof window.AndroidBridge.getSystemInsets === 'function') {
      const insets = JSON.parse(window.AndroidBridge.getSystemInsets());
      if (insets) {
        window.applyNativeInsets(insets.top, insets.bottom, insets.left, insets.right);
      }
    }
  } catch (e) {}

  // Navigation Switching
  function switchView(viewName) {
    if (!el.views[viewName]) return;
    Object.keys(el.views).forEach(key => {
      if (el.views[key]) el.views[key].classList.toggle('active', key === viewName);
    });
    el.navItems.forEach(item => {
      const active = item.getAttribute('data-view') === viewName;
      item.classList.toggle('text-primary', active);
      item.classList.toggle('font-bold', active);
      item.classList.toggle('text-on-surface-variant', !active);
    });
    try {
      localStorage.setItem('jelly_active_view', viewName);
    } catch (e) {}
    if (viewName === 'settings') {
      state.preferredQuality = localStorage.getItem('jelly_preferred_quality') || 'hires';
      syncQualityUI();
    } else if (viewName === 'library') {
      renderLibrary();
    }
  }

  el.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });

  // Search Type Switcher (单曲 vs 歌单)
  el.searchTypeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.getAttribute('data-type');
      state.searchType = type;
      el.searchTypeTabs.forEach(t => {
        const isActive = t.getAttribute('data-type') === type;
        t.className = isActive 
          ? 'search-type-tab text-[13px] font-bold text-primary active-squish flex items-center gap-1'
          : 'search-type-tab text-[13px] font-semibold text-on-surface-variant hover:text-on-surface active-squish flex items-center gap-1';
      });
      if (type === 'song') {
        el.searchResultsList.classList.remove('hidden');
        el.searchPlaylistsList.classList.add('hidden');
      } else {
        el.searchResultsList.classList.add('hidden');
        el.searchPlaylistsList.classList.remove('hidden');
      }
      if (el.searchInput.value.trim()) {
        performSearch(el.searchInput.value.trim());
      }
    });
  });

  // Source Tabs in Search (Bug 2)
  el.sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      el.sourceTabs.forEach(t => {
        t.className = 'source-tab px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-white/70 text-on-surface-variant hover:text-on-surface whitespace-nowrap active-squish';
      });
      tab.className = 'source-tab px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-primary text-white shadow-sm whitespace-nowrap active-squish';
      state.currentSource = tab.getAttribute('data-source');
      
      const sourceName = tab.textContent.trim();
      const currentQuery = el.searchInput.value.trim();
      const query = currentQuery || '热歌';
      if (!currentQuery) {
        el.searchInput.value = '热歌';
        el.btnClearSearch.classList.remove('hidden');
      }
      performSearch(query);
    });
  });

  window.performSearch = performSearch;
  window.switchView = switchView;

  // Perform Search (Songs or Playlists)
  async function performSearch(query) {
    console.log('[APP] performSearch called with query:', query, 'type:', state.searchType);
    if (!query) return;
    if (!window.MusicAPI || !window.MusicAPI.initialized) {
      toast('尚未导入音乐源插件，请先导入音源');
      openPluginModal();
      return;
    }
    el.hotSearchSection.classList.add('hidden');
    el.searchResultsSection.classList.remove('hidden');
    el.searchLoading.classList.remove('hidden');

    if (state.searchType === 'playlist') {
      el.searchResultsList.classList.add('hidden');
      el.searchPlaylistsList.classList.remove('hidden');
      el.searchPlaylistsList.innerHTML = '';
      try {
        const res = await window.MusicAPI.searchPlaylists(query, state.currentSource, 1, 20);
        el.searchLoading.classList.add('hidden');
        const items = res.items || [];
        el.searchResultCount.textContent = `命中 ${items.length} 个歌单 (${state.currentSource.toUpperCase()})`;
        if (items.length === 0) {
          el.searchPlaylistsList.innerHTML = '<div class="col-span-2 text-center py-8 text-[13px] text-outline">未找到相关歌单，请尝试更换关键词或平台</div>';
          return;
        }
        items.forEach(pl => {
          const card = createPlaylistCard(pl, () => {
            openPlaylistDetail(pl.ref, {
              title: pl.title,
              author: pl.subtitle || pl.playlist?.author || '未知作者',
              artworkUrl: pl.playlist?.artworkUrl || pl.artworkUrl,
              trackCount: pl.playlist?.trackCount
            });
          });
          el.searchPlaylistsList.appendChild(card);
        });
      } catch (err) {
        el.searchLoading.classList.add('hidden');
        el.searchPlaylistsList.innerHTML = `<div class="col-span-2 text-center py-8 text-[13px] text-red-500">搜索歌单出错: ${err.message || '网络超时'}</div>`;
      }
    } else {
      el.searchResultsList.classList.remove('hidden');
      el.searchPlaylistsList.classList.add('hidden');
      el.searchResultsList.innerHTML = '';
      try {
        const res = await window.MusicAPI.search(query, state.currentSource, 1, 30);
        el.searchLoading.classList.add('hidden');
        const items = res.items || [];
        el.searchResultCount.textContent = `命中 ${items.length} 条曲目 (${state.currentSource.toUpperCase()})`;
        if (items.length === 0) {
          el.searchResultsList.innerHTML = '<div class="text-center py-8 text-[13px] text-outline">未找到相关歌曲，请尝试切换音源平台</div>';
          return;
        }
        items.forEach(track => {
          const itemEl = createTrackItem(track, () => {
            playSearchedTrack(track);
          });
          el.searchResultsList.appendChild(itemEl);
        });
      } catch (err) {
        el.searchLoading.classList.add('hidden');
        el.searchResultsList.innerHTML = `<div class="text-center py-8 text-[13px] text-red-500">搜索发生错误: ${err.message || '网络连接超时'}</div>`;
      }
    }
  }

  // Dynamic Inline SVG Gradient Album Cover (100% offline, never 404s, beautiful jelly aesthetic)
  function hashCode(str) {
    let hash = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function escapeXml(str) {
    return String(str || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
  }

  function createFallbackCover(title = 'Music', artist = 'AuraMusic') {
    const cleanTitle = (title || 'Music').trim().slice(0, 10);
    const cleanArtist = (artist || 'AuraMusic').trim().slice(0, 14);
    const hue1 = Math.abs(hashCode(cleanTitle + cleanArtist)) % 360;
    const hue2 = (hue1 + 65) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <defs>
        <linearGradient id="g_${hue1}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hue1}, 85%, 60%)"/>
          <stop offset="100%" stop-color="hsl(${hue2}, 90%, 45%)"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#g_${hue1})" rx="32"/>
      <circle cx="150" cy="150" r="105" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="6"/>
      <circle cx="150" cy="150" r="75" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4"/>
      <circle cx="150" cy="150" r="45" fill="rgba(255,255,255,0.25)"/>
      <path d="M140 130 v30 a10 10 0 1 1 -8 -9.8 v-26.2 h20 v24 a10 10 0 1 1 -8 -9.8 v-18.2 z" fill="#ffffff"/>
      <text x="150" y="242" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="bold" font-size="20" text-anchor="middle" opacity="0.95">${escapeXml(cleanTitle)}</text>
      <text x="150" y="268" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="500" font-size="13" text-anchor="middle" opacity="0.8">${escapeXml(cleanArtist)}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function resolveTrackArtwork(track) {
    if (!track) return createFallbackCover();
    const title = track.title || 'Music';
    const artist = track.metadata?.artists?.[0] || track.subtitle || 'AuraMusic';
    
    let url = track.metadata?.artworkUrl || track.artworkUrl || track.song?.img || track.data?.song?.img || track.data?.album_img || track.raw?.img || track.raw?.pic;
    if (typeof url === 'string') {
      url = url.trim();
      if (url.startsWith('http://')) {
        url = 'https://' + url.slice(7);
      }
      if (url.includes('T002R500x500M000.jpg') || url.includes('M0000000000000') || url.includes('{size}') || url === 'https://' || url.length < 12) {
        return createFallbackCover(title, artist);
      }
      return url;
    }
    return createFallbackCover(title, artist);
  }

  // Create Playlist Card
  function createPlaylistCard(pl, onClick, options = {}) {
    const div = document.createElement('div');
    div.className = 'jelly-glass rounded-2xl p-2.5 flex flex-col gap-2 cursor-pointer active-squish shadow-sm hover:shadow-md transition-all relative';
    const title = pl.title || '歌单';
    const author = pl.playlist?.author || pl.subtitle || pl.author || '精选推荐';
    const fallback = createFallbackCover(title, author);
    const artwork = pl.playlist?.artworkUrl || pl.artworkUrl || fallback;
    const count = pl.playlist?.trackCount ? `${pl.playlist.trackCount} 首` : (pl.tracks?.length ? `${pl.tracks.length} 首` : '');
    const source = pl.ref?.providerId?.toUpperCase() || 'TX';
    const isLibraryCard = options.isLibraryCard === true;

    div.innerHTML = `
      <div class="relative w-full aspect-square rounded-xl overflow-hidden bg-primary/10">
        <img src="${artwork}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${fallback}'" />
        <div class="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[9px] font-bold text-white uppercase">${source}</div>
        ${isLibraryCard ? `
          <button class="btn-card-unfav absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-red-500 active:scale-90 shadow-sm" title="取消收藏">
            <span class="material-symbols-outlined text-[16px] text-red-500 fill-1">favorite</span>
          </button>
        ` : ''}
        ${count ? `<div class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[9px] font-medium text-white flex items-center gap-0.5"><span class="material-symbols-outlined text-[11px]">music_note</span><span>${count}</span></div>` : ''}
      </div>
      <div class="flex flex-col min-w-0">
        <h4 class="text-[13px] font-bold text-on-surface line-clamp-2 leading-snug">${escapeHtml(title)}</h4>
        <p class="text-[11px] text-on-surface-variant truncate mt-0.5">${escapeHtml(author)}</p>
      </div>
    `;

    if (isLibraryCard) {
      const unfavBtn = div.querySelector('.btn-card-unfav');
      if (unfavBtn) {
        unfavBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pid = pl.ref?.id || pl.id;
          const pTitle = (pl.title || '').trim().toLowerCase();
          state.favoritePlaylists = state.favoritePlaylists.filter(item => {
            const savedId = item.ref?.id || item.id;
            if (pid && savedId && pid === savedId) return false;
            if (pTitle && item.title && item.title.trim().toLowerCase() === pTitle) return false;
            return true;
          });
          try {
            localStorage.setItem('jelly_fav_playlists', JSON.stringify(state.favoritePlaylists));
          } catch (err) {}
          toast('已取消收藏歌单');
          updatePlaylistFavButton();
          renderLibrary();
        });
      }
    }

    div.addEventListener('click', onClick);
    return div;
  }

  // Create Song List Item
  function createTrackItem(track, onClick, options = {}) {
    const div = document.createElement('div');
    div.className = 'jelly-glass rounded-2xl p-3 flex items-center justify-between gap-3 active-squish cursor-pointer shadow-sm';
    
    const artists = track.metadata?.artists ? track.metadata.artists.join(' / ') : (track.subtitle || '未知艺术家');
    const album = track.metadata?.album?.title || '';
    const rawQualities = (track.metadata?.qualities || ['128k']).map(q => String(q).toLowerCase());
    const isHiRes = rawQualities.some(q => ['master', 'hires', 'atmos_plus', 'atmos', 'flac24bit'].includes(q));
    const isFlac = !isHiRes && rawQualities.includes('flac');
    const bestQuality = isHiRes ? 'Hi-Res' : (isFlac ? 'FLAC' : (rawQualities.includes('320k') ? '320K' : '128K'));
    const qualityBadgeClass = isHiRes
      ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
      : (isFlac ? 'bg-secondary-container/50 text-secondary' : 'bg-primary/10 text-primary');
    const artwork = resolveTrackArtwork(track);
    const fallbackArtwork = createFallbackCover(track.title, artists);
    const sourceName = track.ref?.providerId?.toUpperCase() || 'TX';
    const showFavBtn = options.showFavBtn === true;

    div.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="w-11 h-11 rounded-xl bg-primary/10 overflow-hidden flex-shrink-0 relative">
          <img src="${artwork}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${fallbackArtwork}'" />
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="text-[14px] font-bold text-on-surface truncate">${escapeHtml(track.title)}</span>
            <span class="px-1 py-0.2 rounded text-[9px] font-bold ${qualityBadgeClass} uppercase">${bestQuality}</span>
            ${track._recTag ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 flex-shrink-0">${escapeHtml(track._recTag)}</span>` : ''}
          </div>
          <div class="text-[12px] text-on-surface-variant truncate mt-0.5">
            ${escapeHtml(artists)}${album ? ' • ' + escapeHtml(album) : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        ${showFavBtn ? `
          <button class="btn-item-unfav w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 active:scale-90" title="取消收藏">
            <span class="material-symbols-outlined text-[20px] text-red-500 fill-1">favorite</span>
          </button>
        ` : `
          <span class="text-[10px] font-bold text-outline uppercase">${sourceName}</span>
        `}
        <button class="w-8 h-8 rounded-full flex items-center justify-center text-primary active:scale-90">
          <span class="material-symbols-outlined text-[20px]">play_circle</span>
        </button>
      </div>
    `;

    if (showFavBtn) {
      const unfavBtn = div.querySelector('.btn-item-unfav');
      if (unfavBtn) {
        unfavBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFavoriteTrack(track, false);
        });
      }
    }

    div.addEventListener('click', onClick);
    return div;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  // Standard Quality Tiers (Level 4: Hi-Res/母带 -> Level 3: FLAC无损 -> Level 2: 320K高清 -> Level 1: 128K标准)
  const QUALITY_TIER_CONFIG = [
    { tier: 4, key: 'hires', name: 'Hi-Res 母带', codes: ['master', 'hires', 'atmos_plus', 'atmos', 'flac24bit'] },
    { tier: 3, key: 'flac', name: 'FLAC 无损', codes: ['flac'] },
    { tier: 2, key: '320k', name: '320K 高清', codes: ['320k', '192k'] },
    { tier: 1, key: '128k', name: '128K 标准', codes: ['128k', 'low'] }
  ];

  function getPreferredTier(pref) {
    const p = String(pref || 'hires').toLowerCase().trim();
    if (['hires', 'master', 'atmos', 'atmos_plus', 'flac24bit'].includes(p)) return 4;
    if (p === 'flac' || p === 'lossless') return 3;
    if (['320k', '192k', 'standard'].includes(p)) return 2;
    return 1;
  }

  // Construct tiered resolution candidate sequence with graceful automatic fallback
  function buildCandidateQualities(preferredQuality, availableQualities = []) {
    const targetTier = getPreferredTier(preferredQuality);
    const availList = Array.isArray(availableQualities)
      ? availableQualities.map(q => String(q).trim().toLowerCase()).filter(Boolean)
      : [];
    const availSet = new Set(availList);

    // Degradation fallback tier priority based on user target preference:
    // e.g. Tier 4 (Master) -> Tier 3 (FLAC) -> Tier 2 (320K) -> Tier 1 (128K)
    let tierOrder = [];
    if (targetTier === 4) {
      tierOrder = [4, 3, 2, 1];
    } else if (targetTier === 3) {
      tierOrder = [3, 2, 1, 4];
    } else if (targetTier === 2) {
      tierOrder = [2, 1, 3, 4];
    } else {
      tierOrder = [1, 2, 3, 4];
    }

    const candidates = [];
    const added = new Set();

    function pushCode(code) {
      if (code && !added.has(code)) {
        added.add(code);
        candidates.push(code);
      }
    }

    // 1. If availableQualities is declared, strictly select available codes in descending tier order!
    // This guarantees that if a song lacks Master, it immediately falls back to FLAC/320K
    // without attempting un-available qualities that throw errors.
    if (availSet.size > 0) {
      for (const t of tierOrder) {
        const tierDef = QUALITY_TIER_CONFIG.find(item => item.tier === t);
        if (tierDef) {
          for (const c of tierDef.codes) {
            if (availSet.has(c)) pushCode(c);
          }
        }
      }
      // Any custom declared quality not in tier definitions
      for (const q of availList) {
        pushCode(q);
      }
    }

    // 2. Safety net fallback: all standard codes in descending tier order (in case metadata is missing/incomplete)
    for (const t of tierOrder) {
      const tierDef = QUALITY_TIER_CONFIG.find(item => item.tier === t);
      if (tierDef) {
        for (const c of tierDef.codes) {
          pushCode(c);
        }
      }
    }

    return candidates;
  }

  // Predict the best available quality for a track before streaming begins
  function predictBestQuality(preferredQuality, availableQualities = []) {
    const candidates = buildCandidateQualities(preferredQuality, availableQualities);
    return candidates[0] || preferredQuality || '320k';
  }

  // Robust stream resolver with graceful fallback
  async function resolveStreamWithFallback(trackOrRef, preferredQuality, availableQualities = []) {
    const candidates = buildCandidateQualities(preferredQuality, availableQualities);
    console.log('[APP] Resolving stream with candidate ladder:', candidates);

    const ref = {
      ...(trackOrRef.ref || trackOrRef),
      id: trackOrRef.ref?.id || trackOrRef.id,
      providerId: trackOrRef.ref?.providerId || trackOrRef.source || 'tx',
      title: trackOrRef.title || trackOrRef.name,
      subtitle: trackOrRef.subtitle || trackOrRef.singer,
      metadata: trackOrRef.metadata,
      data: trackOrRef.data,
      raw: trackOrRef.data?.song || trackOrRef.raw
    };

    let lastError = null;
    for (const q of candidates) {
      try {
        const res = await window.MusicAPI.resolve(ref, q);
        if (res && res.url && typeof res.url === 'string') {
          const u = res.url.trim();
          if (u.length > 30 && !u.endsWith('.tc.qq.com/') && !u.endsWith('/')) {
            return {
              ...res,
              url: u,
              actualQuality: res.actualQuality || q
            };
          }
        }
      } catch (e) {
        console.warn(`[APP] Quality ${q} unavailable, gracefully falling back:`, e.message);
        lastError = e;
      }
    }

    // Fallback: If track has title & artist (e.g. from text import or missing id), search and resolve
    if (ref.title) {
      try {
        const query = `${ref.title} ${ref.subtitle || ''}`.trim();
        console.log('[APP] Attempting search fallback for:', query);
        const searchRes = await window.MusicAPI.search(query, 'mix', 1, 5);
        if (searchRes && searchRes.items && searchRes.items.length > 0) {
          const matchedTrack = searchRes.items[0];
          for (const q of candidates) {
            try {
              const res = await window.MusicAPI.resolve(matchedTrack.ref, q);
              if (res && res.url && res.url.trim().length > 30) {
                return {
                  ...res,
                  url: res.url.trim(),
                  actualQuality: res.actualQuality || q
                };
              }
            } catch (ignored) {}
          }
        }
      } catch (err) {
        console.warn('[APP] Search fallback failed:', err);
      }
    }

    throw (lastError || new Error('未能解析到可用音频播放直链'));
  }

  // Save Queue Persistence
  function saveQueueToStorage() {
    try {
      localStorage.setItem('jelly_queue', JSON.stringify(state.queue || []));
      localStorage.setItem('jelly_queue_index', String(state.queueIndex));
      localStorage.setItem('jelly_queue_title', state.queueTitle || '当前播放列表');
    } catch (e) {}
  }

  // Set / Replace entire queue (for Play All in playlists, albums, recommendations, favorites)
  function setQueue(tracks, startIndex = 0, sourceTitle = '当前播放列表') {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    state.queue = [...tracks];
    state.queueIndex = Math.max(0, Math.min(startIndex, state.queue.length - 1));
    state.queueTitle = sourceTitle;
    saveQueueToStorage();
    if (el.queueOverlay && !el.queueOverlay.classList.contains('translate-y-full')) {
      renderQueueList();
    }
  }

  // Play searched track in queue context (Insert into current queue, or base on history/favorites)
  function playSearchedTrack(track) {
    if (state.queue && state.queue.length > 0) {
      // Check if song already exists in current queue
      const existingIdx = state.queue.findIndex(t => 
        t.ref?.id === track.ref?.id || 
        (normalizeTitle(t.title) === normalizeTitle(track.title) && (t.subtitle || '').trim().toLowerCase() === (track.subtitle || '').trim().toLowerCase())
      );
      if (existingIdx >= 0) {
        state.queueIndex = existingIdx;
      } else {
        // Insert right after current track so next track naturally continues user's playlist
        const insertPos = (state.queueIndex >= 0 && state.queueIndex < state.queue.length) ? state.queueIndex + 1 : 0;
        state.queue.splice(insertPos, 0, track);
        state.queueIndex = insertPos;
      }
    } else {
      // Empty queue: base queue on user's history / favorites as background context
      const baseTracks = (state.history && state.history.length > 0)
        ? state.history
        : ((state.favorites && state.favorites.length > 0) ? state.favorites : (state.dailyRecTracks || []));
      
      const cleanBase = (baseTracks || []).filter(t => 
        t.ref?.id !== track.ref?.id && normalizeTitle(t.title) !== normalizeTitle(track.title)
      );
      state.queue = [track, ...cleanBase.slice(0, 49)];
      state.queueIndex = 0;
      state.queueTitle = '搜索插播 • 历史记录';
    }

    saveQueueToStorage();
    playTrack(state.queue[state.queueIndex]);
  }

  // Play Track
  async function playTrack(track, queue = null, queueTitle = null) {
    if (queue) {
      state.queue = queue;
      state.queueIndex = queue.findIndex(t => t.ref?.id === track.ref?.id);
      if (queueTitle) state.queueTitle = queueTitle;
    } else {
      if (!state.queue || state.queue.length === 0) {
        state.queue = [track];
        state.queueIndex = 0;
      } else {
        const existingIdx = state.queue.findIndex(t => t.ref?.id === track.ref?.id);
        if (existingIdx >= 0) {
          state.queueIndex = existingIdx;
        } else {
          state.queue.push(track);
          state.queueIndex = state.queue.length - 1;
        }
      }
    }
    state.currentTrack = track;
    saveQueueToStorage();
    try {
      localStorage.setItem('jelly_current_track', JSON.stringify(track));
    } catch (e) {}
    // Graceful Quality Hierarchy: Predict best matching quality immediately so badges reflect realistic tier
    const expectedQuality = predictBestQuality(state.preferredQuality, track.metadata?.qualities);
    state.currentQuality = expectedQuality;
    syncAllQualityBadges();
    updateMiniPlayer(track);
    updateFullPlayer(track);

    // CRITICAL BUG FIX: Always re-render open queue list so the active selection updates immediately!
    if (el.queueOverlay && !el.queueOverlay.classList.contains('translate-y-full')) {
      renderQueueList();
    }

    try {
      const resolved = await resolveStreamWithFallback(track, state.preferredQuality, track.metadata?.qualities);
      console.log('[APP] Resolved audio URL:', resolved.url, 'actual quality:', resolved.actualQuality);
      if (!resolved || !resolved.url) {
        throw new Error('未能解析到有效音频播放直链');
      }

      if (resolved.actualQuality) {
        state.currentQuality = resolved.actualQuality;
        try { localStorage.setItem('jelly_current_quality', resolved.actualQuality); } catch (e) {}
      }
      syncAllQualityBadges();

      const artists = track.metadata?.artists?.join(' / ') || track.subtitle || '未知歌手';
      const artwork = resolveTrackArtwork(track);

      const trackInfo = {
        title: track.title,
        artist: artists,
        coverUrl: artwork,
        duration: track.metadata?.durationMs || 0,
        isFavorite: isCurrentFav()
      };

      if (window.AndroidBridge && typeof window.AndroidBridge.playMusic === 'function') {
        window.AndroidBridge.playMusic(resolved.url, JSON.stringify(trackInfo));
        if (typeof window.AndroidBridge.updateFavoriteState === 'function') {
          window.AndroidBridge.updateFavoriteState(isCurrentFav());
        }
      }

      state.isPlaying = true;
      updatePlayState(true);

      // Add to history
      addToHistory(track);

      // Load Lyrics
      loadLyrics(track);

    } catch (err) {
      updatePlayState(false);
      toast('播放失败: ' + (err.message || '网络异常'));
      console.error('Resolve error:', err);
    }
  }

  // Standardized Quality Formatting & Unification (Single Source of Truth)
  function getQualityInfo(qualityKey) {
    const q = String(qualityKey || '320k').toLowerCase().trim();
    if (['hires', 'master', 'flac24bit', 'atmos', 'atmos_plus'].includes(q)) {
      return { short: 'Hi-Res', full: 'Hi-Res 母带', isLossless: true };
    }
    if (q === 'flac' || q === 'lossless') {
      return { short: 'FLAC', full: 'FLAC 无损', isLossless: true };
    }
    if (['320k', '192k', 'standard'].includes(q)) {
      return { short: '320K', full: '320K 高清', isLossless: false };
    }
    return { short: '128K', full: '128K 标准', isLossless: false };
  }

  function syncAllQualityBadges() {
    const activeQ = state.currentQuality || state.preferredQuality || '320k';
    const qInfo = getQualityInfo(activeQ);

    // 1. Mini player badge
    if (el.miniQualityBadge) {
      el.miniQualityBadge.textContent = qInfo.short;
      if (qInfo.short === 'Hi-Res') {
        el.miniQualityBadge.className = 'bg-amber-500/15 text-amber-700 border border-amber-500/30 text-[9px] font-bold px-1 rounded uppercase';
      } else if (qInfo.isLossless) {
        el.miniQualityBadge.className = 'bg-secondary-container/40 text-secondary text-[9px] font-bold px-1 rounded uppercase';
      } else {
        el.miniQualityBadge.className = 'bg-primary/10 text-primary text-[9px] font-bold px-1 rounded uppercase';
      }
    }

    // 2. Full player pill & text
    if (el.fullQualityText) {
      el.fullQualityText.textContent = qInfo.full;
    } else if (el.fullQualityPill) {
      el.fullQualityPill.textContent = qInfo.full;
    }

    // 3. Settings page buttons
    syncQualityUI();
  }

  // Update Mini Player UI
  function updateMiniPlayer(track) {
    if (!track) return;
    el.miniTitle.textContent = track.title;
    el.miniArtist.textContent = track.metadata?.artists?.join(' / ') || track.subtitle || '未知歌手';
    syncAllQualityBadges();
    el.miniSourceTag.textContent = '• ' + (track.ref?.providerId?.toUpperCase() || '聆澜');
    const artwork = resolveTrackArtwork(track);
    el.miniCover.src = artwork;
    el.miniCover.onerror = () => { el.miniCover.src = createFallbackCover(track.title, el.miniArtist.textContent); };
  }

  // Update Full Player UI
  function updateFullPlayer(track) {
    if (!track) return;
    el.fullTitle.textContent = track.title;
    el.fullArtist.textContent = track.metadata?.artists?.join(' / ') || track.subtitle || '未知歌手';
    el.fullSourceLabel.textContent = `${track.ref?.providerId?.toUpperCase() || '全网音源'} • 无损直通`;
    syncAllQualityBadges();
    const artwork = resolveTrackArtwork(track);
    el.fullCover.src = artwork;
    el.fullCover.onerror = () => { el.fullCover.src = createFallbackCover(track.title, el.fullArtist.textContent); };
    updateFavHeart();
  }

  function updatePlayState(playing) {
    state.isPlaying = !!playing;
    const icon = playing ? 'pause' : 'play_arrow';
    if (el.miniPlayIcon) el.miniPlayIcon.textContent = icon;
    if (el.fullPlayIcon) el.fullPlayIcon.textContent = icon;
    if (el.vinylDisc) {
      if (playing) {
        el.vinylDisc.classList.add('playing');
        el.vinylDisc.classList.remove('paused');
      } else {
        el.vinylDisc.classList.remove('playing');
        el.vinylDisc.classList.add('paused');
      }
    }

    // Bug 8: Tonearm, Aura, and Equalizer Animations
    if (el.vinylTonearm) {
      el.vinylTonearm.classList.toggle('playing', !!playing);
    }
    if (el.vinylAura) {
      el.vinylAura.classList.toggle('aura-breathing', !!playing);
    }
    if (el.playerWaveIndicator) {
      el.playerWaveIndicator.classList.toggle('hidden', !playing);
    }
  }

  // Play/Pause Toggle
  function togglePlay() {
    if (!state.currentTrack) {
      if (state.queue.length > 0) {
        playTrack(state.queue[0], state.queue);
      }
      return;
    }
    if (state.isPlaying) {
      if (window.AndroidBridge) window.AndroidBridge.pauseMusic();
      updatePlayState(false);
    } else {
      let nativeLoaded = false;
      if (window.AndroidBridge && typeof window.AndroidBridge.getPlaybackState === 'function') {
        try {
          const pb = JSON.parse(window.AndroidBridge.getPlaybackState());
          if (pb && pb.track) {
            nativeLoaded = true;
          }
        } catch (e) {}
      }
      if (nativeLoaded) {
        if (window.AndroidBridge) window.AndroidBridge.resumeMusic();
        updatePlayState(true);
      } else {
        playTrack(state.currentTrack);
      }
    }
  }

  // Next Track
  function playNext() {
    if (state.queue.length === 0) return;
    let nextIdx = state.queueIndex + 1;
    if (state.playMode === 'shuffle') {
      nextIdx = Math.floor(Math.random() * state.queue.length);
    } else if (nextIdx >= state.queue.length) {
      nextIdx = 0;
    }
    state.queueIndex = nextIdx;
    playTrack(state.queue[nextIdx]);
  }

  // Prev Track
  function playPrev() {
    if (state.queue.length === 0) return;
    let prevIdx = state.queueIndex - 1;
    if (prevIdx < 0) prevIdx = state.queue.length - 1;
    state.queueIndex = prevIdx;
    playTrack(state.queue[prevIdx]);
  }

  // Button Listeners
  el.miniPlayBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  el.miniPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });
  el.miniNextBtn.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });
  el.btnPlayPause.addEventListener('click', togglePlay);
  el.btnPrev.addEventListener('click', playPrev);
  el.btnNext.addEventListener('click', playNext);

  // Play Mode Toggle
  el.btnPlayMode.addEventListener('click', () => {
    if (state.playMode === 'sequence') {
      state.playMode = 'loop';
      el.playModeIcon.textContent = 'repeat_one';
      toast('单曲循环');
    } else if (state.playMode === 'loop') {
      state.playMode = 'shuffle';
      el.playModeIcon.textContent = 'shuffle';
      toast('随机播放');
    } else {
      state.playMode = 'sequence';
      el.playModeIcon.textContent = 'repeat';
      toast('顺序播放');
    }
  });

  // Player Mode Switching (Vinyl <-> Lyrics)
  function setPlayerMode(mode) {
    state.playerMode = mode;
    const isLyrics = mode === 'lyrics';
    el.fullPlayerOverlay.classList.toggle('player-mode-lyrics', isLyrics);
    el.fullPlayerOverlay.classList.toggle('player-mode-vinyl', !isLyrics);
    const isLand = window.innerWidth > window.innerHeight;
    if (!isLand) {
      el.vinylStage.classList.toggle('hidden', isLyrics);
      el.lyricsStage.classList.toggle('hidden', !isLyrics);
    } else {
      el.vinylStage.classList.remove('hidden');
      el.lyricsStage.classList.remove('hidden');
    }

    const icon = isLyrics ? 'album' : 'lyrics';
    const text = isLyrics ? '唱片' : '歌词';
    if (el.flipStageIcon) el.flipStageIcon.textContent = icon;
    if (el.btnFlipStageIcon) el.btnFlipStageIcon.textContent = icon;
    if (el.btnFlipStageText) el.btnFlipStageText.textContent = text;

    if (isLyrics || isLand) {
      syncLyrics(state.currentTime, true);
    }
  }

  // Open / Close Full Player
  function openFullPlayer() {
    el.fullPlayerOverlay.style.transform = '';
    el.fullPlayerOverlay.style.transition = '';
    el.fullPlayerOverlay.classList.remove('translate-y-full');
    const isLand = window.innerWidth > window.innerHeight;
    if (isLand) {
      el.vinylStage.classList.remove('hidden');
      el.lyricsStage.classList.remove('hidden');
      if (state.currentLyricIndex >= 0) {
        setTimeout(() => syncLyrics(state.currentTime, true), 120);
      }
    }
    try {
      localStorage.setItem('jelly_full_player_open', 'true');
    } catch (e) {}
  }

  function closeFullPlayer() {
    try {
      localStorage.removeItem('jelly_full_player_open');
    } catch (e) {}
    el.fullPlayerOverlay.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
    el.fullPlayerOverlay.style.transform = 'translateY(100%)';
    setTimeout(() => {
      el.fullPlayerOverlay.classList.add('translate-y-full');
      el.fullPlayerOverlay.style.transform = '';
      el.fullPlayerOverlay.style.transition = '';
    }, 350);
  }

  window.openFullPlayer = openFullPlayer;
  window.closeFullPlayer = closeFullPlayer;

  el.miniPlayerContent.addEventListener('click', openFullPlayer);
  el.btnCloseFullPlayer.addEventListener('click', closeFullPlayer);

  // Swipe Down to Dismiss Gesture on Full Player Overlay
  let touchStartY = 0;
  let touchStartX = 0;
  let isDraggingPlayer = false;
  let currentDeltaY = 0;

  el.fullPlayerOverlay.addEventListener('touchstart', (e) => {
    // If progress slider is being touched or interactive button, ignore
    if (e.target.closest('#progressContainer') || e.target.closest('button')) {
      isDraggingPlayer = false;
      return;
    }
    const touch = e.touches[0];
    // If lyrics are scrolled, only ignore drag down if touch is strictly inside the middle scrollable lyrics container
    if (e.target.closest('#lyricsScrollContainer')) {
      if (el.lyricsScrollContainer && el.lyricsScrollContainer.scrollTop > 5) {
        isDraggingPlayer = false;
        return;
      }
    }
    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    isDraggingPlayer = true;
    currentDeltaY = 0;
  }, { passive: true });

  el.fullPlayerOverlay.addEventListener('touchmove', (e) => {
    if (!isDraggingPlayer) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY;
    const deltaX = touch.clientX - touchStartX;

    // Only allow pulling down (deltaY > 0)
    if (deltaY > 5 && deltaY > Math.abs(deltaX) * 1.1) {
      currentDeltaY = deltaY;
      el.fullPlayerOverlay.style.transition = 'none';
      el.fullPlayerOverlay.style.transform = `translateY(${deltaY}px)`;
    } else if (deltaY < 0) {
      el.fullPlayerOverlay.style.transform = '';
    }
  }, { passive: true });

  el.fullPlayerOverlay.addEventListener('touchend', () => {
    if (!isDraggingPlayer) return;
    isDraggingPlayer = false;
    const threshold = (window.innerWidth > window.innerHeight) ? 60 : 90;
    if (currentDeltaY > threshold) {
      closeFullPlayer();
    } else {
      // Rebound smoothly back up
      el.fullPlayerOverlay.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
      el.fullPlayerOverlay.style.transform = 'translateY(0)';
      setTimeout(() => {
        el.fullPlayerOverlay.style.transform = '';
        el.fullPlayerOverlay.style.transition = '';
      }, 250);
    }
    currentDeltaY = 0;
  }, { passive: true });

  // Center Vinyl <-> Lyrics Flipping Click Handlers
  const isLandscapeMode = () => window.innerWidth > window.innerHeight;
  el.vinylStage.addEventListener('click', () => {
    if (!isLandscapeMode()) setPlayerMode('lyrics');
  });
  el.lyricsStage.addEventListener('click', (e) => {
    if (!isLandscapeMode() && !e.target.closest('.lyric-line')) {
      setPlayerMode('vinyl');
    }
  });
  el.btnToggleLyrics.addEventListener('click', () => {
    setPlayerMode(state.playerMode === 'vinyl' ? 'lyrics' : 'vinyl');
  });
  el.btnFlipStage.addEventListener('click', () => {
    setPlayerMode(state.playerMode === 'vinyl' ? 'lyrics' : 'vinyl');
  });

  // Playlist Detail Modal & Favoriting
  let currentPlaylistTracks = [];
  let currentPlaylistRef = null;
  let currentPlaylistInfo = null;

  function isPlaylistFavorited(ref, info) {
    if (!state.favoritePlaylists || state.favoritePlaylists.length === 0) return false;
    const pid = ref?.id || info?.id;
    const pTitle = (info?.title || '').trim().toLowerCase();
    return state.favoritePlaylists.some(pl => {
      const savedId = pl.ref?.id || pl.id;
      if (pid && savedId && pid === savedId) return true;
      if (pTitle && pl.title && pl.title.trim().toLowerCase() === pTitle) return true;
      return false;
    });
  }

  function updatePlaylistFavButton() {
    if (!el.btnFavPlaylist || !el.favPlaylistIcon || !el.favPlaylistText) return;
    const isFav = isPlaylistFavorited(currentPlaylistRef, currentPlaylistInfo);
    if (isFav) {
      el.favPlaylistIcon.textContent = 'favorite';
      el.favPlaylistIcon.className = 'material-symbols-outlined text-[18px] text-red-500 fill-1';
      el.favPlaylistText.textContent = '已收藏';
      el.favPlaylistText.className = 'text-red-500 font-bold';
      el.btnFavPlaylist.className = 'h-10 px-4 rounded-full bg-red-50 border border-red-200 text-red-500 font-bold text-[13px] flex items-center gap-1.5 shadow-sm active-squish';
    } else {
      el.favPlaylistIcon.textContent = 'favorite_border';
      el.favPlaylistIcon.className = 'material-symbols-outlined text-[18px] text-on-surface';
      el.favPlaylistText.textContent = '收藏';
      el.favPlaylistText.className = 'text-on-surface font-bold';
      el.btnFavPlaylist.className = 'h-10 px-4 rounded-full jelly-glass text-on-surface font-bold text-[13px] flex items-center gap-1.5 shadow-sm active-squish';
    }
  }

  function toggleFavoriteCurrentPlaylist() {
    if (!currentPlaylistRef && !currentPlaylistInfo) return;
    const isFav = isPlaylistFavorited(currentPlaylistRef, currentPlaylistInfo);
    if (isFav) {
      const pid = currentPlaylistRef?.id || currentPlaylistInfo?.id;
      const pTitle = (currentPlaylistInfo?.title || '').trim().toLowerCase();
      state.favoritePlaylists = state.favoritePlaylists.filter(pl => {
        const savedId = pl.ref?.id || pl.id;
        if (pid && savedId && pid === savedId) return false;
        if (pTitle && pl.title && pl.title.trim().toLowerCase() === pTitle) return false;
        return true;
      });
      toast('已取消收藏歌单');
    } else {
      const plItem = {
        ref: currentPlaylistRef,
        title: currentPlaylistInfo.title || el.plDetailTitle.textContent || '精选歌单',
        subtitle: currentPlaylistInfo.author || el.plDetailAuthor.textContent || '精选推荐',
        author: currentPlaylistInfo.author || el.plDetailAuthor.textContent || '精选推荐',
        artworkUrl: currentPlaylistInfo.artworkUrl || el.plDetailCover.src,
        playlist: {
          author: currentPlaylistInfo.author || el.plDetailAuthor.textContent,
          artworkUrl: currentPlaylistInfo.artworkUrl || el.plDetailCover.src,
          trackCount: currentPlaylistTracks.length || currentPlaylistInfo.trackCount || 0
        },
        tracks: currentPlaylistTracks.length > 0 ? currentPlaylistTracks : undefined
      };
      state.favoritePlaylists.unshift(plItem);
      toast('已收藏歌单');
    }

    try {
      localStorage.setItem('jelly_fav_playlists', JSON.stringify(state.favoritePlaylists));
    } catch (e) {}
    updatePlaylistFavButton();
    renderLibrary();
  }

  if (el.btnFavPlaylist) {
    el.btnFavPlaylist.addEventListener('click', toggleFavoriteCurrentPlaylist);
  }

  async function openPlaylistDetail(ref, info, saveState = true) {
    currentPlaylistRef = ref;
    currentPlaylistInfo = info;
    updatePlaylistFavButton();

    if (saveState) {
      try {
        localStorage.setItem('jelly_open_playlist', JSON.stringify({ ref, info }));
      } catch (e) {}
    }

    el.playlistDetailOverlay.style.transform = '';
    el.playlistDetailOverlay.style.transition = '';
    el.playlistDetailOverlay.classList.remove('translate-y-full');
    if (el.miniPlayer) el.miniPlayer.classList.add('in-subpage');
    el.plDetailTitle.textContent = info.title || '精选歌单';
    el.plDetailAuthor.textContent = info.author || '澜音推荐';
    const plFallback = createFallbackCover(info.title, info.author);
    el.plDetailCover.src = info.artworkUrl || plFallback;
    el.plDetailCover.onerror = () => { el.plDetailCover.src = plFallback; };
    el.plDetailSourceBadge.textContent = info.sourceBadge || `${(ref?.providerId || 'TX').toUpperCase()} 音源`;

    // Direct tracks provided (e.g. Daily Taste Recommendation 30 tracks)
    if (info.tracks && Array.isArray(info.tracks)) {
      currentPlaylistTracks = info.tracks;
      el.plDetailCount.textContent = `共 ${info.tracks.length} 首歌曲`;
      el.plDetailTracksList.innerHTML = '';
      if (info.tracks.length === 0) {
        el.plDetailTracksList.innerHTML = '<div class="text-center py-8 text-[13px] text-outline">暂无歌曲</div>';
        return;
      }
      const fragment = document.createDocumentFragment();
      info.tracks.forEach((track, idx) => {
        const itemEl = createTrackItem(track, () => {
          setQueue(info.tracks, idx, info.title || '精选歌单');
          playTrack(track);
        });
        fragment.appendChild(itemEl);
      });
      el.plDetailTracksList.appendChild(fragment);
      return;
    }

    el.plDetailCount.textContent = '正在获取歌曲列表...';
    el.plDetailTracksList.innerHTML = '<div class="flex justify-center py-10"><div class="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>';

    try {
      const res = await window.MusicAPI.getPlaylistDetail(ref.id, ref.providerId || 'tx');
      const items = res?.items || [];
      currentPlaylistTracks = items;
      el.plDetailCount.textContent = `共 ${items.length} 首歌曲`;
      el.plDetailTracksList.innerHTML = '';
      if (items.length === 0) {
        el.plDetailTracksList.innerHTML = '<div class="text-center py-8 text-[13px] text-outline">歌单为空或该平台暂未开放列表</div>';
        return;
      }
      const fragment = document.createDocumentFragment();
      items.forEach((track, idx) => {
        const itemEl = createTrackItem(track, () => {
          setQueue(items, idx, info.title || el.plDetailTitle.textContent || '精选歌单');
          playTrack(track);
        });
        fragment.appendChild(itemEl);
      });
      el.plDetailTracksList.appendChild(fragment);
    } catch (err) {
      el.plDetailTracksList.innerHTML = `<div class="text-center py-8 text-[13px] text-red-500">加载歌单失败: ${err.message || '网络超时'}</div>`;
    }
  }

  function closePlaylistDetail() {
    try {
      localStorage.removeItem('jelly_open_playlist');
    } catch (e) {}
    currentPlaylistRef = null;
    currentPlaylistInfo = null;

    el.playlistDetailOverlay.classList.add('translate-y-full');
    if (el.miniPlayer) el.miniPlayer.classList.remove('in-subpage');
    setTimeout(() => {
      el.playlistDetailOverlay.style.transform = '';
      el.playlistDetailOverlay.style.transition = '';
    }, 350);
  }

  window.openPlaylistDetail = openPlaylistDetail;
  window.closePlaylistDetail = closePlaylistDetail;

  el.btnClosePlaylistDetail.addEventListener('click', closePlaylistDetail);

  // Swipe Down to Dismiss Gesture on Playlist Detail Overlay
  let plTouchStartY = 0;
  let plTouchStartX = 0;
  let plIsSwiping = false;

  el.playlistDetailOverlay.addEventListener('touchstart', (e) => {
    if (el.playlistDetailOverlay.classList.contains('translate-y-full')) return;
    if (el.plDetailTracksList && el.plDetailTracksList.scrollTop > 5) return;
    plTouchStartY = e.touches[0].clientY;
    plTouchStartX = e.touches[0].clientX;
    plIsSwiping = false;
  }, { passive: true });

  el.playlistDetailOverlay.addEventListener('touchmove', (e) => {
    if (el.playlistDetailOverlay.classList.contains('translate-y-full')) return;
    if (el.plDetailTracksList && el.plDetailTracksList.scrollTop > 5) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - plTouchStartY;
    const deltaX = currentX - plTouchStartX;

    if (deltaY > 15 && deltaY > Math.abs(deltaX) * 1.5) {
      plIsSwiping = true;
      el.playlistDetailOverlay.style.transition = 'none';
      el.playlistDetailOverlay.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
    }
  }, { passive: true });

  el.playlistDetailOverlay.addEventListener('touchend', (e) => {
    if (!plIsSwiping) return;
    plIsSwiping = false;
    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - plTouchStartY;

    el.playlistDetailOverlay.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    if (deltaY > 100) {
      closePlaylistDetail();
    } else {
      el.playlistDetailOverlay.style.transform = 'translateY(0px)';
    }
  });

  el.btnPlayAllPlaylist.addEventListener('click', () => {
    if (currentPlaylistTracks && currentPlaylistTracks.length > 0) {
      setQueue(currentPlaylistTracks, 0, el.plDetailTitle.textContent || '精选歌单');
      playTrack(currentPlaylistTracks[0]);
      toast(`开始播放歌单 (${currentPlaylistTracks.length}首)`);
    } else {
      toast('歌单列表为空');
    }
  });

  // Comments Modal
  async  function openCommentsModal() {
    if (!state.currentTrack) {
      toast('当前未播放歌曲');
      return;
    }
    el.commentsOverlay.style.transform = '';
    el.commentsOverlay.style.transition = '';
    el.commentsOverlay.classList.remove('translate-y-full');
    el.commentsSongTitle.textContent = state.currentTrack.title;
    el.commentsList.innerHTML = '<div class="flex flex-col items-center justify-center py-16 gap-3 text-primary"><div class="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin"></div><span class="text-[12px] text-outline">正在获取歌曲精彩评论...</span></div>';

    loadComments();
  }

  function closeCommentsModal() {
    el.commentsOverlay.classList.add('translate-y-full');
    setTimeout(() => {
      el.commentsOverlay.style.transform = '';
      el.commentsOverlay.style.transition = '';
    }, 350);
  }

  async function loadComments() {
    try {
      let comments = [];
      const title = state.currentTrack?.title || '';
      const singer = state.currentTrack?.metadata?.artists?.[0] || state.currentTrack?.subtitle || '';
      const query = title + (singer ? ' ' + singer : '');

      // 1. First priority: High-quality NetEase Cloud Music comments (云村热评)
      try {
        let wyId = null;
        if (state.currentTrack?.ref?.providerId === 'wy') {
          wyId = state.currentTrack.ref.id;
        } else {
          const sWy = await window.MusicAPI.search(query || title, 'wy', 1, 3);
          wyId = sWy?.items?.[0]?.ref?.id;
        }

        if (wyId && window.nativeHttpFetch) {
          const resp = await window.nativeHttpFetch(`https://music.163.com/api/v1/resource/comments/R_SO_4_${wyId}?offset=0&limit=30`, {
            method: 'GET',
            headers: { 'Referer': 'https://music.163.com/' }
          });
          const rawList = [...(resp.body?.hotComments || []), ...(resp.body?.comments || [])];
          if (rawList.length > 0) {
            comments = rawList.map(c => ({
              userName: c.user?.nickname || '云村乐迷',
              avatar: c.user?.avatarUrl || '',
              timeStr: c.timeStr || (c.time ? new Date(c.time).toLocaleDateString() : ''),
              likedCount: c.likedCount || 0,
              text: c.content || ''
            })).filter(c => c.text);
          }
        }
      } catch (eWy) {
        console.warn('NetEase comments fetch failed:', eWy);
      }

      // 2. Second priority: Fallback to direct provider getComments API
      if (comments.length === 0 && window.MusicAPI?.getComments) {
        try {
          const res = await window.MusicAPI.getComments(state.currentTrack);
          comments = res.comments || res.list || [];
        } catch (e1) {
          console.warn('Direct comment fetch failed:', e1);
        }
      }

      // 3. Third priority: Kuwo / Kugou fallback
      if (comments.length === 0 && window.MusicAPI?.search) {
        try {
          const fbKw = await window.MusicAPI.search(query, 'kw', 1, 3);
          if (fbKw?.items?.length > 0) {
            const fbRes = await window.MusicAPI.getComments(fbKw.items[0]);
            comments = fbRes.comments || fbRes.list || [];
          }
        } catch (eKw) {
          console.warn('Fallback Kuwo comments failed:', eKw);
        }
      }

      el.commentsList.innerHTML = '';
      if (comments.length === 0) {
        el.commentsList.innerHTML = '<div class="text-center py-16 text-[13px] text-outline">暂无评论或该音源暂未收录评论</div>';
        return;
      }
      comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'jelly-glass rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm';
        const avatar = c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80';
        const name = c.userName || '乐迷';
        const time = c.timeStr || '';
        const likes = c.likedCount ? `${c.likedCount}` : '0';
        div.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <img src="${avatar}" class="w-8 h-8 rounded-full object-cover" onerror="this.src=\'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80\'" />
              <div>
                <span class="text-[13px] font-bold text-on-surface block leading-tight">${escapeHtml(name)}</span>
                <span class="text-[10px] text-outline">${escapeHtml(time)}</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-[11px] text-outline font-medium">
              <span class="material-symbols-outlined text-[14px]">thumb_up</span>
              <span>${likes}</span>
            </div>
          </div>
          <p class="text-[13px] text-on-surface leading-relaxed pl-10">${escapeHtml(c.text)}</p>
        `;
        el.commentsList.appendChild(div);
      });
    } catch (err) {
      el.commentsList.innerHTML = `<div class="text-center py-16 text-[13px] text-red-500">获取评论失败: ${err.message || '网络超时'}</div>`;
    }
  }

  el.btnComments.addEventListener('click', openCommentsModal);
  el.btnCloseComments.addEventListener('click', closeCommentsModal);

  // Swipe Down to Dismiss Gesture on Comments Overlay
  let cTouchStartY = 0;
  let cTouchStartX = 0;
  let cIsSwiping = false;

  el.commentsOverlay.addEventListener('touchstart', (e) => {
    if (el.commentsOverlay.classList.contains('translate-y-full')) return;
    if (el.commentsList && el.commentsList.scrollTop > 5) return;
    cTouchStartY = e.touches[0].clientY;
    cTouchStartX = e.touches[0].clientX;
    cIsSwiping = false;
  }, { passive: true });

  el.commentsOverlay.addEventListener('touchmove', (e) => {
    if (el.commentsOverlay.classList.contains('translate-y-full')) return;
    if (el.commentsList && el.commentsList.scrollTop > 5) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - cTouchStartY;
    const deltaX = currentX - cTouchStartX;

    if (deltaY > 15 && deltaY > Math.abs(deltaX) * 1.5) {
      cIsSwiping = true;
      el.commentsOverlay.style.transition = 'none';
      el.commentsOverlay.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
    }
  }, { passive: true });

  el.commentsOverlay.addEventListener('touchend', (e) => {
    if (!cIsSwiping) return;
    cIsSwiping = false;
    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - cTouchStartY;

    el.commentsOverlay.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    if (deltaY > 100) {
      closeCommentsModal();
    } else {
      el.commentsOverlay.style.transform = 'translateY(0px)';
    }
  }, { passive: true });

  // Queue Modal
  function updateQueuePlayModeUI() {
    if (!el.queuePlayModeIcon || !el.queuePlayModeText) return;
    const mode = state.playMode || 'sequence';
    if (mode === 'sequence') {
      el.queuePlayModeIcon.textContent = 'repeat';
      el.queuePlayModeText.textContent = '列表循环';
    } else if (mode === 'loop') {
      el.queuePlayModeIcon.textContent = 'repeat_one';
      el.queuePlayModeText.textContent = '单曲循环';
    } else if (mode === 'shuffle') {
      el.queuePlayModeIcon.textContent = 'shuffle';
      el.queuePlayModeText.textContent = '随机播放';
    }
  }

  function openQueueModal() {
    el.queueOverlay.style.transform = '';
    el.queueOverlay.style.transition = '';
    el.queueOverlay.classList.remove('translate-y-full');
    renderQueueList(true);
  }

  function renderQueueList(isOpening = false) {
    if (!el.queueTotalCount || !el.queueList) return;
    const count = (state.queue || []).length;
    el.queueTotalCount.textContent = `当前播放队列 (${count})`;
    if (el.queueSourceTag) {
      el.queueSourceTag.textContent = `来源: ${state.queueTitle || '当前播放列表'}`;
    }
    updateQueuePlayModeUI();

    el.queueList.innerHTML = '';
    if (count === 0) {
      el.queueList.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 gap-2 text-outline">
          <span class="material-symbols-outlined text-[36px] opacity-40">queue_music</span>
          <span class="text-[13px] font-medium">播放队列为空</span>
          <span class="text-[11px] opacity-70">点击歌单「播放全部」或搜索点播添加歌曲</span>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    state.queue.forEach((track, idx) => {
      const isCurrent = (idx === state.queueIndex) || (state.currentTrack && state.currentTrack.ref?.id === track.ref?.id);
      const div = document.createElement('div');
      div.className = `queue-item rounded-2xl p-3 flex items-center justify-between gap-3 active-squish cursor-pointer ${
        isCurrent 
          ? 'queue-item-active bg-primary/10 border-2 border-primary shadow-sm' 
          : 'jelly-glass hover:bg-white/80'
      }`;
      div.dataset.index = idx;
      const artist = track.metadata?.artists?.join(' / ') || track.subtitle || '未知歌手';
      const rawQualities = (track.metadata?.qualities || []).map(q => String(q).toLowerCase());
      const isHiRes = rawQualities.some(q => ['master', 'hires', 'atmos_plus', 'atmos', 'flac24bit'].includes(q));
      const isFlac = !isHiRes && rawQualities.includes('flac');
      const qText = isHiRes ? 'Hi-Res' : (isFlac ? 'FLAC' : (rawQualities.includes('320k') ? '320K' : '128K'));
      const qClass = isHiRes
        ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
        : (isFlac ? 'bg-secondary-container/50 text-secondary' : 'bg-primary/10 text-primary');
      const tagText = track._recTag || '';

      div.innerHTML = `
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isCurrent ? 'bg-primary text-white shadow-xs' : 'bg-primary/10 text-primary'}">
            <span class="material-symbols-outlined text-[16px] ${isCurrent ? 'animate-pulse' : ''}">${isCurrent ? 'graphic_eq' : 'music_note'}</span>
          </div>
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="text-[13px] font-bold ${isCurrent ? 'text-primary' : 'text-on-surface'} truncate">${escapeHtml(track.title)}</span>
              <span class="px-1 py-0.2 rounded text-[9px] font-bold ${qClass} uppercase">${qText}</span>
              ${tagText ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 flex-shrink-0">${escapeHtml(tagText)}</span>` : ''}
            </div>
            <span class="text-[11px] text-on-surface-variant truncate mt-0.5">${escapeHtml(artist)}</span>
          </div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <button class="btn-remove-track w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-red-500 active-squish" title="从列表移除">
            <span class="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>
      `;

      div.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-track')) {
          e.stopPropagation();
          const wasCurrent = (idx === state.queueIndex);
          state.queue.splice(idx, 1);
          if (wasCurrent) {
            if (state.queue.length > 0) {
              state.queueIndex = Math.min(idx, state.queue.length - 1);
              playTrack(state.queue[state.queueIndex]);
            } else {
              state.queueIndex = -1;
              state.currentTrack = null;
              saveQueueToStorage();
              renderQueueList();
              toast('播放队列已清空');
            }
          } else {
            if (state.queueIndex > idx) state.queueIndex--;
            saveQueueToStorage();
            renderQueueList();
          }
          return;
        }

        // Switch to this song immediately
        state.queueIndex = idx;
        playTrack(track);
      });

      fragment.appendChild(div);
    });

    el.queueList.appendChild(fragment);

    // Auto-scroll active item into visible center without jittering modal transition
    const scrollDelay = isOpening ? 320 : 0;
    setTimeout(() => {
      const activeEl = el.queueList.querySelector('.queue-item-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: isOpening ? 'auto' : 'smooth', block: 'center' });
      }
    }, scrollDelay);
  }

  el.btnPlaylistQueue.addEventListener('click', openQueueModal);
  el.btnCloseQueue.addEventListener('click', () => {
    el.queueOverlay.classList.add('translate-y-full');
  });
  el.btnClearQueue.addEventListener('click', () => {
    state.queue = [];
    state.queueIndex = -1;
    saveQueueToStorage();
    renderQueueList();
    toast('播放队列已清空');
  });

  if (el.btnQueuePlayMode) {
    el.btnQueuePlayMode.addEventListener('click', () => {
      if (state.playMode === 'sequence') state.playMode = 'loop';
      else if (state.playMode === 'loop') state.playMode = 'shuffle';
      else state.playMode = 'sequence';

      updatePlayModeUI();
      updateQueuePlayModeUI();
      const labels = { sequence: '列表循环', loop: '单曲循环', shuffle: '随机播放' };
      toast(`切换为: ${labels[state.playMode]}`);
    });
  }

  // Swipe Down to Dismiss Gesture on Queue Overlay
  let qTouchStartY = 0;
  let qTouchStartX = 0;
  let qIsSwiping = false;

  el.queueOverlay.addEventListener('touchstart', (e) => {
    if (el.queueOverlay.classList.contains('translate-y-full')) return;
    if (el.queueList && el.queueList.scrollTop > 5) return;
    qTouchStartY = e.touches[0].clientY;
    qTouchStartX = e.touches[0].clientX;
    qIsSwiping = false;
  }, { passive: true });

  el.queueOverlay.addEventListener('touchmove', (e) => {
    if (el.queueOverlay.classList.contains('translate-y-full')) return;
    if (el.queueList && el.queueList.scrollTop > 5) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - qTouchStartY;
    const deltaX = currentX - qTouchStartX;

    if (deltaY > 15 && deltaY > Math.abs(deltaX) * 1.5) {
      qIsSwiping = true;
      el.queueOverlay.style.transition = 'none';
      el.queueOverlay.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
    }
  }, { passive: true });

  el.queueOverlay.addEventListener('touchend', (e) => {
    if (!qIsSwiping) return;
    qIsSwiping = false;
    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - qTouchStartY;

    el.queueOverlay.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    if (deltaY > 100) {
      el.queueOverlay.classList.add('translate-y-full');
      el.queueOverlay.style.transform = '';
    } else {
      el.queueOverlay.style.transform = 'translateY(0px)';
    }
  }, { passive: true });

  // Back Button Press Hierarchical Dismissal
  window.handleBackPress = function() {
    if (el.pluginNoticeOverlay && !el.pluginNoticeOverlay.classList.contains('pointer-events-none')) {
      closePluginNoticeDialog();
      return true;
    }
    if (el.importPlaylistOverlay && !el.importPlaylistOverlay.classList.contains('translate-y-full')) {
      closeImportPlaylistModal();
      return true;
    }
    if (!el.commentsOverlay.classList.contains('translate-y-full')) {
      closeCommentsModal();
      return true;
    }
    if (!el.queueOverlay.classList.contains('translate-y-full')) {
      el.queueOverlay.classList.add('translate-y-full');
      return true;
    }
    if (!el.playlistDetailOverlay.classList.contains('translate-y-full')) {
      closePlaylistDetail();
      return true;
    }
    if (!el.fullPlayerOverlay.classList.contains('translate-y-full')) {
      if (state.playerMode === 'lyrics') {
        setPlayerMode('vinyl');
        return true;
      }
      el.fullPlayerOverlay.classList.add('translate-y-full');
      return true;
    }
    return false;
  };

  // Progress Bar Scrubbing & Dragging
  let isSeekingProgress = false;
  let seekRatio = 0;

  function updateProgressUI(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const percent = clamped * 100;
    el.progressBar.style.width = percent + '%';
    el.progressThumb.style.left = percent + '%';
    if (state.duration > 0) {
      el.currentTime.textContent = formatTime(clamped * state.duration);
    }
    if (el.miniProgressBar) {
      el.miniProgressBar.style.width = percent + '%';
    }
  }

  function handleProgressMove(clientX) {
    if (!el.progressContainer) return;
    const rect = el.progressContainer.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    updateProgressUI(seekRatio);
  }

  function commitSeek() {
    if (!isSeekingProgress) return;
    isSeekingProgress = false;
    if (el.progressThumb) el.progressThumb.classList.remove('scale-125');
    if (!state.duration) {
      state.isSeeking = false;
      return;
    }
    const seekMs = Math.floor(seekRatio * state.duration * 1000);
    state.currentTime = seekMs / 1000;
    if (window.AndroidBridge && window.AndroidBridge.seekTo) {
      window.AndroidBridge.seekTo(seekMs);
    }
    syncLyrics(state.currentTime);
    setTimeout(() => {
      state.isSeeking = false;
    }, 250);
  }

  el.progressContainer.addEventListener('touchstart', (e) => {
    if (!state.duration) return;
    isSeekingProgress = true;
    state.isSeeking = true;
    e.stopPropagation();
    handleProgressMove(e.touches[0].clientX);
    if (el.progressThumb) el.progressThumb.classList.add('scale-125');
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!isSeekingProgress) return;
    if (e.cancelable) e.preventDefault();
    handleProgressMove(e.touches[0].clientX);
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (!isSeekingProgress) return;
    commitSeek();
  }, { passive: true });

  window.addEventListener('touchcancel', (e) => {
    if (!isSeekingProgress) return;
    isSeekingProgress = false;
    state.isSeeking = false;
    if (el.progressThumb) el.progressThumb.classList.remove('scale-125');
  }, { passive: true });

  // Click & Mouse Scrubbing fallback
  el.progressContainer.addEventListener('mousedown', (e) => {
    if (!state.duration) return;
    isSeekingProgress = true;
    state.isSeeking = true;
    handleProgressMove(e.clientX);
    if (el.progressThumb) el.progressThumb.classList.add('scale-125');

    const onMouseMove = (ev) => {
      if (isSeekingProgress) handleProgressMove(ev.clientX);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      commitSeek();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  el.progressContainer.addEventListener('click', (e) => {
    if (isSeekingProgress) return;
    if (!state.duration) return;
    handleProgressMove(e.clientX);
    commitSeek();
  });

  // Favorites Management
  function normalizeTitle(t) {
    return (t || '').toLowerCase().replace(/\s*[\(\[（【].*?[\)\]）】]/g, '').trim();
  }

  // Strict check: Is track already in user's favorites?
  function isFavoritedTrack(track) {
    if (!track) return false;
    if (!state.favorites || state.favorites.length === 0) return false;

    // 1. Direct ID match
    const tid = track.ref?.id || track.id;
    if (tid && state.favorites.some(f => (f.ref?.id || f.id) === tid)) {
      return true;
    }

    const tTitle = normalizeTitle(track.title);
    const tArtist = (track.metadata?.artists?.[0] || track.subtitle || '').trim().toLowerCase();

    // 2. Exact or fuzzy title + artist match
    return state.favorites.some(f => {
      const fTitle = normalizeTitle(f.title);
      const fArtist = (f.metadata?.artists?.[0] || f.subtitle || '').trim().toLowerCase();
      if (!tTitle || !fTitle) return false;

      // Exact title match and artist overlap
      if (tTitle === fTitle) {
        if (!tArtist || !fArtist) return true;
        if (tArtist === fArtist || tArtist.includes(fArtist) || fArtist.includes(tArtist)) {
          return true;
        }
      }

      // Title starts with or contains the other and artist matches (e.g. "晴天 (Live)" vs "晴天")
      if ((tTitle.startsWith(fTitle) || fTitle.startsWith(tTitle)) && tArtist && fArtist) {
        if (tArtist === fArtist || tArtist.includes(fArtist) || fArtist.includes(tArtist)) {
          return true;
        }
      }

      return false;
    });
  }

  function isCurrentFav() {
    if (!state.currentTrack) return false;
    return isFavoritedTrack(state.currentTrack);
  }

  function updateFavHeart() {
    const isFav = isCurrentFav();
    if (el.favHeartIcon) {
      el.favHeartIcon.textContent = isFav ? 'favorite' : 'favorite_border';
      el.favHeartIcon.classList.toggle('text-red-500', isFav);
      el.favHeartIcon.classList.toggle('text-on-surface-variant', !isFav);
    }
    if (el.favHeartText) {
      el.favHeartText.textContent = isFav ? '已收藏' : '收藏';
      el.favHeartText.classList.toggle('text-red-500', isFav);
      el.favHeartText.classList.toggle('text-on-surface-variant', !isFav);
    }
    if (el.btnFavCurrent) {
      el.btnFavCurrent.classList.toggle('bg-red-500/10', isFav);
    }
  }

  function toggleFavoriteTrack(track, forceState) {
    if (!track) return;
    const isFavNow = isFavoritedTrack(track);

    let targetFav;
    if (typeof forceState === 'boolean') {
      if (forceState === isFavNow) {
        updateFavHeart();
        return;
      }
      targetFav = forceState;
    } else {
      targetFav = !isFavNow;
    }

    if (targetFav) {
      if (!isFavoritedTrack(track)) {
        state.favorites.unshift(track);
      }
      toast('已添加到我喜欢的音乐');
      if (state.dailyRecTracks) {
        state.dailyRecTracks = state.dailyRecTracks.filter(t => !isFavoritedTrack(t));
      }
      generateDailyRecommendations(true);
    } else {
      const trackId = track.ref?.id || track.id;
      const tTitle = normalizeTitle(track.title);
      const tArtist = (track.metadata?.artists?.[0] || track.subtitle || '').trim().toLowerCase();
      state.favorites = state.favorites.filter(f => {
        if (trackId && (f.ref?.id || f.id) === trackId) return false;
        if (tTitle && tArtist) {
          const fTitle = normalizeTitle(f.title);
          const fArtist = (f.metadata?.artists?.[0] || f.subtitle || '').trim().toLowerCase();
          if (fTitle === tTitle && (tArtist === fArtist || tArtist.includes(fArtist) || fArtist.includes(tArtist))) return false;
        }
        return true;
      });
      toast('已取消收藏');
      generateDailyRecommendations(true);
    }

    try {
      localStorage.setItem('jelly_favs', JSON.stringify(state.favorites));
    } catch (e) {}
    updateFavHeart();
    renderLibrary();
    renderDailyRecCard();

    // Bidirectionally notify Android native service (Vivo Atomic Island & Notification) if this is current track
    if (state.currentTrack) {
      const curId = state.currentTrack.ref?.id || state.currentTrack.id;
      const curTitle = normalizeTitle(state.currentTrack.title);
      const targetId = track.ref?.id || track.id;
      const targetTitle = normalizeTitle(track.title);
      const isCur = (targetId && curId && targetId === curId) || (targetTitle && curTitle && targetTitle === curTitle);
      if (isCur && window.AndroidBridge && typeof window.AndroidBridge.updateFavoriteState === 'function') {
        window.AndroidBridge.updateFavoriteState(targetFav);
      }
    }
  }

  function toggleFavoriteCurrentTrack(forceState) {
    if (!state.currentTrack) return;
    toggleFavoriteTrack(state.currentTrack, forceState);
  }

  window.toggleFavoriteCurrentTrack = toggleFavoriteCurrentTrack;
  window.toggleFavoriteTrack = toggleFavoriteTrack;

  el.btnFavCurrent.addEventListener('click', () => toggleFavoriteCurrentTrack());

  function addToHistory(track) {
    const idx = state.history.findIndex(t => (t.ref?.id || t.id) === (track.ref?.id || track.id));
    if (idx >= 0) state.history.splice(idx, 1);
    state.history.unshift(track);
    if (state.history.length > 100) state.history.pop();
    try {
      localStorage.setItem('jelly_history', JSON.stringify(state.history));
    } catch (e) {}
    renderLibrary();
  }

  // Render Library (Playlists Cards, Favorite Songs with unfavorite button, Recent History)
  function renderLibrary() {
    if (el.favSongCount) {
      el.favSongCount.textContent = `${state.favorites.length} 首歌曲 • ${state.favoritePlaylists.length} 个歌单`;
    }
    if (el.historyCount) {
      el.historyCount.textContent = `历史播放: ${state.history.length}`;
    }
    if (el.favPlaylistSummary) {
      el.favPlaylistSummary.textContent = `收藏歌单: ${state.favoritePlaylists.length}`;
    }

    const isFavPlaylistsTab = el.tabFavPlaylists && el.tabFavPlaylists.classList.contains('text-primary');
    const isFavSongsTab = el.tabFavs && el.tabFavs.classList.contains('text-primary');

    if (isFavPlaylistsTab) {
      if (el.libraryPlaylistsList) el.libraryPlaylistsList.classList.remove('hidden');
      if (el.librarySongList) el.librarySongList.classList.add('hidden');
      renderLibraryPlaylists();
    } else {
      if (el.libraryPlaylistsList) el.libraryPlaylistsList.classList.add('hidden');
      if (el.librarySongList) el.librarySongList.classList.remove('hidden');

      const list = isFavSongsTab ? state.favorites : state.history;
      el.librarySongList.innerHTML = '';

      if (list.length === 0) {
        el.librarySongList.innerHTML = `<div class="text-center py-12 text-[13px] text-outline">${isFavSongsTab ? '暂无收藏歌曲<br><span class="text-[11px] text-outline/80 mt-1 block">在播放页或列表点击爱心即可收藏</span>' : '暂无播放记录，去搜索听听看吧'}</div>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      list.forEach((track, idx) => {
        const itemEl = createTrackItem(track, () => {
          setQueue(list, idx, isFavSongsTab ? '我喜欢的音乐' : '历史播放记录');
          playTrack(track);
        }, { showFavBtn: isFavSongsTab });
        fragment.appendChild(itemEl);
      });
      el.librarySongList.appendChild(fragment);
    }
  }

  function renderLibraryPlaylists() {
    if (!el.libraryPlaylistsList) return;
    el.libraryPlaylistsList.innerHTML = '';

    if (!state.favoritePlaylists || state.favoritePlaylists.length === 0) {
      el.libraryPlaylistsList.innerHTML = '<div class="col-span-2 text-center py-12 text-[13px] text-outline">暂无收藏的歌单<br><span class="text-[11px] text-outline/80 mt-1 block">打开任意歌单，点击顶部“收藏”即可保存到此处</span></div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    state.favoritePlaylists.forEach(pl => {
      const card = createPlaylistCard(pl, () => {
        openPlaylistDetail(pl.ref, {
          title: pl.title,
          author: pl.subtitle || pl.playlist?.author || pl.author || '精选推荐',
          artworkUrl: pl.playlist?.artworkUrl || pl.artworkUrl,
          trackCount: pl.playlist?.trackCount,
          tracks: pl.tracks
        });
      }, { isLibraryCard: true });
      fragment.appendChild(card);
    });
    el.libraryPlaylistsList.appendChild(fragment);
  }

  function setLibraryTab(tabName) {
    if (el.tabFavPlaylists) {
      el.tabFavPlaylists.className = tabName === 'playlists'
        ? 'text-[14px] font-bold text-primary active-squish'
        : 'text-[14px] font-semibold text-on-surface-variant hover:text-on-surface active-squish';
    }
    if (el.tabFavs) {
      el.tabFavs.className = tabName === 'songs'
        ? 'text-[14px] font-bold text-primary active-squish'
        : 'text-[14px] font-semibold text-on-surface-variant hover:text-on-surface active-squish';
    }
    if (el.tabHistory) {
      el.tabHistory.className = tabName === 'history'
        ? 'text-[14px] font-bold text-primary active-squish'
        : 'text-[14px] font-semibold text-on-surface-variant hover:text-on-surface active-squish';
    }
    try {
      localStorage.setItem('jelly_library_subtab', tabName);
    } catch (e) {}
    renderLibrary();
  }

  if (el.tabFavPlaylists) el.tabFavPlaylists.addEventListener('click', () => setLibraryTab('playlists'));
  if (el.tabFavs) el.tabFavs.addEventListener('click', () => setLibraryTab('songs'));
  if (el.tabHistory) el.tabHistory.addEventListener('click', () => setLibraryTab('history'));

  el.btnPlayAllFav.addEventListener('click', () => {
    const isFavPlaylistsTab = el.tabFavPlaylists && el.tabFavPlaylists.classList.contains('text-primary');
    if (isFavPlaylistsTab) {
      if (state.favoritePlaylists.length > 0) {
        const first = state.favoritePlaylists[0];
        openPlaylistDetail(first.ref, first);
      } else {
        toast('暂无收藏的歌单');
      }
    } else {
      if (state.favorites.length > 0) {
        setQueue(state.favorites, 0, '我喜欢的音乐');
        playTrack(state.favorites[0]);
      } else {
        toast('收藏列表中暂无歌曲');
      }
    }
  });

  // Load Lyrics (Bug 3: Eliminate race conditions, fallback across platforms, multi-format parsing)
  let lyricRequestId = 0;

  function hasValidLyrics(res) {
    if (!res) return false;
    if (Array.isArray(res.lines) && res.lines.length > 0) return true;
    const t = res.plainText || res.lyric || res.lrc;
    return typeof t === 'string' && t.trim().length > 10;
  }

  async function loadLyrics(track) {
    const currentReqId = ++lyricRequestId;
    const targetTrackId = track.ref?.id || track.title;
    el.lyricsScrollContainer.innerHTML = '<div class="text-[14px] text-on-surface-variant/60 font-medium my-auto">正在加载同步歌词...</div>';
    state.lyrics = [];
    state.currentLyricIndex = -1;

    try {
      let res = await window.MusicAPI.getLyrics(track.ref);
      if (currentReqId !== lyricRequestId || (state.currentTrack && state.currentTrack.ref?.id !== targetTrackId)) return;

      // Cross-platform fallback if lyrics are empty
      if (!hasValidLyrics(res)) {
        try {
          const fallbackSource = track.ref?.providerId === 'kw' ? 'wy' : 'kw';
          const query = track.title + ' ' + (track.metadata?.artists?.[0] || '');
          const searchRes = await window.MusicAPI.search(query, fallbackSource, 1, 1);
          if (searchRes && searchRes.items && searchRes.items.length > 0) {
            const fallbackLyrics = await window.MusicAPI.getLyrics(searchRes.items[0].ref);
            if (hasValidLyrics(fallbackLyrics)) {
              res = fallbackLyrics;
            }
          }
        } catch (fbErr) {
          console.warn('[APP] Fallback lyrics fetch error:', fbErr);
        }
      }

      if (currentReqId !== lyricRequestId || (state.currentTrack && state.currentTrack.ref?.id !== targetTrackId)) return;

      parseLyrics(res);
      renderLyrics();
    } catch (e) {
      if (currentReqId !== lyricRequestId) return;
      el.lyricsScrollContainer.innerHTML = '<div class="text-[14px] text-outline font-medium my-auto">纯音乐或暂无歌词</div>';
    }
  }

  // Parse TTML, QRC, or LRC
  function parseLyrics(res) {
    state.lyrics = [];
    if (!res) return;

    // Check if TTML verbatim object array with lines
    if (res.lines && Array.isArray(res.lines) && res.lines.length > 0) {
      state.lyrics = res.lines.map(line => {
        const text = line.text || (line.words ? line.words.map(w => w.text || w.word || '').join('') : '') || '';
        return {
          time: (line.startTimeMs || 0) / 1000,
          endTime: (line.endTimeMs || 0) / 1000,
          text: text.trim()
        };
      }).filter(l => l.text);
      if (state.lyrics.length > 0) return;
    }

    // Extract text from plainText, lyric, or lrc
    let text = '';
    if (res.plainText) {
      if (typeof res.plainText === 'string') {
        if (/^[\d,\s]+$/.test(res.plainText.trim())) {
          try {
            const bytes = res.plainText.trim().split(',').map(Number);
            text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
          } catch (e) {
            text = res.plainText;
          }
        } else {
          text = res.plainText;
        }
      }
    } else {
      text = res.lyric || res.lrc || '';
    }

    if (!text) return;

    // Base64 decode if base64 string
    if (typeof text === 'string' && /^[A-Za-z0-9+/=]{50,}$/.test(text.trim())) {
      try {
        text = decodeURIComponent(escape(atob(text.trim())));
      } catch (e) {}
    }

    // XML QrcContent wrapped
    const qrcContentMatch = text.match(/LyricContent="([\s\S]*?)"/);
    if (qrcContentMatch) {
      text = qrcContentMatch[1].replace(/\\n/g, '\n');
    }

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. QRC format: [startTimeMs, durationMs]words...
      const qrcMatch = trimmed.match(/^\[(\d+),\s*(\d+)\](.*)/);
      if (qrcMatch) {
        const time = parseInt(qrcMatch[1]) / 1000;
        const cleanText = qrcMatch[3].replace(/\(\d+,\d+\)/g, '').trim();
        if (cleanText) {
          state.lyrics.push({ time, text: cleanText });
        }
        continue;
      }

      // 2. Standard & Multi-timestamp LRC format: [mm:ss.xx][mm:ss.xx]words...
      const timestampMatches = [...trimmed.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
      if (timestampMatches.length > 0) {
        const cleanText = trimmed.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
        if (cleanText) {
          for (const m of timestampMatches) {
            const min = parseInt(m[1]);
            const sec = parseInt(m[2]);
            const ms = m[3] ? parseInt(m[3].padEnd(3, '0')) : 0;
            const time = min * 60 + sec + ms / 1000;
            state.lyrics.push({ time, text: cleanText });
          }
        }
      }
    }

    state.lyrics.sort((a, b) => a.time - b.time);
  }

  // Render Lyrics Lines & Timeline Guide Handling
  let lyricsScrollTimeout = null;
  let currentTimelineSeekTime = 0;
  let isManualUserScrollingLyrics = false;
  let lyricsTouchActive = false;
  let programmaticScrollLock = false;

  function seekToLyric(timeSec) {
    if (window.AndroidBridge && typeof window.AndroidBridge.seekTo === 'function') {
      window.AndroidBridge.seekTo(Math.floor(timeSec * 1000));
    }
    isManualUserScrollingLyrics = false;
    lyricsTouchActive = false;
    state.isUserScrollingLyrics = false;
    state.currentTime = timeSec;
    syncLyrics(timeSec, true);
    hideLyricsTimelineGuide();
  }

  function showLyricsTimelineGuide(timeSec) {
    currentTimelineSeekTime = timeSec;
    if (el.lyricsTimelineTime) {
      el.lyricsTimelineTime.textContent = formatTime(timeSec);
    }
    if (el.lyricsTimelineGuide) {
      el.lyricsTimelineGuide.classList.add('visible');
    }
  }

  function hideLyricsTimelineGuide() {
    if (el.lyricsTimelineGuide) {
      el.lyricsTimelineGuide.classList.remove('visible');
    }
    document.querySelectorAll('.lyric-line.center-focused').forEach(node => {
      node.classList.remove('center-focused');
    });
  }

  function handleLyricsUserScroll() {
    if (!isManualUserScrollingLyrics || programmaticScrollLock) return;
    const isLand = window.innerWidth > window.innerHeight;
    if (!isLand && state.playerMode !== 'lyrics') return;
    if (state.lyrics.length === 0) return;
    state.isUserScrollingLyrics = true;

    // Determine lyric line closest to vertical center of lyricsScrollContainer
    const container = el.lyricsScrollContainer;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const targetY = containerRect.top + containerRect.height / 2;

    const lines = container.querySelectorAll('.lyric-line');
    let closestLine = null;
    let minDistance = Infinity;

    lines.forEach(line => {
      const rect = line.getBoundingClientRect();
      const lineCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(lineCenterY - targetY);
      if (distance < minDistance) {
        minDistance = distance;
        closestLine = line;
      }
    });

    if (closestLine) {
      lines.forEach(l => l.classList.remove('center-focused'));
      closestLine.classList.add('center-focused');
      const time = parseFloat(closestLine.dataset.time || '0');
      showLyricsTimelineGuide(time);
    }

    scheduleLyricsScrollReset();
  }

  function scheduleLyricsScrollReset() {
    if (lyricsScrollTimeout) clearTimeout(lyricsScrollTimeout);
    lyricsScrollTimeout = setTimeout(() => {
      if (lyricsTouchActive) {
        scheduleLyricsScrollReset();
        return;
      }
      isManualUserScrollingLyrics = false;
      state.isUserScrollingLyrics = false;
      hideLyricsTimelineGuide();
      // Smoothly return to the singing lyric line
      if (state.currentLyricIndex >= 0) {
        const activeNode = document.getElementById('lyric-line-' + state.currentLyricIndex);
        if (activeNode) {
          programmaticScrollLock = true;
          activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => { programmaticScrollLock = false; }, 500);
        }
      }
    }, 2000);
  }

  if (el.lyricsScrollContainer) {
    el.lyricsScrollContainer.addEventListener('touchstart', () => {
      lyricsTouchActive = true;
      isManualUserScrollingLyrics = true;
    }, { passive: true });

    el.lyricsScrollContainer.addEventListener('touchmove', () => {
      lyricsTouchActive = true;
      isManualUserScrollingLyrics = true;
      handleLyricsUserScroll();
    }, { passive: true });

    el.lyricsScrollContainer.addEventListener('touchend', () => {
      lyricsTouchActive = false;
      scheduleLyricsScrollReset();
    }, { passive: true });

    el.lyricsScrollContainer.addEventListener('touchcancel', () => {
      lyricsTouchActive = false;
      scheduleLyricsScrollReset();
    }, { passive: true });

    el.lyricsScrollContainer.addEventListener('mousedown', () => {
      lyricsTouchActive = true;
      isManualUserScrollingLyrics = true;
    });

    window.addEventListener('mouseup', () => {
      if (lyricsTouchActive) {
        lyricsTouchActive = false;
        scheduleLyricsScrollReset();
      }
    });

    el.lyricsScrollContainer.addEventListener('wheel', () => {
      isManualUserScrollingLyrics = true;
      handleLyricsUserScroll();
      scheduleLyricsScrollReset();
    }, { passive: true });

    el.lyricsScrollContainer.addEventListener('scroll', () => {
      if (isManualUserScrollingLyrics && !programmaticScrollLock) {
        handleLyricsUserScroll();
      }
    }, { passive: true });
  }

  if (el.btnLyricsTimelinePlay) {
    el.btnLyricsTimelinePlay.addEventListener('click', (e) => {
      e.stopPropagation();
      seekToLyric(currentTimelineSeekTime);
    });
  }

  function renderLyrics() {
    if (state.lyrics.length === 0) {
      el.lyricsScrollContainer.innerHTML = '<div class="text-[14px] text-outline font-medium my-auto">暂无同步歌词</div>';
      return;
    }

    el.lyricsScrollContainer.innerHTML = '';
    state.lyrics.forEach((item, idx) => {
      const p = document.createElement('p');
      p.id = 'lyric-line-' + idx;
      p.className = 'lyric-line text-[16px] text-on-surface-variant/50 font-semibold py-1.5 cursor-pointer';
      p.textContent = item.text;
      p.dataset.time = String(item.time);
      p.dataset.index = String(idx);
      p.addEventListener('click', (e) => {
        e.stopPropagation();
        seekToLyric(item.time);
      });
      el.lyricsScrollContainer.appendChild(p);
    });
  }

  // Sync Lyrics with Current Time & Bluetooth Car AVRCP
  function syncLyrics(currentTimeSec, forceScroll = false) {
    if (state.lyrics.length === 0) return;

    let activeIdx = -1;
    for (let i = 0; i < state.lyrics.length; i++) {
      if (currentTimeSec >= state.lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== state.currentLyricIndex || forceScroll) {
      state.currentLyricIndex = activeIdx;
      document.querySelectorAll('.lyric-line').forEach((node, i) => {
        const isActive = i === activeIdx;
        node.classList.toggle('active', isActive);
        if (!isActive) {
          node.className = 'lyric-line text-[15px] text-on-surface-variant/40 font-semibold py-1.5' + (node.classList.contains('center-focused') ? ' center-focused' : '');
        }
      });

      // User requirement: Do not force back while user is manually scrolling lyrics!
      if (activeIdx >= 0 && (!isManualUserScrollingLyrics || forceScroll)) {
        const activeNode = document.getElementById('lyric-line-' + activeIdx);
        if (activeNode) {
          programmaticScrollLock = true;
          activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => { programmaticScrollLock = false; }, 500);
        }
      }

      // Bluetooth Car AVRCP lyric push
      const currentLyricText = (activeIdx >= 0 && state.lyrics[activeIdx]) ? (state.lyrics[activeIdx].text || '') : '';
      if (window.AndroidBridge && typeof window.AndroidBridge.updateCurrentLyric === 'function') {
        try {
          window.AndroidBridge.updateCurrentLyric(currentLyricText);
        } catch (e) {
          console.warn('Bluetooth car lyric push failed:', e);
        }
      }
    }
  }

  // Android Native Callbacks
  window.onOrientationChanged = function (isLandscape) {
    if (isLandscape) {
      if (el.vinylStage) el.vinylStage.classList.remove('hidden');
      if (el.lyricsStage) el.lyricsStage.classList.remove('hidden');
    } else {
      if (state.playerMode === 'lyrics') {
        if (el.vinylStage) el.vinylStage.classList.add('hidden');
        if (el.lyricsStage) el.lyricsStage.classList.remove('hidden');
      } else {
        if (el.vinylStage) el.vinylStage.classList.remove('hidden');
        if (el.lyricsStage) el.lyricsStage.classList.add('hidden');
      }
    }
    if (el.lyricsScrollContainer && state.currentLyricIndex >= 0) {
      setTimeout(() => {
        syncLyrics(state.currentTime, true);
      }, 250);
    }
  };

  window.addEventListener('resize', () => {
    const isLand = window.innerWidth > window.innerHeight;
    if (isLand) {
      if (el.vinylStage) el.vinylStage.classList.remove('hidden');
      if (el.lyricsStage) el.lyricsStage.classList.remove('hidden');
    }
    if (el.lyricsScrollContainer && state.currentLyricIndex >= 0) {
      syncLyrics(state.currentTime, true);
    }
  });

  window.onNativePlaybackStateChanged = function (isPlaying) {
    updatePlayState(isPlaying);
  };

  window.onNativePlaybackProgress = function (posMs, durMs) {
    if (state.isSeeking) return; // Prevent overwriting while dragging scrubber!
    state.currentTime = posMs / 1000;
    state.duration = durMs / 1000;

    el.currentTime.textContent = formatTime(state.currentTime);
    el.totalDuration.textContent = formatTime(state.duration);

    if (state.duration > 0) {
      const percent = Math.min(100, (state.currentTime / state.duration) * 100);
      el.progressBar.style.width = percent + '%';
      el.progressThumb.style.left = percent + '%';
      if (el.miniProgressBar) {
        el.miniProgressBar.style.width = percent + '%';
      }
    }

    syncLyrics(state.currentTime);
  };

  window.onNativeTrackCompleted = function () {
    if (state.playMode === 'loop') {
      if (state.currentTrack) playTrack(state.currentTrack);
    } else {
      playNext();
    }
  };

  window.onNativeFavoriteChanged = function (fav) {
    toggleFavoriteCurrentTrack(fav);
  };

  window.dispatchMediaEvent = function (action) {
    if (action === 'next') playNext();
    else if (action === 'prev') playPrev();
    else if (action === 'toggle') togglePlay();
    else if (action === 'fav') {
      toggleFavoriteCurrentTrack();
    }
    else if (action === 'lyric') {
      openFullPlayer();
      setPlayerMode('lyrics');
    }
  };

  function syncPlaybackFromNative() {
    if (window.AndroidBridge && typeof window.AndroidBridge.getPlaybackState === 'function') {
      try {
        const raw = window.AndroidBridge.getPlaybackState();
        const pb = JSON.parse(raw);
        if (pb && pb.track) {
          const trackChanged = !state.currentTrack || (state.currentTrack.ref && pb.track.ref && state.currentTrack.ref.id !== pb.track.ref.id);
          if (trackChanged) {
            state.currentTrack = pb.track;
            updateMiniPlayer(state.currentTrack);
            updateFullPlayer(state.currentTrack);
            updateFavHeart();
          }
        }
        if (typeof pb.isPlaying === 'boolean') {
          updatePlayState(pb.isPlaying);
        }
        if (pb.duration > 0 && !state.isSeeking) {
          state.currentTime = pb.currentPosition / 1000;
          state.duration = pb.duration / 1000;
          el.currentTime.textContent = formatTime(state.currentTime);
          el.totalDuration.textContent = formatTime(state.duration);
          const percent = Math.min(100, (state.currentTime / state.duration) * 100);
          el.progressBar.style.width = percent + '%';
          el.progressThumb.style.left = percent + '%';
          if (el.miniProgressBar) el.miniProgressBar.style.width = percent + '%';
          syncLyrics(state.currentTime);
        }
      } catch (e) {
        console.warn('syncPlaybackFromNative error:', e);
      }
    }
  }
  window.syncPlaybackFromNative = syncPlaybackFromNative;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncPlaybackFromNative();
    }
  });
  window.addEventListener('focus', syncPlaybackFromNative);

  // Search input triggers
  el.btnDoSearch.addEventListener('click', () => performSearch(el.searchInput.value.trim()));
  el.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(el.searchInput.value.trim());
  });
  el.searchInput.addEventListener('input', () => {
    el.btnClearSearch.classList.toggle('hidden', !el.searchInput.value);
  });
  el.btnClearSearch.addEventListener('click', () => {
    el.searchInput.value = '';
    el.btnClearSearch.classList.add('hidden');
    el.searchResultsSection.classList.add('hidden');
    el.hotSearchSection.classList.remove('hidden');
  });

  // Hot Search Pills
  document.querySelectorAll('.hot-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const q = tag.textContent.trim();
      el.searchInput.value = q;
      el.btnClearSearch.classList.remove('hidden');
      performSearch(q);
    });
  });

  // Settings: Quality Persistence (Bug 4)
  function syncQualityUI() {
    const q = state.preferredQuality || '320k';
    if (el.qualityButtons) {
      el.qualityButtons.forEach(b => {
        const matches = b.getAttribute('data-q') === q;
        b.className = matches
          ? 'quality-btn py-2 rounded-xl text-[11px] font-bold bg-primary text-white shadow-sm active-squish'
          : 'quality-btn py-2 rounded-xl text-[11px] font-bold bg-white/70 text-on-surface-variant border border-white/60 active-squish';
      });
    }
  }

  el.qualityButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      state.preferredQuality = q;
      state.currentQuality = q;
      localStorage.setItem('jelly_preferred_quality', q);
      localStorage.setItem('jelly_current_quality', q);
      syncAllQualityBadges();
      toast('首选音质已持久化: ' + q.toUpperCase());
    });
  });

  // ==========================================
  // Quality Picker Modal Drawer (Bug 5)
  // ==========================================
  function openQualityPickerModal() {
    if (!el.qualityModalOverlay) return;
    el.qualityModalOverlay.classList.remove('pointer-events-none');
    el.qualityModalOverlay.classList.add('active');
    
    // Highlight currently active quality option and checkmark
    const currentQ = state.currentQuality || state.preferredQuality || '320k';
    const currentTier = getPreferredTier(currentQ);
    const availQualities = state.currentTrack?.metadata?.qualities || [];
    const availSet = new Set(availQualities.map(q => String(q).trim().toLowerCase()));

    const options = el.qualityModalOverlay.querySelectorAll('.quality-picker-option');
    options.forEach(opt => {
      const q = opt.getAttribute('data-quality');
      const optTier = getPreferredTier(q);
      const isSelected = optTier === currentTier;
      const checkIcon = opt.querySelector('.quality-check-icon');
      if (checkIcon) checkIcon.classList.toggle('hidden', !isSelected);
      opt.classList.toggle('border-primary', isSelected);
      opt.classList.toggle('bg-primary/5', isSelected);

      // Support status indicator for current track
      let badge = opt.querySelector('.quality-avail-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'quality-avail-badge text-[10px] px-1.5 py-0.5 rounded font-bold ml-2';
        const titleDiv = opt.querySelector('.flex.items-center.gap-3 > div');
        if (titleDiv) {
          const firstLine = titleDiv.firstElementChild;
          if (firstLine) firstLine.appendChild(badge);
        }
      }

      if (availSet.size > 0) {
        let isAvail = false;
        if (optTier === 4) {
          isAvail = ['master', 'hires', 'atmos_plus', 'atmos', 'flac24bit'].some(k => availSet.has(k));
        } else if (optTier === 3) {
          isAvail = availSet.has('flac');
        } else if (optTier === 2) {
          isAvail = availSet.has('320k') || availSet.has('192k');
        } else {
          isAvail = availSet.has('128k') || availSet.has('low');
        }

        if (isAvail) {
          badge.textContent = '当前支持';
          badge.className = 'quality-avail-badge text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 bg-emerald-500/10 text-emerald-600';
          opt.style.opacity = '1';
        } else {
          badge.textContent = '无源将降级';
          badge.className = 'quality-avail-badge text-[10px] px-1.5 py-0.5 rounded font-medium ml-2 bg-black/5 text-outline';
          opt.style.opacity = '0.75';
        }
      } else {
        badge.textContent = '';
        opt.style.opacity = '1';
      }
    });
  }

  function closeQualityPickerModal() {
    if (!el.qualityModalOverlay) return;
    el.qualityModalOverlay.classList.remove('active');
    setTimeout(() => {
      if (!el.qualityModalOverlay.classList.contains('active')) {
        el.qualityModalOverlay.classList.add('pointer-events-none');
      }
    }, 300);
  }

  if (el.fullQualityPill) {
    el.fullQualityPill.addEventListener('click', (e) => {
      e.stopPropagation();
      openQualityPickerModal();
    });
  }

  if (el.btnCloseQualityModal) {
    el.btnCloseQualityModal.addEventListener('click', closeQualityPickerModal);
  }

  if (el.qualityModalOverlay) {
    el.qualityModalOverlay.addEventListener('click', (e) => {
      if (e.target === el.qualityModalOverlay) closeQualityPickerModal();
    });
  }

  // Handle Quality Option Selection (Seamless audio re-resolution at currentTime)
  document.querySelectorAll('.quality-picker-option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const chosenQ = opt.getAttribute('data-quality');
      closeQualityPickerModal();

      if (chosenQ === (state.currentQuality || state.preferredQuality) && state.isPlaying) {
        toast('当前正在播放此音质: ' + getQualityInfo(chosenQ).short);
        return;
      }

      state.preferredQuality = chosenQ;
      try { localStorage.setItem('jelly_preferred_quality', chosenQ); } catch (e) {}

      if (state.currentTrack) {
        toast('正在切换为 ' + getQualityInfo(chosenQ).short + ' 音质...');

        const currentPos = state.currentTime;
        try {
          const resolved = await resolveStreamWithFallback(state.currentTrack, chosenQ, state.currentTrack.metadata?.qualities);
          if (resolved && resolved.url) {
            const actualQ = resolved.actualQuality || chosenQ;
            state.currentQuality = actualQ;
            try { localStorage.setItem('jelly_current_quality', actualQ); } catch (e) {}
            syncAllQualityBadges();
            updateFullPlayer(state.currentTrack);
            updateMiniPlayer(state.currentTrack);

            const artists = state.currentTrack.metadata?.artists?.join(' / ') || state.currentTrack.subtitle || '未知歌手';
            const artwork = resolveTrackArtwork(state.currentTrack);
            const trackInfo = {
              title: state.currentTrack.title,
              artist: artists,
              coverUrl: artwork,
              duration: state.currentTrack.metadata?.durationMs || 0,
              isFavorite: isCurrentFav()
            };
            if (window.AndroidBridge && typeof window.AndroidBridge.playMusic === 'function') {
              window.AndroidBridge.playMusic(resolved.url, JSON.stringify(trackInfo));
            }
            if (currentPos > 1 && window.AndroidBridge && typeof window.AndroidBridge.seekTo === 'function') {
              setTimeout(() => {
                try { window.AndroidBridge.seekTo(Math.floor(currentPos * 1000)); } catch (e) {}
              }, 300);
            }

            if (getPreferredTier(actualQ) < getPreferredTier(chosenQ)) {
              toast('该歌曲暂无' + getQualityInfo(chosenQ).short + '，已降级选择' + getQualityInfo(actualQ).short + '播放');
            } else {
              toast('已切换至 ' + getQualityInfo(actualQ).full);
            }
          }
        } catch (err) {
          toast('播放失败: ' + (err.message || '网络连接异常'));
        }
      } else {
        state.currentQuality = chosenQ;
        try { localStorage.setItem('jelly_current_quality', chosenQ); } catch (e) {}
        syncAllQualityBadges();
        toast('首选音质已更改为: ' + getQualityInfo(chosenQ).short);
      }
    });
  });

  // ==========================================
  // Sound Source Plugin Management (Custom Sources, Local Files & Updates)
  // ==========================================
  function syncPluginUI() {
    const isInit = !!(window.MusicAPI && window.MusicAPI.initialized);
    let meta = null;
    try {
      meta = JSON.parse(localStorage.getItem('jelly_custom_plugin_meta') || 'null');
    } catch (e) {}

    const name = meta?.name || window.MusicAPI?.manifest?.name || '自定义音源';
    const version = meta?.version || window.MusicAPI?.manifest?.version || '1.0.0';
    const desc = meta?.description || window.MusicAPI?.manifest?.description || '已聚合主流平台全音质直通解析。';
    const updateUrl = meta?.updateUrl || meta?.homepage || '';

    // 1. Header Source Badge
    if (el.headerSourceDot) {
      el.headerSourceDot.className = isInit ? 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse' : 'w-2 h-2 rounded-full bg-amber-400';
    }
    if (el.headerSourceText) {
      el.headerSourceText.textContent = isInit ? name : '未配置音源';
    }

    // 2. Settings Card
    if (el.settingsPluginIconBg) {
      el.settingsPluginIconBg.className = isInit 
        ? 'w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center'
        : 'w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center';
    }
    if (el.settingsPluginStatusText) {
      if (isInit) {
        el.settingsPluginStatusText.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 已就绪 • ${escapeHtml(name)} v${escapeHtml(version)}`;
        el.settingsPluginStatusText.className = 'text-[12px] text-emerald-600 font-semibold flex items-center gap-1';
      } else {
        el.settingsPluginStatusText.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 未导入音源 • 待配置`;
        el.settingsPluginStatusText.className = 'text-[12px] text-amber-600 font-semibold flex items-center gap-1';
      }
    }
    if (el.settingsPluginBadge) {
      el.settingsPluginBadge.textContent = isInit ? 'ACTIVE' : 'UNSET';
      el.settingsPluginBadge.className = isInit 
        ? 'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold'
        : 'px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold';
    }
    if (el.settingsPluginDesc) {
      el.settingsPluginDesc.textContent = isInit ? desc : '默认安装不包含第三方内置音源。可手动导入本地文件、网络订阅或粘贴源码开启全网畅听。';
    }
    if (el.btnOpenPluginManagerText) {
      el.btnOpenPluginManagerText.textContent = isInit ? '管理与更新音源插件' : '导入与管理音源插件';
    }

    // 3. Plugin Modal
    if (el.pluginActiveIconBg) {
      el.pluginActiveIconBg.className = isInit 
        ? 'w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md'
        : 'w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-sm';
    }
    if (el.pluginActiveName) {
      el.pluginActiveName.textContent = isInit ? name : '未导入音源';
    }
    if (el.pluginActiveStatusTag) {
      el.pluginActiveStatusTag.textContent = isInit ? '运行中' : '待配置';
      el.pluginActiveStatusTag.className = isInit 
        ? 'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold'
        : 'px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold';
    }
    if (el.pluginActiveVersion) {
      el.pluginActiveVersion.textContent = isInit ? `版本: v${version} • CeruMusic Engine v2` : '暂未配置音源脚本';
    }
    if (el.pluginActiveDesc) {
      el.pluginActiveDesc.textContent = isInit ? desc : '当前未加载任何音乐源插件。请从下方导入音源脚本以开启全网无损播放与搜索。';
    }
    if (el.pluginActivePlatforms) {
      el.pluginActivePlatforms.classList.toggle('hidden', !isInit);
    }
    if (el.pluginActiveActions) {
      el.pluginActiveActions.classList.toggle('hidden', !isInit);
    }
    if (el.pluginDangerActions) {
      el.pluginDangerActions.classList.toggle('hidden', !isInit);
    }

    if (isInit && updateUrl && el.pluginUpdateCard && el.btnOpenUpdateUrl) {
      el.pluginUpdateCard.classList.remove('hidden');
      el.pluginUpdateStatusText.textContent = '支持更新链接 / 仓库主页';
      el.pluginUpdateNotes.textContent = '此音源配置了外部更新链接，可点击下方按钮直接跳转手机浏览器查看最新版本。';
      el.btnOpenUpdateUrl.classList.remove('hidden');
    } else if (el.btnOpenUpdateUrl) {
      el.btnOpenUpdateUrl.classList.add('hidden');
      if (!isInit && el.pluginUpdateCard) el.pluginUpdateCard.classList.add('hidden');
    }

    // 4. Discover Banner & Card
    if (el.discoverNoSourceBanner) {
      el.discoverNoSourceBanner.classList.toggle('hidden', isInit);
    }
    if (el.dailyRecCard) {
      el.dailyRecCard.classList.toggle('hidden', !isInit);
    }
  }
  window.syncPluginUI = syncPluginUI;

  function openPluginModal() {
    if (!el.pluginModalOverlay) return;
    syncPluginUI();
    el.pluginModalOverlay.classList.remove('translate-y-full');
  }

  function closePluginModal() {
    if (!el.pluginModalOverlay) return;
    el.pluginModalOverlay.classList.add('translate-y-full');
  }

  if (el.btnOpenPluginManager) {
    el.btnOpenPluginManager.addEventListener('click', openPluginModal);
  }
  if (el.headerSourceBadge) {
    el.headerSourceBadge.addEventListener('click', openPluginModal);
  }
  if (el.btnClosePluginModal) {
    el.btnClosePluginModal.addEventListener('click', closePluginModal);
  }
  if (el.btnDiscoverOpenPlugin) {
    el.btnDiscoverOpenPlugin.addEventListener('click', openPluginModal);
  }

  // ==========================================
  // CeruMusic Plugin Notice & Live Update System
  // ==========================================
  let activePluginNotice = null;
  const seenPluginUpdateVersions = new Set();

  function showPluginNoticeDialog(noticeData) {
    if (!noticeData || !el.pluginNoticeOverlay) return;
    activePluginNotice = noticeData;

    // Avoid duplicate popups if user dismissed this specific version in current session
    const updateKey = (noticeData.pluginName || '') + '_' + (noticeData.newVersion || noticeData.updateUrl);
    if (noticeData.isAuto && seenPluginUpdateVersions.has(updateKey)) {
      return;
    }

    if (el.pluginNoticeTitle) {
      el.pluginNoticeTitle.textContent = noticeData.title || '音源插件更新';
    }
    if (el.pluginNoticeSubtitle) {
      el.pluginNoticeSubtitle.textContent = noticeData.pluginName || '聆澜音源';
    }
    if (el.pluginNoticeCurrentVer) {
      el.pluginNoticeCurrentVer.textContent = noticeData.currentVersion || '1.0.0';
    }
    if (el.pluginNoticeNewVer) {
      el.pluginNoticeNewVer.textContent = noticeData.newVersion || '最新版本';
    }
    if (el.pluginNoticeMsg) {
      el.pluginNoticeMsg.textContent = noticeData.message || noticeData.notes || '发现新版本音源，建议更新以获得更佳解析效果。';
    }

    // Reset progress and buttons
    if (el.pluginNoticeProgressCard) el.pluginNoticeProgressCard.classList.add('hidden');
    if (el.pluginNoticeActionBtns) el.pluginNoticeActionBtns.classList.remove('hidden');
    if (el.btnOpenPluginUpdateBrowser) el.btnOpenPluginUpdateBrowser.classList.add('hidden');
    if (el.btnConfirmPluginUpdate) {
      el.btnConfirmPluginUpdate.disabled = false;
      el.btnConfirmPluginUpdate.innerHTML = '<span class="material-symbols-outlined text-[18px]">cloud_download</span><span>立即更新</span>';
    }

    // Show modal with animation
    el.pluginNoticeOverlay.classList.remove('pointer-events-none', 'opacity-0');
    el.pluginNoticeOverlay.classList.add('opacity-100');
    if (el.pluginNoticeCard) {
      el.pluginNoticeCard.classList.remove('scale-95');
      el.pluginNoticeCard.classList.add('scale-100');
    }
  }

  function closePluginNoticeDialog() {
    if (!el.pluginNoticeOverlay) return;
    if (activePluginNotice) {
      const updateKey = (activePluginNotice.pluginName || '') + '_' + (activePluginNotice.newVersion || activePluginNotice.updateUrl);
      seenPluginUpdateVersions.add(updateKey);
    }
    el.pluginNoticeOverlay.classList.remove('opacity-100');
    el.pluginNoticeOverlay.classList.add('opacity-0', 'pointer-events-none');
    if (el.pluginNoticeCard) {
      el.pluginNoticeCard.classList.remove('scale-100');
      el.pluginNoticeCard.classList.add('scale-95');
    }
  }

  window.showPluginNoticeDialog = showPluginNoticeDialog;
  window.closePluginNoticeDialog = closePluginNoticeDialog;

  async function performPluginUpdate(url, newVersion) {
    if (!url) {
      toast('更新地址缺失，无法下载');
      return;
    }

    if (el.pluginNoticeProgressCard) {
      el.pluginNoticeProgressCard.classList.remove('hidden');
    }
    if (el.pluginNoticeProgressText) {
      el.pluginNoticeProgressText.textContent = '正在下载新版本音源脚本...';
    }
    if (el.btnConfirmPluginUpdate) {
      el.btnConfirmPluginUpdate.disabled = true;
      el.btnConfirmPluginUpdate.innerHTML = '<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div><span>更新中...</span>';
    }

    try {
      // Download updated script using nativeHttpFetch (handles redirects and TLS cleanly)
      const res = await nativeHttpFetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'CeruMusic-Host/2.0.0 AuraMusic/1.0.0'
        }
      });

      if (res.status !== 200 || !res.body) {
        throw new Error(`下载失败 (HTTP ${res.status || 0})`);
      }

      const scriptContent = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
      if (scriptContent.length < 50) {
        throw new Error('下载的内容不是有效的 JavaScript 插件文件');
      }

      if (el.pluginNoticeProgressText) {
        el.pluginNoticeProgressText.textContent = '正在载入并激活新音源...';
      }

      // Evaluate and apply new plugin code
      await evalPluginCode(scriptContent, false, url);

      toast(`🎉 音源插件已成功更新至 ${newVersion || '最新版本'}！`);

      // Update plugin manager status card if visible
      if (el.pluginUpdateCard) {
        el.pluginUpdateCard.classList.remove('hidden');
        el.pluginUpdateStatusText.textContent = `已是最新版本 (${newVersion || '最新版'})`;
        el.pluginUpdateNotes.textContent = '刚刚完成自动更新，新版音源已加载就绪。';
      }

      setTimeout(() => {
        closePluginNoticeDialog();
      }, 600);
    } catch (err) {
      console.error('[PluginUpdate] Update failed:', err);
      toast('自动更新失败: ' + err.message);
      if (el.pluginNoticeProgressText) {
        el.pluginNoticeProgressText.textContent = '自动更新失败：' + (err.message || '网络连接超时');
      }
      if (el.btnOpenPluginUpdateBrowser) {
        el.btnOpenPluginUpdateBrowser.classList.remove('hidden');
      }
      if (el.btnConfirmPluginUpdate) {
        el.btnConfirmPluginUpdate.disabled = false;
        el.btnConfirmPluginUpdate.innerHTML = '<span class="material-symbols-outlined text-[18px]">refresh</span><span>重试更新</span>';
      }
    }
  }

  async function checkActivePluginUpdate(isManual = false) {
    let meta = null;
    try { meta = JSON.parse(localStorage.getItem('jelly_custom_plugin_meta') || '{}'); } catch (e) {}
    const manifest = window.MusicAPI?.manifest;
    const config = manifest?.config || {};

    if (!manifest && !meta.name) {
      if (isManual) toast('当前未安装音源插件，请先导入');
      return;
    }

    const currentVer = manifest?.version || meta.version || '1.0.0';

    // 1. CeruMusic / CR2 official update API check
    if (config.apiUrl && (config.apiKey || config.updateMd5)) {
      if (isManual) toast('正在向官方音源节点检测更新...');
      try {
        const base = config.apiUrl.replace(/\/$/, '');
        const updateCheckUrl = `${base}/script?checkUpdate=${encodeURIComponent(config.updateMd5 || currentVer)}&key=${encodeURIComponent(config.apiKey || '')}&type=${encodeURIComponent(config.type || 'cr')}&manifestVersion=2`;

        const res = await nativeHttpFetch(updateCheckUrl, {
          method: 'GET',
          headers: {
            'User-Agent': `CeruMusic-Plugin/${currentVer}`,
            'Content-Type': 'application/json'
          }
        });

        const respObj = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
        const updateData = respObj?.data;

        if (res.status === 200 && updateData && updateData.updateUrl) {
          const newVer = updateData.version || '最新版本';
          const cleanNew = newVer.replace(/^v/, '').trim();
          const cleanCurrent = currentVer.replace(/^v/, '').trim();

          if (cleanNew !== cleanCurrent) {
            showPluginNoticeDialog({
              type: 'update',
              dialogType: 'update',
              title: '发现音源新版本',
              pluginName: manifest?.name || '聆澜音源',
              currentVersion: currentVer,
              newVersion: newVer,
              updateUrl: updateData.updateUrl,
              message: updateData.updateMsg || '官方音源发布了新版本，建议立即更新以获得更稳定的音质解析与修复。',
              notes: updateData.updateMsg || '',
              isAuto: !isManual
            });
            return;
          }
        }

        if (isManual) {
          toast(`当前音源已是最新版本 (${currentVer})`);
        }
        if (el.pluginUpdateCard) {
          el.pluginUpdateCard.classList.remove('hidden');
          el.pluginUpdateStatusText.textContent = `已是最新版本 (${currentVer})`;
          el.pluginUpdateNotes.textContent = '核心解析规则与官方音源保持同步，运行状态良好。';
        }
        return;
      } catch (err) {
        console.warn('[CheckPluginUpdate] Error:', err);
        if (isManual) toast('检查更新失败: ' + err.message);
      }
    }

    // 2. Generic LX / raw url update check
    const updateUrl = meta.updateUrl || meta.homepage;
    if (updateUrl && updateUrl.startsWith('http')) {
      if (isManual) toast('正在检测音源主页...');
      try {
        const res = await nativeHttpFetch(updateUrl, { method: 'GET' });
        if (res.status === 200 && typeof res.body === 'string') {
          const verMatch = res.body.match(/version\s*:\s*['"]([^'"]+)['"]/);
          if (verMatch && verMatch[1] && verMatch[1] !== currentVer) {
            showPluginNoticeDialog({
              type: 'update',
              dialogType: 'update',
              title: '发现音源新版本',
              pluginName: meta.name || '自定义音源',
              currentVersion: currentVer,
              newVersion: verMatch[1],
              updateUrl: updateUrl,
              message: '检测到远程音源脚本已发布新版本，是否立即更新？',
              isAuto: !isManual
            });
            return;
          }
        }
        if (isManual) toast(`当前音源已是最新版本 (${currentVer})`);
      } catch (e) {
        if (isManual) toast('检查音源更新失败: ' + e.message);
      }
    } else {
      if (isManual) toast(`当前音源运行正常 (${currentVer})`);
    }
  }

  window.checkActivePluginUpdate = checkActivePluginUpdate;

  // Check Plugin Update Button
  if (el.btnCheckPluginUpdate) {
    el.btnCheckPluginUpdate.addEventListener('click', async () => {
      el.btnCheckPluginUpdate.disabled = true;
      try {
        await checkActivePluginUpdate(true);
      } finally {
        el.btnCheckPluginUpdate.disabled = false;
      }
    });
  }

  if (el.btnCancelPluginUpdate) {
    el.btnCancelPluginUpdate.addEventListener('click', closePluginNoticeDialog);
  }

  if (el.btnConfirmPluginUpdate) {
    el.btnConfirmPluginUpdate.addEventListener('click', () => {
      if (activePluginNotice && activePluginNotice.updateUrl) {
        performPluginUpdate(activePluginNotice.updateUrl, activePluginNotice.newVersion);
      }
    });
  }

  if (el.btnOpenPluginUpdateBrowser) {
    el.btnOpenPluginUpdateBrowser.addEventListener('click', () => {
      if (activePluginNotice && activePluginNotice.updateUrl) {
        if (window.AndroidBridge && typeof window.AndroidBridge.openExternalUrl === 'function') {
          window.AndroidBridge.openExternalUrl(activePluginNotice.updateUrl);
        } else {
          window.open(activePluginNotice.updateUrl, '_blank');
        }
      }
    });
  }

  // Open External Update Link in Browser
  if (el.btnOpenUpdateUrl) {
    el.btnOpenUpdateUrl.addEventListener('click', () => {
      let meta = null;
      try {
        meta = JSON.parse(localStorage.getItem('jelly_custom_plugin_meta') || '{}');
      } catch (e) {}
      const targetUrl = meta?.updateUrl || meta?.homepage;
      if (targetUrl) {
        toast('正在打开音源更新/主页链接...');
        if (window.AndroidBridge && typeof window.AndroidBridge.openExternalUrl === 'function') {
          window.AndroidBridge.openExternalUrl(targetUrl);
        } else {
          window.open(targetUrl, '_blank');
        }
      } else {
        toast('当前音源未提供更新链接');
      }
    });
  }

  // Reload Plugin
  if (el.btnReloadPlugin) {
    el.btnReloadPlugin.addEventListener('click', async () => {
      toast('正在重新加载音源引擎...');
      try {
        const savedCode = localStorage.getItem('jelly_custom_plugin_code');
        if (savedCode) {
          await evalPluginCode(savedCode, false);
          toast('音源引擎重新加载成功');
        } else if (typeof exports !== 'undefined' && exports.manifest && exports.activate) {
          window.MusicAPI.reset();
          await window.MusicAPI.init(exports.manifest, exports.activate);
          syncPluginUI();
          toast('音源引擎重新加载成功');
        } else {
          toast('当前未加载音源，请先导入');
        }
      } catch (err) {
        toast('重载音源失败: ' + err.message);
      }
    });
  }

  // Uninstall / Clear Plugin
  if (el.btnUninstallPlugin) {
    el.btnUninstallPlugin.addEventListener('click', () => {
      localStorage.removeItem('jelly_custom_plugin_code');
      localStorage.removeItem('jelly_custom_plugin_meta');
      window.MusicAPI.reset();
      if (typeof exports !== 'undefined') {
        try { delete exports.manifest; delete exports.activate; } catch (e) {}
      }
      syncPluginUI();
      if (el.discoverRankList) el.discoverRankList.innerHTML = '';
      if (el.discoverPlaylists) el.discoverPlaylists.innerHTML = '';
      toast('已清空并卸载当前音源插件');
    });
  }

  // Native plugin file loaded callback
  window.onPluginFileLoaded = async function (code, fileName) {
    toast('正在加载音源文件: ' + (fileName || '插件') + '...');
    try {
      await evalPluginCode(code, true);
    } catch (err) {
      toast(err.message);
    }
  };

  // Import Plugin from Local File
  if (el.btnImportFromFile) {
    el.btnImportFromFile.addEventListener('click', () => {
      // 1. Try to auto-scan Download directories for cr2-*.js / lx-*.js
      if (window.AndroidBridge && typeof window.AndroidBridge.scanDownloadedPlugin === 'function') {
        try {
          const scanned = window.AndroidBridge.scanDownloadedPlugin();
          if (scanned) {
            const data = JSON.parse(scanned);
            if (data && data.code) {
              toast('已在下载目录找到: ' + data.name + '，正在载入...');
              evalPluginCode(data.code, true);
              return;
            }
          }
        } catch (ignored) {}
      }
      // 2. Launch Android native document picker or fallback to HTML file input
      if (window.AndroidBridge && typeof window.AndroidBridge.pickPluginFile === 'function') {
        window.AndroidBridge.pickPluginFile();
      } else if (el.inputPluginFile) {
        el.inputPluginFile.click();
      }
    });

    if (el.inputPluginFile) {
      el.inputPluginFile.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        toast('正在读取本地音源文件: ' + file.name + '...');
        const reader = new FileReader();
        reader.onload = async function (evt) {
          const code = evt.target.result;
          try {
            await evalPluginCode(code, true);
            el.inputPluginFile.value = '';
          } catch (err) {
            toast(err.message);
          }
        };
        reader.onerror = function () {
          toast('读取文件失败，请检查文件权限');
        };
        reader.readAsText(file);
      });
    }
  }

  // Import Plugin by URL
  if (el.btnImportFromUrl) {
    el.btnImportFromUrl.addEventListener('click', async () => {
      const url = el.inputPluginUrl.value.trim();
      if (!url) {
        toast('请输入有效的插件脚本 URL');
        return;
      }
      toast('正在下载音源插件脚本...');
      try {
        const resp = await fetch(url);
        const code = await resp.text();
        await evalPluginCode(code, true, url);
        el.inputPluginUrl.value = '';
      } catch (e) {
        toast('导入插件失败: ' + (e.message || '网络无法访问'));
      }
    });
  }

  // Import Plugin by Direct Code
  if (el.btnImportFromCode) {
    el.btnImportFromCode.addEventListener('click', async () => {
      const code = el.inputPluginCode.value.trim();
      if (!code) {
        toast('请粘贴音源插件代码');
        return;
      }
      try {
        await evalPluginCode(code, true);
        el.inputPluginCode.value = '';
      } catch (e) {
        toast(e.message);
      }
    });
  }

  function extractLXPluginMeta(code) {
    try {
      const nameMatch = code.match(/name\s*:\s*['"]([^'"]+)['"]/);
      const verMatch = code.match(/version\s*:\s*['"]([^'"]+)['"]/);
      const descMatch = code.match(/description\s*:\s*['"]([^'"]+)['"]/);
      const authorMatch = code.match(/author\s*:\s*['"]([^'"]+)['"]/);
      const urlMatch = code.match(/homepage|updateUrl\s*:\s*['"]([^'"]+)['"]/);
      if (nameMatch) {
        return {
          name: nameMatch[1],
          version: verMatch ? verMatch[1] : '1.0.0',
          description: descMatch ? descMatch[1] : '',
          author: authorMatch ? authorMatch[1] : '',
          updateUrl: urlMatch ? urlMatch[1] : ''
        };
      }
    } catch (e) {}
    return null;
  }

  async function evalPluginCode(code, shouldToast = true, sourceUrl = '') {
    try {
      const customFn = new Function('window', 'exports', 'module', 'globalThis', code);
      const mod = { exports: {} };
      customFn(window, mod.exports, mod, window);
      const res = (mod.exports && (mod.exports.manifest || mod.exports.activate)) ? mod.exports : window.exports;
      if (res && res.manifest && res.activate) {
        window.MusicAPI.reset();
        await window.MusicAPI.init(res.manifest, res.activate);
        localStorage.setItem('jelly_custom_plugin_code', code);
        const updateUrl = res.manifest.updateUrl || res.manifest.homepage || res.manifest.rawUrl || res.manifest.sourceUrl || sourceUrl || '';
        const meta = {
          name: res.manifest.name || '自定义音源',
          version: res.manifest.version || '1.0.0',
          description: res.manifest.description || '',
          author: res.manifest.author || '',
          updateUrl: updateUrl
        };
        localStorage.setItem('jelly_custom_plugin_meta', JSON.stringify(meta));
        syncPluginUI();
        if (shouldToast) toast('音源插件加载成功: ' + meta.name);
        await loadDiscoverContent();
      } else if (typeof window.lxBridge !== 'undefined' || code.includes('lx.send') || code.includes('EVENT_NAMES') || code.includes('lx.on')) {
        const headerMeta = extractLXPluginMeta(code) || {
          name: '洛雪自定义音源',
          version: '1.0.0',
          description: '已导入自定义音乐源',
          author: '自定义作者',
          updateUrl: sourceUrl || ''
        };
        window.MusicAPI.reset();
        await window.MusicAPI.initLX(headerMeta, window.lxBridge);
        localStorage.setItem('jelly_custom_plugin_code', code);
        localStorage.setItem('jelly_custom_plugin_meta', JSON.stringify(headerMeta));
        syncPluginUI();
        if (shouldToast) toast('音源插件加载成功: ' + headerMeta.name);
        await loadDiscoverContent();
      } else {
        throw new Error('插件必须导出 manifest 与 activate 函数，或兼容洛雪音源规范');
      }
    } catch (err) {
      throw new Error('解析自定义插件失败: ' + err.message);
    }
  }
  window.evalPluginCode = evalPluginCode;

  // Settings: Clear Cache
  el.btnClearCache.addEventListener('click', () => {
    localStorage.removeItem('jelly_history');
    state.history = [];
    renderLibrary();
    toast('本地播放历史已清理');
  });

  // ==========================================
  // Personalized Tag-Based Daily Recommendation Engine (30 Tracks)
  // ==========================================
  const ARTIST_TAG_MAP = {
    // 日系 / ACG / 治愈 / 声优
    '鎖那': ['日系治愈', 'ACG动漫', '甜美清新', '日系物语'],
    '花泽香菜': ['日系治愈', 'ACG动漫', '甜美清新', '二次元萌系'],
    '雨宮天': ['日系流行', 'ACG动漫', '日系治愈', '声优精选'],
    '茶太': ['日系治愈', '同人音乐', '清新治愈', 'ACG物语'],
    'ヨルシカ': ['日系摇滚', 'J-Pop', '清新叙事', '日系治愈'],
    'YOASOBI': ['J-Pop', '日系流行', '节奏电音', 'ACG动漫'],
    'Aimer': ['日系流行', '深情治愈', '影视原声', 'J-Pop'],
    '米津玄师': ['J-Pop', '日系摇滚', '奇幻律动', '原创音乐'],
    'RADWIMPS': ['日系摇滚', '电影原声', 'J-Pop', '青春物语'],
    '鹿乃': ['ACG动漫', '日系治愈', '甜美清新', '二次元'],
    '水瀬いのり': ['ACG动漫', '日系流行', '声优精选'],
    '中岛美嘉': ['J-Pop', '经典日系', '抒情治愈'],
    '宇多田光': ['J-Pop', 'R&B流行', '经典日系'],
    'milet': ['J-Pop', '欧美质感', '影视原声'],
    'LiSA': ['日系摇滚', 'ACG热血', '动漫原声'],
    'supercell': ['ACG动漫', 'Vocaloid殿堂', '日系物语'],
    'EGOIST': ['ACG动漫', '日系流行', '空灵电音'],
    '茅野爱衣': ['ACG动漫', '声优精选', '日系治愈'],
    '悠木碧': ['ACG动漫', '声优精选', '萌系物语'],
    '下地紫野': ['ACG动漫', '日系治愈', '声优精选'],
    'ClariS': ['ACG动漫', '二次元甜美', '日系流行'],
    '早见沙织': ['ACG动漫', '声优精选', '清澈唯美'],
    '坂本真绫': ['ACG动漫', '空灵唯美', '经典治愈'],

    // 华语流行 / 流行情歌 / R&B
    '林俊杰': ['华语流行', '流行情歌', 'R&B流行', '00年代华语经典', '深情抒情'],
    '周杰伦': ['华语流行', '中国风', 'R&B流行', '青春回忆', '经典流行'],
    '陶喆': ['华语流行', 'R&B流行', '流行情歌', '经典华语'],
    '王力宏': ['华语流行', '流行情歌', '深情抒情', '优质流行'],
    '陈奕迅': ['华语流行', '深情抒情', '粤语经典', '故事感流行'],
    '孙燕姿': ['华语流行', '青春回忆', '文艺流行', '经典流行'],
    '梁静茹': ['流行情歌', '华语流行', '治愈温情', '深情抒情'],
    '蔡依林': ['华语舞曲', '流行流行', '节奏律动'],
    '萧亚轩': ['流行情歌', '都市节奏', '华语流行'],
    '张韶涵': ['华语流行', '励志高亢', '影视OST'],
    '田馥甄': ['文艺流行', '华语流行', '空灵抒情'],
    '薛之谦': ['流行情歌', '深情抒情', '华语流行'],
    '李荣浩': ['都市流行', '华语流行', '叙事流行'],
    '方大同': ['灵魂乐', 'R&B流行', '华语流行'],
    '韦礼安': ['文艺流行', '流行情歌', '清新抒情'],
    '张敬轩': ['粤语金曲', '华语流行', '深情抒情'],
    '汪苏泷': ['华语流行', '影视OST', '甜美情歌'],
    '杨丞琳': ['华语流行', '流行情歌', '深情抒情'],
    '容祖儿': ['粤语流行', '流行情歌', '华语经典'],
    '五月天': ['流行摇滚', '青春热血', '乐队现场', '青春回忆'],
    '苏打绿': ['文艺清新', '流行摇滚', '诗意流行'],
    '吴青峰': ['空灵天籁', '诗意流行', '文艺治愈'],

    // 民谣 / 独立
    '赵雷': ['独立民谣', '故事民谣', '治愈民谣', '吉他弹唱'],
    '朴树': ['人文民谣', '经典民谣', '深邃叙事'],
    '房东的猫': ['清新民谣', '治愈物语', '吉他弹唱', '文艺独立'],
    '毛不易': ['故事流行', '深情抒情', '人间烟火', '治愈系'],
    '宋冬野': ['民谣叙事', '经典民谣', '烟嗓情怀'],
    '李健': ['唯美民谣', '诗意人文', '纯净天籁'],
    '告五人': ['独立流行', '浪漫摇滚', '宝岛原创', '氛围流行'],
    '新裤子': ['复古摇滚', '朋克舞曲', '独立摇滚'],
    '回春丹': ['独立摇滚', '复古律动', '乐队现场'],

    // 古风 / OST / 天籁
    '周深': ['纯净天籁', '影视OST', '唯美仙侠', '国风国韵'],
    '单依纯': ['流行情歌', '深情R&B', '天籁抒情'],
    '郁可唯': ['影视OST', '流行情歌', '唯美抒情'],
    '张碧晨': ['影视OST', '流行情歌', '深情高亢'],
    '银临': ['古风国韵', '唯美古风', '原创国风'],
    '胡夏': ['影视OST', '清澈抒情', '青春回忆'],

    // 欧美流行
    'Taylor Swift': ['欧美流行', '流行乡村', '叙事流行', '流行原声'],
    'Ed Sheeran': ['欧美流行', '吉他流行', '暖心抒情'],
    'Billie Eilish': ['卧室流行', '迷幻暗黑', '独立流行'],
    'Bruno Mars': ['节奏布鲁斯', '复古放克', '欧美流行'],
    'The Weeknd': ['暗黑R&B', '复古合成器', '欧美流行'],
    'Ariana Grande': ['欧美流行', '节奏R&B', '流行天后'],
    'Justin Bieber': ['欧美流行', '当代R&B', '轻快节奏'],
    'Charlie Puth': ['欧美流行', '轻快节奏', '流行情歌']
  };

  const TAG_SIMILAR_ARTISTS = {
    '日系治愈': ['雨宮天', '花泽香菜', '茶太', '鹿乃', '茅野爱衣', 'ヨルシカ'],
    'ACG动漫': ['ヨルシカ', 'YOASOBI', 'Aimer', 'RADWIMPS', 'ClariS', '米津玄师'],
    'J-Pop': ['米津玄师', 'YOASOBI', 'Aimer', 'milet', '宇多田光', '中岛美嘉'],
    '华语流行': ['周杰伦', '陶喆', '陈奕迅', '孙燕姿', '梁静茹', '王力宏', '张韶涵'],
    '流行情歌': ['周杰伦', '薛之谦', '李荣浩', '梁静茹', '杨丞琳', '郁可唯', '韦礼安'],
    'R&B流行': ['陶喆', '周杰伦', '方大同', '单依纯', '韦礼安', '林宥嘉'],
    '青春回忆': ['周杰伦', '五月天', '孙燕姿', '王心凌', '张韶涵', '光良'],
    '独立民谣': ['房东的猫', '赵雷', '朴树', '陈鸿宇', '好妹妹', '马頔'],
    '治愈系': ['房东的猫', '周深', '李健', '郁可唯', '花泽香菜', '雨宮天'],
    '独立摇滚': ['告五人', '五月天', '落日飞车', '回春丹', '草东没有派对', '新裤子'],
    '影视OST': ['周深', '张碧晨', '郁可唯', '胡夏', '汪苏泷', '金玟岐'],
    '古风国韵': ['银临', '周深', '双笙', '音频怪物', '玄觞', '排骨教主'],
    '欧美流行': ['Taylor Swift', 'Ed Sheeran', 'Ariana Grande', 'Charlie Puth', 'Dua Lipa']
  };

  function getTodayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function updateDailyCalendarDate() {
    const now = new Date();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    if (el.dailyCalendarMonth) el.dailyCalendarMonth.textContent = monthNames[now.getMonth()];
    if (el.dailyCalendarDay) el.dailyCalendarDay.textContent = String(now.getDate());
    if (el.dailyRecDateTag) el.dailyRecDateTag.textContent = `${now.getMonth() + 1}月${now.getDate()}日更新`;
  }

  function normalizeTitle(t) {
    return (t || '').toLowerCase().replace(/\s*[\(\[（【].*?[\)\]）】]/g, '').trim();
  }

  // Strict check: Is track already in user's favorites?
  function isFavoritedTrack(track) {
    if (!track) return true;
    if (!state.favorites || state.favorites.length === 0) return false;

    // 1. Direct ID match
    if (track.ref?.id && state.favorites.some(f => f.ref?.id === track.ref?.id)) {
      return true;
    }

    const tTitle = normalizeTitle(track.title);
    const tArtist = (track.metadata?.artists?.[0] || track.subtitle || '').trim().toLowerCase();

    // 2. Exact or fuzzy title + artist match
    return state.favorites.some(f => {
      const fTitle = normalizeTitle(f.title);
      const fArtist = (f.metadata?.artists?.[0] || f.subtitle || '').trim().toLowerCase();
      if (!tTitle || !fTitle) return false;

      // Exact title match and artist overlap
      if (tTitle === fTitle) {
        if (!tArtist || !fArtist) return true;
        if (tArtist === fArtist || tArtist.includes(fArtist) || fArtist.includes(tArtist)) {
          return true;
        }
      }

      // Title starts with or contains the other and artist matches (e.g. "晴天 (Live)" vs "晴天")
      if ((tTitle.startsWith(fTitle) || fTitle.startsWith(tTitle)) && tArtist && fArtist) {
        if (tArtist === fArtist || tArtist.includes(fArtist) || fArtist.includes(tArtist)) {
          return true;
        }
      }

      return false;
    });
  }

  // Extract relevant genre/style/mood tags from track metadata
  function extractTagsFromTrack(track) {
    const tags = new Set();
    const artist = (track.metadata?.artists?.[0] || track.subtitle || '').trim();
    const title = track.title || '';
    const album = track.metadata?.album?.title || '';

    // 1. Match from ARTIST_TAG_MAP
    if (ARTIST_TAG_MAP[artist]) {
      ARTIST_TAG_MAP[artist].forEach(t => tags.add(t));
    } else {
      for (const [knownArtist, artistTags] of Object.entries(ARTIST_TAG_MAP)) {
        if (artist.includes(knownArtist) || knownArtist.includes(artist)) {
          artistTags.forEach(t => tags.add(t));
          break;
        }
      }
    }

    // 2. Language & script detection
    const fullText = `${title} ${album} ${artist}`;
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(fullText)) {
      tags.add('日系治愈');
      tags.add('ACG动漫');
      tags.add('J-Pop');
    }
    if (/[\uAC00-\uD7AF]/.test(fullText)) {
      tags.add('K-Pop');
      tags.add('韩语流行');
    }
    if (/^[A-Za-z0-9\s.,'?!-—–()]+$/.test(title) && !/[\u4e00-\u9fa5]/.test(artist)) {
      tags.add('欧美流行');
    }

    // 3. Keyword heuristics
    if (/治愈|安静|晚安|睡眠|温柔|旅|海|星|风|夏|雨|春|雪|旅程|旅途/i.test(fullText)) {
      tags.add('治愈系');
    }
    if (/情|爱|恋|心|思念|想念|痛|别|伤|泪|简单爱|浪漫/i.test(fullText)) {
      tags.add('流行情歌');
    }
    if (/侠|剑|江湖|月|叹|红颜|千|仙|古风/i.test(fullText)) {
      tags.add('古风国韵');
      tags.add('影视OST');
    }
    if (/吉他|民谣|南方|北方|故乡|路|理想/i.test(fullText)) {
      tags.add('独立民谣');
    }
    if (/摇滚|乐队|Live|现场|Rock|Party/i.test(fullText)) {
      tags.add('独立摇滚');
    }
    if (/纯音|钢琴|吉他|伴奏|轻音乐|Piano|Acoustic|Inst/i.test(fullText)) {
      tags.add('治愈纯音');
    }

    if (tags.size === 0) {
      tags.add('华语流行');
    }

    return Array.from(tags);
  }

  // Extract user's taste profile based on favorite songs
  function extractTasteProfile() {
    const favArtists = new Set();
    const hasFavorites = state.favorites && state.favorites.length > 0;

    if (!hasFavorites) {
      const historyWeights = {};
      (state.history || []).forEach(track => {
        extractTagsFromTrack(track).forEach(t => {
          historyWeights[t] = (historyWeights[t] || 0) + 1;
        });
      });
      const sorted = Object.entries(historyWeights).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      return {
        hasFavorites: false,
        topTags: sorted.slice(0, 4).length > 0 ? sorted.slice(0, 4) : ['华语流行', '治愈系', '流行情歌', '独立民谣'],
        favArtists: []
      };
    }

    // When favorites exist, extract tags for EACH favorite song to guarantee diversity
    const tagWeights = {};
    const perSongTags = [];

    state.favorites.forEach(track => {
      const artist = (track.metadata?.artists?.[0] || track.subtitle || '').trim();
      if (artist && artist !== '未知歌手' && artist !== '未知艺术家') {
        favArtists.add(artist);
      }
      const tags = extractTagsFromTrack(track);
      perSongTags.push(tags);
      tags.forEach(t => {
        tagWeights[t] = (tagWeights[t] || 0) + 1;
      });
    });

    // Ensure we pick at least the top tag from EACH favorited track
    const selectedTags = [];
    perSongTags.forEach(songTags => {
      if (songTags.length > 0 && !selectedTags.includes(songTags[0])) {
        selectedTags.push(songTags[0]);
      }
      if (songTags.length > 1 && selectedTags.length < 4 && !selectedTags.includes(songTags[1])) {
        selectedTags.push(songTags[1]);
      }
    });

    // Fill remaining tag slots up to 4 using highest overall weights
    const sortedTags = Object.entries(tagWeights).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    sortedTags.forEach(t => {
      if (selectedTags.length < 4 && !selectedTags.includes(t)) {
        selectedTags.push(t);
      }
    });

    return {
      hasFavorites: true,
      topTags: selectedTags.slice(0, 4),
      favArtists: Array.from(favArtists)
    };
  }

  async function generateDailyRecommendations(force = false) {
    if (!window.MusicAPI || !window.MusicAPI.initialized) return;
    const todayKey = getTodayDateString();
    updateDailyCalendarDate();

    // Check existing valid cache for today
    if (!force && state.dailyRecDate === todayKey && state.dailyRecTracks && state.dailyRecTracks.length >= 25) {
      // Re-verify that NO favorite track is in the cached list
      const hasFavInRec = state.dailyRecTracks.some(t => isFavoritedTrack(t));
      if (!hasFavInRec) {
        renderDailyRecCard();
        return;
      }
    }

    if (el.btnRefreshDailyRec) {
      el.btnRefreshDailyRec.classList.add('animate-spin');
    }

    try {
      const taste = extractTasteProfile();
      const tagPools = {};
      taste.topTags.forEach(t => { tagPools[t] = []; });
      const seen = new Set();

      // Build and execute queries for each dominant tag concurrently
      const dayNum = new Date().getDate();
      await Promise.all(taste.topTags.map(async (tag) => {
        const queries = [
          `${tag} 必听`,
          `${tag} 精选`
        ];

        // Add similar artists for this tag
        const simArtists = TAG_SIMILAR_ARTISTS[tag] || [];
        if (simArtists.length > 0) {
          const pick1 = simArtists[dayNum % simArtists.length];
          const pick2 = simArtists[(dayNum + 1) % simArtists.length];
          if (pick1) queries.push(`${pick1} 好听`);
          if (pick2 && pick2 !== pick1) queries.push(`${pick2} 好听`);
        }

        // Search songs for this tag in parallel
        const songPromises = queries.map(q => 
          window.MusicAPI.search(q, 'tx', 1, 15).catch(() => ({ items: [] }))
        );

        // Also search themed playlist for this tag
        const plPromise = window.MusicAPI.searchPlaylists(tag, 'tx', 1, 2)
          .then(async plRes => {
            const firstPl = plRes?.items?.[0];
            if (firstPl?.ref?.id) {
              const detail = await window.MusicAPI.getPlaylistDetail(firstPl.ref.id, 'tx').catch(() => null);
              return detail?.items || [];
            }
            return [];
          })
          .catch(() => []);

        const [songResults, plTracks] = await Promise.all([
          Promise.all(songPromises),
          plPromise
        ]);

        const rawList = [];
        songResults.forEach(r => {
          if (r?.items?.length > 0) rawList.push(...r.items);
        });
        if (plTracks?.length > 0) rawList.push(...plTracks);

        // Filter and tag candidate songs
        for (const track of rawList) {
          if (!track) continue;

          // STRICT FILTER: Discard any already favorited song!
          if (isFavoritedTrack(track)) {
            continue;
          }

          const artist = track.metadata?.artists?.[0] || track.subtitle || '';
          const key = `${normalizeTitle(track.title)}_${artist.trim().toLowerCase()}`;
          if (seen.has(key)) continue;

          seen.add(key);
          track._recTag = tag;
          tagPools[tag].push(track);
        }
      }));

      // Assemble 30 tracks by round-robin across tag pools
      const interleaved = [];
      const tags = taste.topTags;
      let hasMore = true;

      while (interleaved.length < 30 && hasMore) {
        hasMore = false;
        for (let i = 0; i < tags.length; i++) {
          const pool = tagPools[tags[i]];
          if (pool && pool.length > 0) {
            const track = pool.shift();
            // Re-verify strict non-favorite
            if (!isFavoritedTrack(track)) {
              interleaved.push(track);
              hasMore = true;
              if (interleaved.length >= 30) break;
            }
          }
        }
      }

      // If fewer than 30, supplement with candidates matching the top tags
      if (interleaved.length < 30) {
        try {
          const supRes = await window.MusicAPI.search(`${taste.topTags[0]} 热门`, 'tx', 1, 30);
          (supRes?.items || []).forEach(track => {
            if (interleaved.length >= 30) return;
            if (isFavoritedTrack(track)) return; // Strictly ignore favorites
            const artist = track.metadata?.artists?.[0] || track.subtitle || '';
            const key = `${normalizeTitle(track.title)}_${artist.trim().toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              track._recTag = taste.topTags[0];
              interleaved.push(track);
            }
          });
        } catch (supErr) {
          console.warn('Supplement search error:', supErr);
        }
      }

      const finalTracks = interleaved.slice(0, 30);
      state.dailyRecTracks = finalTracks;
      state.dailyRecDate = todayKey;
      state.dailyRecSummary = {
        title: '每日专属甄选 · 30首',
        tags: taste.topTags,
        subtitle: taste.hasFavorites
          ? `🎯 关联收藏标签「${taste.topTags.join(' · ')}」量身打造 · 已排除已收藏歌曲 · 每日自动更新`
          : `✨ 甄选全网高分华语流行与热门好歌 · 点赞心动歌曲越听越懂你`,
        date: todayKey
      };

      localStorage.setItem('jelly_daily_rec_date', todayKey);
      localStorage.setItem('jelly_daily_rec_tracks', JSON.stringify(finalTracks));
      localStorage.setItem('jelly_daily_rec_summary', JSON.stringify(state.dailyRecSummary));

      renderDailyRecCard();
    } catch (err) {
      console.error('Failed to generate daily recommendations:', err);
    } finally {
      if (el.btnRefreshDailyRec) {
        el.btnRefreshDailyRec.classList.remove('animate-spin');
      }
    }
  }

  function renderDailyRecCard() {
    updateDailyCalendarDate();
    if (!state.dailyRecTracks || state.dailyRecTracks.length === 0) {
      if (el.dailyRecPreviewList) {
        el.dailyRecPreviewList.innerHTML = '<div class="text-center py-4 text-[12px] text-outline">正在生成专属推荐...</div>';
      }
      return;
    }

    if (state.dailyRecSummary) {
      if (el.dailyRecTitle) el.dailyRecTitle.textContent = state.dailyRecSummary.title || '每日专属甄选 · 30首';
      if (el.dailyRecSubtitle) el.dailyRecSubtitle.textContent = state.dailyRecSummary.subtitle || '根据你收藏的歌曲与偏好量身定制';
      
      // Render active tags row
      if (el.dailyRecTagsRow && el.dailyRecTagsList) {
        const tags = state.dailyRecSummary.tags || [];
        if (tags.length > 0) {
          el.dailyRecTagsRow.classList.remove('hidden');
          el.dailyRecTagsList.innerHTML = tags.map(tag => 
            `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">${escapeHtml(tag)}</span>`
          ).join('');
        } else {
          el.dailyRecTagsRow.classList.add('hidden');
        }
      }
    }

    if (el.btnPlayAllDailyRecText) {
      el.btnPlayAllDailyRecText.textContent = `播放全部 (${state.dailyRecTracks.length}首)`;
    }

    if (el.dailyRecPreviewList) {
      el.dailyRecPreviewList.innerHTML = '';
      const preview = state.dailyRecTracks.slice(0, 3);
      preview.forEach((track, idx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2 rounded-xl bg-white/40 hover:bg-white/70 active-squish cursor-pointer transition-colors';
        const artist = track.metadata?.artists?.join(' / ') || track.subtitle || '未知歌手';
        const artwork = resolveTrackArtwork(track);
        const fallback = createFallbackCover(track.title, artist);
        item.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span class="w-4 text-center text-[12px] font-bold text-primary flex-shrink-0">0${idx + 1}</span>
            <img src="${artwork}" class="w-8 h-8 rounded-lg object-cover flex-shrink-0 bg-primary/10" onerror="this.onerror=null;this.src='${fallback}'" />
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[13px] font-bold text-on-surface truncate">${escapeHtml(track.title)}</span>
                ${track._recTag ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 flex-shrink-0">${escapeHtml(track._recTag)}</span>` : ''}
              </div>
              <span class="text-[11px] text-on-surface-variant truncate">${escapeHtml(artist)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-secondary-container/50 text-secondary uppercase">FLAC</span>
            <span class="material-symbols-outlined text-[20px] text-primary">play_circle</span>
          </div>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const pIdx = state.dailyRecTracks.findIndex(t => t.ref?.id === track.ref?.id);
          setQueue(state.dailyRecTracks, pIdx >= 0 ? pIdx : idx, '每日专属甄选 · 30首');
          playTrack(track);
        });
        el.dailyRecPreviewList.appendChild(item);
      });
    }
  }

  function openDailyRecPlaylistDetail() {
    if (!state.dailyRecTracks || state.dailyRecTracks.length === 0) {
      generateDailyRecommendations(true);
      return;
    }
    const now = new Date();
    const dateTitle = `${now.getMonth() + 1}月${now.getDate()}日 · 每日专属推荐`;
    const subtitle = state.dailyRecSummary?.subtitle || '根据你收藏的歌曲与歌手风格量身定制 · 每天自动更新';
    
    openPlaylistDetail(
      { id: 'daily-rec', providerId: 'jelly' },
      {
        title: dateTitle,
        author: subtitle,
        artworkUrl: state.dailyRecTracks[0]?.metadata?.artworkUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
        sourceBadge: '专属算法',
        tracks: state.dailyRecTracks
      }
    );
  }

  // Bind Daily Recommendation Actions
  if (el.btnQuickPlayFeatured) {
    el.btnQuickPlayFeatured.addEventListener('click', () => {
      if (state.dailyRecTracks && state.dailyRecTracks.length > 0) {
        setQueue(state.dailyRecTracks, 0, '每日专属甄选 · 30首');
        playTrack(state.dailyRecTracks[0]);
        toast(`开始播放每日专属推荐 (共${state.dailyRecTracks.length}首)`);
      } else {
        toast('正在为你生成今日推荐...');
        generateDailyRecommendations(true);
      }
    });
  }

  if (el.btnViewDailyRecDetail) el.btnViewDailyRecDetail.addEventListener('click', openDailyRecPlaylistDetail);
  if (el.dailyRecHeaderClick) el.dailyRecHeaderClick.addEventListener('click', openDailyRecPlaylistDetail);
  if (el.btnExpandDailyRec) el.btnExpandDailyRec.addEventListener('click', openDailyRecPlaylistDetail);

  if (el.btnRefreshDailyRec) {
    el.btnRefreshDailyRec.addEventListener('click', (e) => {
      e.stopPropagation();
      toast('正在根据最新点赞偏好重新计算...');
      generateDailyRecommendations(true).then(() => {
        toast('已为你重新生成今日推荐 (30首)');
      });
    });
  }

  // ==========================================
  // CeruMusic & LX Music Playlist Import / Export System
  // ==========================================
  const CERU_PLAYLIST_KEY = 'CeruMusic-PlaylistSecretKey';

  async function decompressGzip(arrayBuffer) {
    try {
      const ds = new DecompressionStream('gzip');
      const inStream = new Response(arrayBuffer).body.pipeThrough(ds);
      return await new Response(inStream).text();
    } catch (err) {
      throw new Error('Gzip 解压失败: ' + (err.message || '数据流格式错误'));
    }
  }

  async function compressGzip(str) {
    try {
      const cs = new CompressionStream('gzip');
      const inStream = new Response(str).body.pipeThrough(cs);
      return await new Response(inStream).blob();
    } catch (err) {
      throw new Error('Gzip 压缩失败: ' + (err.message || '未知错误'));
    }
  }

  function decryptCeruPlaylist(ciphertext) {
    try {
      const clean = ciphertext.trim();
      const decrypted = CryptoJS.AES.decrypt(clean, CERU_PLAYLIST_KEY).toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('解密结果为空，密码可能不匹配');
      return JSON.parse(decrypted);
    } catch (err) {
      throw new Error('澜音歌单解密失败: ' + (err.message || '数据已损坏或密钥不匹配'));
    }
  }

  function encryptCeruPlaylist(songs) {
    try {
      const jsonStr = JSON.stringify(songs);
      return CryptoJS.AES.encrypt(jsonStr, CERU_PLAYLIST_KEY).toString();
    } catch (err) {
      throw new Error('歌单加密失败: ' + (err.message || '数据序列化失败'));
    }
  }

  function parseIntervalToSeconds(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (str.includes(':')) {
      const parts = str.split(':').map(Number);
      if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
      if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    const n = parseInt(str, 10);
    return isNaN(n) ? 0 : n;
  }

  function normalizeImportedSong(song) {
    if (!song) return null;
    if (song.title && song.ref && song.ref.id) return song;

    const title = song.name || song.title || '未知曲目';
    const singer = song.singer || song.artist || (Array.isArray(song.artists) ? song.artists.join(' / ') : '') || '未知歌手';
    const providerId = (song.source || song.platform || 'tx').toLowerCase();
    const songId = String(song.songmid || song.id || song.hash || song.meta?.songId || ('track_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)));
    const albumName = song.albumName || song.album || song.meta?.albumName || '';
    const albumId = song.albumId || song.meta?.albumId || '';
    const img = song.img || song.artworkUrl || song.pic || song.cover || song.meta?.picUrl || '';
    const intervalSec = parseIntervalToSeconds(song.interval || song.duration || song.meta?.interval);

    const rawQualities = Array.isArray(song.types) && song.types.length > 0 
      ? song.types 
      : (song.meta?.qualitys ? song.meta.qualitys.map(q => q.type || q) : (song._types ? Object.keys(song._types) : ['128k', '320k', 'flac']));

    return {
      ref: {
        pluginId: 'ceru-music-importer',
        providerId: providerId,
        kind: 'track',
        id: songId
      },
      title: title,
      subtitle: singer,
      artworkUrl: img,
      metadata: {
        artists: singer.split(/[\/,、&]/).map(s => s.trim()).filter(Boolean),
        album: {
          title: albumName,
          id: albumId
        },
        artworkUrl: img,
        durationMs: intervalSec * 1000,
        qualities: rawQualities
      },
      data: {
        song: {
          songmid: songId,
          id: songId,
          hash: song.hash || songId,
          name: title,
          singer: singer,
          source: providerId,
          albumName: albumName,
          albumId: albumId,
          interval: song.interval || intervalSec,
          img: img,
          types: rawQualities,
          _types: song._types || {}
        }
      }
    };
  }

  function showImportStatus(title, desc, isError = false) {
    if (!el.importStatusCard) return;
    el.importStatusCard.classList.remove('hidden');
    if (el.importStatusTitle) {
      el.importStatusTitle.textContent = title;
      el.importStatusTitle.className = isError ? 'text-[13px] font-bold text-rose-500' : 'text-[13px] font-bold text-on-surface';
    }
    if (el.importStatusDesc) {
      el.importStatusDesc.textContent = desc;
    }
    const spinner = document.getElementById('importStatusSpinner');
    if (spinner) {
      if (isError) spinner.classList.add('hidden');
      else spinner.classList.remove('hidden');
    }
  }

  function hideImportStatus() {
    if (el.importStatusCard) el.importStatusCard.classList.add('hidden');
  }

  function openImportPlaylistModal() {
    if (!el.importPlaylistOverlay) return;
    hideImportStatus();
    if (el.inputImportPlaylistName) el.inputImportPlaylistName.value = '';
    if (el.textareaImportContent) el.textareaImportContent.value = '';
    el.importPlaylistOverlay.classList.remove('translate-y-full');
    if (el.miniPlayer) el.miniPlayer.classList.add('in-subpage');
  }

  function closeImportPlaylistModal() {
    if (!el.importPlaylistOverlay) return;
    el.importPlaylistOverlay.classList.add('translate-y-full');
    if (el.miniPlayer && (!el.playlistDetailOverlay || el.playlistDetailOverlay.classList.contains('translate-y-full'))) {
      el.miniPlayer.classList.remove('in-subpage');
    }
  }

  // Parse Raw Data from File, Text, or Clipboard
  async function parsePlaylistContent(rawTextOrBuffer, fileNameOrHint = '') {
    let playlistName = fileNameOrHint ? fileNameOrHint.replace(/\.(cmpl|cpl|lxmc|json)$/i, '') : '';
    let songItems = [];

    // Case 1: Binary ArrayBuffer (.cmpl or .lxmc)
    if (rawTextOrBuffer instanceof ArrayBuffer) {
      const isLxmc = (fileNameOrHint || '').toLowerCase().endsWith('.lxmc');
      showImportStatus('正在解压...', '正在通过 Gzip 解压文件数据');
      const text = await decompressGzip(rawTextOrBuffer);

      if (isLxmc) {
        showImportStatus('正在解析...', '正在处理洛雪音乐歌单');
        const parsed = JSON.parse(text);
        if (parsed.type === 'playListPart_v2' && parsed.data) {
          playlistName = parsed.data.name || playlistName;
          songItems = parsed.data.list || [];
        } else if (Array.isArray(parsed)) {
          songItems = parsed;
        } else if (parsed.list && Array.isArray(parsed.list)) {
          playlistName = parsed.name || playlistName;
          songItems = parsed.list;
        }
      } else {
        // Assume CeruMusic .cmpl
        showImportStatus('正在解密...', '正在通过 CeruMusic 密钥执行 AES 解密');
        const rawJson = decryptCeruPlaylist(text);
        if (Array.isArray(rawJson)) {
          songItems = rawJson;
        } else if (rawJson && Array.isArray(rawJson.list)) {
          playlistName = rawJson.name || playlistName;
          songItems = rawJson.list;
        }
      }
    } else if (typeof rawTextOrBuffer === 'string') {
      const content = rawTextOrBuffer.trim();
      if (!content) throw new Error('导入内容为空');

      // Case 2: CeruMusic AES Ciphertext (Base64)
      if (content.startsWith('U2Fsd') || content.length > 80 && !content.startsWith('{') && !content.startsWith('[') && !content.includes('\n') && !content.startsWith('http')) {
        showImportStatus('正在解密...', '正在识别澜音 AES 密文并解密');
        const decrypted = decryptCeruPlaylist(content);
        if (Array.isArray(decrypted)) {
          songItems = decrypted;
        } else if (decrypted && Array.isArray(decrypted.list)) {
          playlistName = decrypted.name || playlistName;
          songItems = decrypted.list;
        }
      }
      // Case 3: JSON Text
      else if (content.startsWith('{') || content.startsWith('[')) {
        showImportStatus('正在解析...', '正在读取 JSON 歌单数据');
        const parsed = JSON.parse(content);
        if (parsed.type === 'playListPart_v2' && parsed.data) {
          playlistName = parsed.data.name || playlistName;
          songItems = parsed.data.list || [];
        } else if (Array.isArray(parsed)) {
          songItems = parsed;
        } else if (parsed.list && Array.isArray(parsed.list)) {
          playlistName = parsed.name || playlistName;
          songItems = parsed.list;
        }
      }
      // Case 4: Online Playlist Share URL
      else if (content.includes('http://') || content.includes('https://')) {
        showImportStatus('正在识别网络歌单...', '正在提取歌单平台与编号');
        const qqMatch = content.match(/(?:playlist\/|id=)(\d{6,14})/);
        const wyMatch = content.match(/(?:playlist\?id=|playlist\/)(\d{5,14})/);
        const kgMatch = content.match(/(?:songlist|zlist)\/([a-zA-Z0-9]{6,36})/);

        let source = 'tx';
        let playlistId = '';

        if (qqMatch) {
          source = 'tx';
          playlistId = qqMatch[1];
          playlistName = playlistName || `QQ音乐歌单 (${playlistId})`;
        } else if (wyMatch) {
          source = 'wy';
          playlistId = wyMatch[1];
          playlistName = playlistName || `网易云歌单 (${playlistId})`;
        } else if (kgMatch) {
          source = 'kg';
          playlistId = kgMatch[1];
          playlistName = playlistName || `酷狗歌单 (${playlistId})`;
        } else {
          throw new Error('未识别出支持的歌单分享链接（支持 QQ音乐 / 网易云 / 酷狗）');
        }

        showImportStatus('正在获取在线歌曲...', `从 ${source.toUpperCase()} 平台检索歌单曲目`);
        if (window.MusicAPI && typeof window.MusicAPI.getPlaylistDetail === 'function') {
          const res = await window.MusicAPI.getPlaylistDetail(playlistId, source);
          if (res && res.items && res.items.length > 0) {
            playlistName = res.title || playlistName;
            songItems = res.items;
          } else {
            throw new Error('未能从当前音源插件获取到该网络歌单的歌曲，请检查网络或音源插件状态');
          }
        } else {
          throw new Error('当前音源未初始化，无法在线获取网络歌单曲目');
        }
      }
      // Case 5: Plain Text Song List (one song per line, e.g. "歌名 - 歌手")
      else {
        showImportStatus('正在解析歌名清单...', '按行拆分歌曲与歌手');
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) throw new Error('未能提取到任何歌曲');

        playlistName = playlistName || ('文本导入歌单 - ' + new Date().toISOString().slice(0, 10));
        songItems = lines.map((line, idx) => {
          // Remove leading numbers like "1. ", "01- ", "1 "
          const cleanLine = line.replace(/^\d+[\.\-\s、]\s*/, '').trim();
          let title = cleanLine;
          let singer = '未知歌手';

          if (cleanLine.includes(' - ')) {
            const parts = cleanLine.split(' - ');
            title = parts[0].trim();
            singer = parts.slice(1).join(' - ').trim();
          } else if (cleanLine.includes('——')) {
            const parts = cleanLine.split('——');
            title = parts[0].trim();
            singer = parts.slice(1).join('——').trim();
          } else if (cleanLine.includes(' ')) {
            const parts = cleanLine.split(/\s+/);
            title = parts[0].trim();
            singer = parts.slice(1).join(' ').trim();
          }

          return {
            name: title,
            singer: singer,
            source: 'mix',
            songmid: 'text_' + Date.now() + '_' + idx,
            interval: '03:30'
          };
        });
      }
    }

    if (!songItems || !Array.isArray(songItems) || songItems.length === 0) {
      throw new Error('未能解析到任何有效歌曲数据');
    }

    // Normalize all tracks into AuraMusic standard structure
    const normalizedTracks = songItems.map(normalizeImportedSong).filter(Boolean);
    return {
      name: playlistName || ('导入歌单 - ' + new Date().toISOString().slice(0, 10)),
      tracks: normalizedTracks
    };
  }

  function saveImportedPlaylist(name, tracks) {
    if (!tracks || tracks.length === 0) throw new Error('歌单曲目为空');
    const plId = 'imported_' + Date.now();
    const plTitle = name || ('导入歌单 - ' + new Date().toISOString().slice(0, 10));
    const firstArtwork = tracks.find(t => t.artworkUrl)?.artworkUrl || '';

    const newPlaylist = {
      ref: {
        pluginId: 'ceru-music-importer',
        providerId: tracks[0]?.ref?.providerId || 'tx',
        kind: 'playlist',
        id: plId
      },
      title: plTitle,
      author: '本地导入',
      subtitle: `${tracks.length} 首歌曲 • 澜音/CeruMusic`,
      artworkUrl: firstArtwork,
      playlist: {
        author: '本地导入',
        artworkUrl: firstArtwork,
        trackCount: tracks.length
      },
      tracks: tracks
    };

    state.favoritePlaylists.unshift(newPlaylist);
    try {
      localStorage.setItem('jelly_fav_playlists', JSON.stringify(state.favoritePlaylists));
    } catch (e) {}

    renderLibrary();
    return newPlaylist;
  }

  // Handle File Input (.cmpl, .cpl, .lxmc, .json)
  async function handlePlaylistFileInput(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();
    showImportStatus('正在读取文件...', `正在加载 ${fileName}`);

    try {
      let result;
      if (lowerName.endsWith('.cmpl') || lowerName.endsWith('.lxmc')) {
        // Read as ArrayBuffer for gzip
        const buffer = await file.arrayBuffer();
        result = await parsePlaylistContent(buffer, fileName);
      } else {
        // Read as text (.cpl or .json)
        const text = await file.text();
        result = await parsePlaylistContent(text, fileName);
      }

      const savedPl = saveImportedPlaylist(result.name, result.tracks);
      toast(`成功导入歌单「${savedPl.title}」，共 ${result.tracks.length} 首歌曲！`);
      closeImportPlaylistModal();

      // Open imported playlist immediately
      openPlaylistDetail(savedPl.ref, {
        title: savedPl.title,
        author: savedPl.author,
        artworkUrl: savedPl.artworkUrl,
        trackCount: savedPl.tracks.length,
        tracks: savedPl.tracks
      });
    } catch (err) {
      console.error('File import error:', err);
      showImportStatus('导入失败', err.message || '文件读取或解析失败', true);
      toast('导入失败: ' + (err.message || '格式不支持'));
    } finally {
      e.target.value = '';
    }
  }

  // Handle Clipboard Import
  async function handleClipboardImport() {
    showImportStatus('正在读取剪贴板...', '正在从系统剪贴板获取内容');
    try {
      let clipText = '';
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        clipText = await navigator.clipboard.readText();
      }

      if (!clipText || !clipText.trim()) {
        throw new Error('系统剪贴板为空或未授权读取剪贴板');
      }

      const customName = el.inputImportPlaylistName ? el.inputImportPlaylistName.value.trim() : '';
      const result = await parsePlaylistContent(clipText, customName);
      const savedPl = saveImportedPlaylist(customName || result.name, result.tracks);

      toast(`成功从剪贴板导入歌单「${savedPl.title}」，共 ${result.tracks.length} 首歌曲！`);
      closeImportPlaylistModal();

      openPlaylistDetail(savedPl.ref, {
        title: savedPl.title,
        author: savedPl.author,
        artworkUrl: savedPl.artworkUrl,
        trackCount: savedPl.tracks.length,
        tracks: savedPl.tracks
      });
    } catch (err) {
      console.error('Clipboard import error:', err);
      showImportStatus('剪贴板导入失败', err.message || '未能识别剪贴板内容', true);
      toast('剪贴板导入失败: ' + (err.message || '内容格式不支持'));
    }
  }

  // Handle Textarea Text Import
  async function handleTextImport() {
    const content = el.textareaImportContent ? el.textareaImportContent.value.trim() : '';
    if (!content) {
      toast('请先在输入框中粘贴歌单数据、链接或歌曲清单');
      return;
    }

    const customName = el.inputImportPlaylistName ? el.inputImportPlaylistName.value.trim() : '';
    showImportStatus('正在解析...', '正在处理输入的内容');

    try {
      const result = await parsePlaylistContent(content, customName);
      const savedPl = saveImportedPlaylist(customName || result.name, result.tracks);

      toast(`成功导入歌单「${savedPl.title}」，共 ${result.tracks.length} 首歌曲！`);
      closeImportPlaylistModal();

      openPlaylistDetail(savedPl.ref, {
        title: savedPl.title,
        author: savedPl.author,
        artworkUrl: savedPl.artworkUrl,
        trackCount: savedPl.tracks.length,
        tracks: savedPl.tracks
      });
    } catch (err) {
      console.error('Text import error:', err);
      showImportStatus('导入失败', err.message || '内容解析失败', true);
      toast('导入失败: ' + (err.message || '格式不匹配'));
    }
  }

  // Export Playlist (Compatible with CeruMusic .cmpl and Clipboard AES)
  async function exportCurrentPlaylist(mode = 'file') {
    if (!currentPlaylistTracks || currentPlaylistTracks.length === 0) {
      toast('当前歌单为空，无法导出');
      return;
    }

    const title = el.plDetailTitle ? el.plDetailTitle.textContent.trim() : '我的歌单';
    toast('正在生成澜音兼容歌单数据...');

    try {
      // Map to CeruMusic SongList schema
      const ceruItems = currentPlaylistTracks.map(t => {
        const rawQualities = (t.metadata?.qualities || ['128k', '320k', 'flac']);
        return {
          songmid: String(t.ref?.id || t.id || ''),
          name: t.title || '未知歌曲',
          singer: t.metadata?.artists?.join(' / ') || t.subtitle || '未知歌手',
          albumName: t.metadata?.album?.title || '',
          albumId: t.metadata?.album?.id || '',
          source: (t.ref?.providerId || 'tx').toLowerCase(),
          interval: formatTime(Math.floor((t.metadata?.durationMs || 0) / 1000)),
          img: t.artworkUrl || t.metadata?.artworkUrl || '',
          lrc: null,
          types: rawQualities,
          _types: {}
        };
      });

      const encryptedText = encryptCeruPlaylist(ceruItems);

      if (mode === 'clipboard') {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(encryptedText);
          toast(`已将「${title}」加密歌单复制到剪贴板，可直接在 CeruMusic 导入`);
        } else {
          toast('剪贴板写入受限，请选择导出为文件');
        }
      } else {
        // Gzip compression for .cmpl format
        const blob = await compressGzip(encryptedText);
        const fileName = `${title.replace(/[\/\\:*?"<>|]/g, '_')}-${new Date().toISOString().slice(0, 10)}.cmpl`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 300);

        toast(`已导出澜音歌单文件: ${fileName}`);
      }
    } catch (err) {
      console.error('Export playlist error:', err);
      toast('导出歌单失败: ' + (err.message || '未知错误'));
    }
  }

  // Export Playlist Button Click: Show action options
  function handleExportPlaylistClick() {
    const hasClipboard = navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
    const choice = confirm(`是否导出当前歌单？\n\n点击【确定】导出为澜音 .cmpl 格式文件\n点击【取消】${hasClipboard ? '复制加密文本到剪贴板' : '关闭'}`);
    if (choice) {
      exportCurrentPlaylist('file');
    } else if (hasClipboard) {
      exportCurrentPlaylist('clipboard');
    }
  }

  // Register CeruMusic Import & Export Event Listeners
  if (el.btnOpenImportPlaylist) {
    el.btnOpenImportPlaylist.addEventListener('click', openImportPlaylistModal);
  }
  if (el.btnCloseImportPlaylist) {
    el.btnCloseImportPlaylist.addEventListener('click', closeImportPlaylistModal);
  }
  if (el.btnChoosePlaylistFile && el.playlistFileInput) {
    el.btnChoosePlaylistFile.addEventListener('click', () => el.playlistFileInput.click());
    el.playlistFileInput.addEventListener('change', handlePlaylistFileInput);
  }
  if (el.btnImportFromClipboard) {
    el.btnImportFromClipboard.addEventListener('click', handleClipboardImport);
  }
  if (el.btnConfirmTextImport) {
    el.btnConfirmTextImport.addEventListener('click', handleTextImport);
  }
  if (el.btnExportPlaylist) {
    el.btnExportPlaylist.addEventListener('click', handleExportPlaylistClick);
  }

  // Initialize CeruMusic Engine
  async function initEngine() {
    try {
      syncAllQualityBadges();

      // Check if custom plugin code was saved in localStorage
      const customCode = localStorage.getItem('jelly_custom_plugin_code');
      if (customCode) {
        try {
          await evalPluginCode(customCode, false);
        } catch (e) {
          console.warn('Failed to load custom plugin from storage:', e);
        }
      }

      syncPluginUI();
      updatePlayState(false);

      // Restore Library subtab
      const savedLibraryTab = localStorage.getItem('jelly_library_subtab') || 'playlists';
      setLibraryTab(savedLibraryTab);

      // Restore active view (discover, search, library, settings)
      const savedView = localStorage.getItem('jelly_active_view');
      if (savedView && el.views[savedView] && savedView !== 'discover') {
        switchView(savedView);
      }

      // Restore playback from native service if active, or restore last track in mini player
      syncPlaybackFromNative();
      if (state.currentTrack) {
        updateMiniPlayer(state.currentTrack);
        updateFullPlayer(state.currentTrack);
      }

      // Restore opened playlist detail if user was viewing one
      const savedPlJson = localStorage.getItem('jelly_open_playlist');
      if (savedPlJson) {
        try {
          const p = JSON.parse(savedPlJson);
          if (p && p.ref) {
            openPlaylistDetail(p.ref, p.info || {}, false);
          }
        } catch (e) {}
      }

      // Restore full player if it was open
      if (localStorage.getItem('jelly_full_player_open') === 'true' && state.currentTrack) {
        openFullPlayer();
      }

      // Load rank hot tracks, playlists and daily recommendations if plugin is initialized
      if (window.MusicAPI && window.MusicAPI.initialized) {
        await loadDiscoverContent();
        // Check for sound source plugin updates automatically in background (matching CeruMusic logic)
        setTimeout(() => {
          checkActivePluginUpdate(false);
        }, 1200);
      }
    } catch (e) {
      console.error('Engine init error:', e);
    }
  }

  async function loadDiscoverContent() {
    if (!window.MusicAPI || !window.MusicAPI.initialized) {
      syncPluginUI();
      return;
    }
    syncPluginUI();

    // 1. Load personalized daily recommendations (30 tracks)
    generateDailyRecommendations();

    // 2. Load hot ranking songs
    try {
      const res = await window.MusicAPI.search('热门', 'tx', 1, 8);
      if (res && res.items && el.discoverRankList) {
        el.discoverRankList.innerHTML = '';
        res.items.slice(0, 5).forEach((track, idx) => {
          const div = document.createElement('div');
          div.className = 'jelly-glass rounded-2xl p-3 flex items-center justify-between gap-3 active-squish cursor-pointer shadow-sm';
          const artists = track.metadata?.artists?.join(' / ') || track.subtitle || '未知歌手';
          const artwork = resolveTrackArtwork(track);
          const fallback = createFallbackCover(track.title, artists);
          div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <span class="w-6 text-center text-[15px] font-bold ${idx < 3 ? 'text-primary' : 'text-outline'}">0${idx + 1}</span>
              <img src="${artwork}" onerror="this.onerror=null;this.src='${fallback}'" class="w-10 h-10 rounded-xl object-cover bg-primary/10" />
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-[14px] font-bold text-on-surface truncate">${escapeHtml(track.title)}</span>
                <span class="text-[12px] text-on-surface-variant truncate">${escapeHtml(artists)}</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary text-[10px] font-bold">FLAC</span>
          `;
          div.addEventListener('click', () => {
            setQueue(res.items, idx, '全网热歌榜单');
            playTrack(track);
          });
          el.discoverRankList.appendChild(div);
        });
      }
    } catch (e) {
      console.error('Discover error:', e);
    }

    // 3. Load Discover Playlists
    try {
      const plRes = await window.MusicAPI.getPlaylists('tx', 1, 6);
      const plItems = plRes?.items || [];
      if (plItems.length > 0 && el.discoverPlaylists) {
        el.discoverPlaylists.innerHTML = '';
        plItems.slice(0, 6).forEach(pl => {
          const card = createPlaylistCard(pl, () => {
            openPlaylistDetail(pl.ref, {
              title: pl.title,
              author: pl.subtitle || pl.playlist?.author || '精选推荐',
              artworkUrl: pl.playlist?.artworkUrl || pl.artworkUrl,
              trackCount: pl.playlist?.trackCount
            });
          });
          el.discoverPlaylists.appendChild(card);
        });
      }
    } catch (e) {
      console.error('Discover playlists error:', e);
    }
  }
  window.loadDiscoverContent = loadDiscoverContent;

  // Start initialization
  initEngine();
})();
