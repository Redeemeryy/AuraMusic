(function () {
  if (!window.AuraUpdater || window.AuraStorageMigrationPending) return;
  const find = id => document.getElementById(id);
  const overlay = find('appUpdateOverlay'), card = find('appUpdateCard');
  const confirm = find('btnConfirmAppUpdate'), cancel = find('btnCancelAppUpdate');
  let state = { status: 'idle' }, manual = false, returnFocus = null, hiddenByUser = false;
  const dismissed = new Set();
  const busy = () => ['checking', 'downloading', 'verifying', 'patching', 'installing'].includes(state.status);
  const cancellable = () => ['downloading', 'verifying', 'patching'].includes(state.status);
  function bytes(value) {
    const size = Math.max(0, Number(value) || 0);
    return size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
  }
  function show() {
    if (overlay.getAttribute('aria-hidden') === 'true') returnFocus = document.activeElement;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100');
    card.classList.remove('scale-95'); card.classList.add('scale-100');
    if (!overlay.contains(document.activeElement)) cancel.focus({ preventScroll: true });
  }
  function hide() {
    hiddenByUser = true;
    if (state.version) dismissed.add(`${state.kind}:${state.version}`);
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.add('opacity-0', 'pointer-events-none'); overlay.classList.remove('opacity-100');
    card.classList.add('scale-95'); card.classList.remove('scale-100');
    returnFocus?.focus?.({ preventScroll: true });
    manual = false;
  }
  function render(next) {
    if (!next || typeof next.status !== 'string') return;
    state = { ...state, ...next };
    const isWeb = state.kind === 'web';
    const labels = { checking: '正在检查更新', available: isWeb ? '有新的界面更新' : '灵音有新版本', downloading: '正在下载更新', verifying: '正在校验更新', patching: '正在准备新版', ready_web: '界面更新已就绪', ready_apk: '新版安装包已就绪', installing: '正在安装新版', current: '已是最新版本', error: '更新暂未完成', cancelled: '已暂停更新' };
    find('appUpdateTitle').textContent = labels[state.status] || '软件更新';
    find('appUpdateReleaseTitle').textContent = isWeb ? '只更新界面资源，无需安装 APK' : '覆盖升级，保留歌单和设置';
    find('appUpdateNewVer').textContent = state.version || '—';
    if (state.notes) find('appUpdateNotes').textContent = state.notes;
    else if (state.status === 'checking') find('appUpdateNotes').textContent = '正在获取最新更新信息…';
    find('appUpdateTransfer').hidden = false;
    find('appUpdateStatus').textContent = state.message || (state.status === 'ready_web' ? '应用后重新载入界面，当前音频继续播放。' : labels[state.status] || '');
    const progress = find('appUpdateProgress');
    const percent = state.total > 0 ? Math.min(100, Math.max(0, Math.round((state.downloaded || 0) / state.total * 100))) : 0;
    progress.hidden = !['downloading', 'verifying', 'patching'].includes(state.status);
    progress.setAttribute('aria-valuenow', String(percent));
    progress.firstElementChild.style.width = `${percent}%`;
    find('appUpdateBytes').textContent = state.status === 'downloading' ? `${bytes(state.downloaded)} / ${state.total > 0 ? bytes(state.total) : '计算大小中'}` : state.status === 'available' && state.total > 0 ? `预计下载 ${bytes(state.total)}` : '';
    confirm.disabled = busy();
    confirm.setAttribute('aria-busy', String(busy()));
    const action = state.status === 'ready_web' ? '应用界面更新' : state.status === 'ready_apk' ? '安装新版' : ['error', 'cancelled'].includes(state.status) ? '重试更新' : state.status === 'current' ? '完成' : busy() ? '请稍候' : '下载更新';
    confirm.replaceChildren(document.createTextNode(action));
    cancel.textContent = cancellable() ? '取消下载' : '稍后';
    const badge = find('appUpdateBadge');
    if (['available', 'ready_web', 'ready_apk'].includes(state.status)) badge?.classList.remove('hidden');
    if (state.status === 'current') badge?.classList.add('hidden');
    if (manual || (!hiddenByUser && ['available', 'ready_web', 'ready_apk'].includes(state.status) && !dismissed.has(`${state.kind}:${state.version}`))) show();
  }
  window.onAuraUpdateState = render;
  window.AuraUpdateUI = {
    check(isManual) {
      if (isManual) { manual = true; hiddenByUser = false; }
      if (['available', 'ready_web', 'ready_apk'].includes(state.status) || busy()) { if (isManual) show(); return; }
      render({ status: 'checking', downloaded: 0, total: 0 });
      try { window.AuraUpdater.check(); } catch (_) { render({ status: 'error', message: '无法启动更新，请稍后重试。' }); }
    },
    confirm() {
      if (busy()) return;
      hiddenByUser = false;
      if (state.status === 'ready_web') window.AuraUpdater.applyWebUpdate();
      else if (state.status === 'ready_apk') window.AuraUpdater.install();
      else if (state.status === 'current') hide();
      else { manual = true; window.AuraUpdater.start(); }
    },
    dismiss() { if (cancellable()) window.AuraUpdater.cancel(); else hide(); },
    hide
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
  document.addEventListener('keydown', e => {
    if (overlay.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') { e.preventDefault(); hide(); }
    if (e.key === 'Tab') {
      const buttons = Array.from(overlay.querySelectorAll('button:not([disabled])')).filter(b => b.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  try {
    const version = JSON.parse(window.AndroidBridge?.getAppVersion?.() || '{}').versionName;
    find('appUpdateCurrentVer').textContent = version ? `v${version}` : '当前版本';
    render(JSON.parse(window.AuraUpdater.getState()));
  } catch (_) {}
})();
