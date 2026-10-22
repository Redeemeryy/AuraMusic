
// Polyfills for older Android WebViews
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = function(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };
}
if (!Array.prototype.at) {
  Array.prototype.at = function(idx) {
    return idx < 0 ? this[this.length + idx] : this[idx];
  };
}
if (!Uint8Array.prototype.originalToString) {
  Uint8Array.prototype.originalToString = Uint8Array.prototype.toString;
  Uint8Array.prototype.toString = function(encoding) {
    if (typeof encoding === 'string' && (encoding.toLowerCase().includes('utf') || encoding.toLowerCase() === 'hex' || encoding.toLowerCase() === 'base64')) {
      if (encoding.toLowerCase().includes('utf')) {
        return new TextDecoder(encoding).decode(this);
      }
      if (encoding.toLowerCase() === 'hex') {
        let hex = '';
        for (let i = 0; i < this.length; i++) hex += this[i].toString(16).padStart(2, '0');
        return hex;
      }
      if (encoding.toLowerCase() === 'base64') {
        let binary = '';
        for (let i = 0; i < this.length; i++) binary += String.fromCharCode(this[i]);
        return btoa(binary);
      }
    }
    return this.originalToString();
  };
}

(function(window) {
  const global = window;
  window.exports = window.exports || {};
  window.module = { exports: window.exports };
  var exports = window.exports;
  const pendingRequests = new Map();
  let requestIdCounter = 0;

  // Called by Android native bridge when HTTP response returns
  window.onNativeHttpResponseBase64 = function(b64) {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const jsonStr = new TextDecoder('utf-8').decode(bytes);
      window.onNativeHttpResponse(jsonStr);
    } catch(err) {
      console.error('onNativeHttpResponseBase64 error:', err);
    }
  };

  window.onNativeHttpResponse = function(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const req = pendingRequests.get(data.requestId);
      if (req) {
        pendingRequests.delete(data.requestId);
        if (data.error && data.status === 0) {
          req.reject(new Error(data.error));
        } else {
          let body = data.body;
          try {
            body = JSON.parse(data.body);
          } catch(e) {}
          const headers = data.headers || {};
          req.resolve({
            statusCode: data.status,
            status: data.status,
            headers: headers,
            body: body,
            raw: data.body,
            url: data.url || headers['x-final-url'] || headers['X-Final-Url'] || ''
          });
        }
      }
    } catch(err) {
      console.error('onNativeHttpResponse parse error:', err);
    }
  };

  window.nativeHttpFetch = nativeHttpFetch;

  // LX Music Script API Compatibility Layer
  const LX_EVENT_NAMES = {
    inited: 'inited',
    request: 'request',
    updateAlert: 'updateAlert'
  };

  let lxListeners = {
    request: null
  };

  let lxState = {
    initedData: null,
    updateData: null
  };

  window.lxBridge = {
    reset() {
      lxListeners = { request: null };
      lxState = { initedData: null, updateData: null };
    },
    hasHandler() {
      return typeof lxListeners.request === 'function';
    },
    getState() {
      return lxState;
    },
    async resolveMusicUrl(source, musicInfo, quality) {
      if (!lxListeners.request) throw new Error('音源尚未提供链接解析处理器');
      return await lxListeners.request({
        action: 'musicUrl',
        source: source || 'tx',
        info: {
          type: quality || '320k',
          musicInfo: musicInfo
        }
      });
    }
  };

  window.lx = {
    EVENT_NAMES: LX_EVENT_NAMES,
    env: 'mobile',
    version: '2.0.0',
    request(url, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      options = options || {};
      nativeHttpFetch(url, options)
        .then(res => {
          if (typeof callback === 'function') {
            callback(null, {
              statusCode: res.status || res.statusCode || 200,
              status: res.status || res.statusCode || 200,
              headers: res.headers || {},
              body: res.raw != null ? res.raw : (typeof res.body === 'string' ? res.body : JSON.stringify(res.body))
            });
          }
        })
        .catch(err => {
          if (typeof callback === 'function') {
            callback(err, null);
          }
        });
    },
    on(eventName, handler) {
      if (eventName === LX_EVENT_NAMES.request || eventName === 'request') {
        lxListeners.request = handler;
      }
    },
    send(eventName, data) {
      if (eventName === LX_EVENT_NAMES.inited || eventName === 'inited') {
        lxState.initedData = data;
        console.log('[LX] Plugin inited:', data?.sources ? Object.keys(data.sources) : []);
      } else if (eventName === LX_EVENT_NAMES.updateAlert || eventName === 'updateAlert') {
        lxState.updateData = data;
        console.log('[LX] Plugin updateAlert:', data);
        if (data?.updateUrl) {
          try {
            let meta = JSON.parse(localStorage.getItem('jelly_custom_plugin_meta') || '{}');
            meta.updateUrl = data.updateUrl;
            meta.updateMsg = data.log || '';
            localStorage.setItem('jelly_custom_plugin_meta', JSON.stringify(meta));
            if (typeof window.syncPluginUI === 'function') window.syncPluginUI();
          } catch (e) {}
        }
      }
    }
  };
  globalThis.lx = window.lx;

  async function defaultPublicSearch(query, page = 1, limit = 20) {
    try {
      const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${limit}&w=${encodeURIComponent(query)}&format=json`;
      const resp = await nativeHttpFetch(url, { headers: { Referer: 'https://y.qq.com' } });
      const json = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body || '{}');
      const songList = json?.data?.song?.list || [];
      const items = songList.map(s => {
        const singers = (s.singer || []).map(x => x.name).join(' / ');
        return {
          id: s.songmid,
          title: s.songname,
          subtitle: singers,
          source: 'tx',
          ref: { id: s.songmid, providerId: 'tx' },
          metadata: {
            artists: (s.singer || []).map(x => x.name),
            album: s.albumname,
            durationMs: (s.interval || 0) * 1000,
            coverUrl: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
            qualities: ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master']
          },
          raw: {
            id: s.songmid,
            songmid: s.songmid,
            name: s.songname,
            singer: singers,
            album: s.albumname,
            interval: s.interval
          }
        };
      });
      return { items, total: json?.data?.song?.totalnum || items.length };
    } catch (e) {
      console.warn('defaultPublicSearch error:', e);
      return { items: [], total: 0 };
    }
  }

  async function defaultPublicLyrics(trackRef) {
    try {
      const songmid = trackRef.id || trackRef.ref?.id;
      const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&format=json&nobase64=1`;
      const resp = await nativeHttpFetch(url, { headers: { Referer: 'https://y.qq.com' } });
      const json = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body || '{}');
      return { lyric: json?.lyric || '' };
    } catch (e) {
      return { lyric: '' };
    }
  }

  async function defaultPublicHotKeywords() {
    try {
      const url = `https://c.y.qq.com/splcloud/fcgi-bin/gethotkey.fcg?format=json`;
      const resp = await nativeHttpFetch(url, { headers: { Referer: 'https://y.qq.com' } });
      const json = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body || '{}');
      const hotkeys = (json?.data?.hotkey || []).slice(0, 10).map(k => ({ keyword: k.k, score: k.n }));
      return { list: hotkeys };
    } catch (e) {
      return { list: [] };
    }
  }

  async function defaultPublicPlaylistDetail(id, source = 'tx') {
    if (source === 'wy') {
      try {
        const detailUrl = `https://music.163.com/api/v6/playlist/detail?id=${id}`;
        const detailRes = await nativeHttpFetch(detailUrl, {
          headers: {
            'Referer': 'https://music.163.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const detailData = typeof detailRes.body === 'object' ? detailRes.body : JSON.parse(detailRes.body || '{}');
        const pl = detailData.playlist;
        if (!pl) return null;

        const trackIds = (pl.trackIds || []).map(t => ({ id: t.id }));
        let songs = [];
        if (trackIds.length > 0) {
          const chunkSize = 400;
          for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunk = trackIds.slice(i, i + chunkSize);
            try {
              const postBody = `c=${encodeURIComponent(JSON.stringify(chunk))}`;
              const songsRes = await nativeHttpFetch('https://music.163.com/api/v3/song/detail', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Referer': 'https://music.163.com/',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: postBody
              });
              const sData = typeof songsRes.body === 'object' ? songsRes.body : JSON.parse(songsRes.body || '{}');
              if (sData && Array.isArray(sData.songs)) {
                songs.push(...sData.songs);
              }
            } catch (err) {
              console.warn('[CeruRuntime] NetEase batch song detail error:', err);
            }
          }
        }
        if (songs.length === 0 && Array.isArray(pl.tracks) && pl.tracks.length > 0) {
          songs = pl.tracks;
        }

        const items = songs.map(s => {
          const singers = (s.ar || s.artists || []).map(a => a.name).join(' / ') || '未知歌手';
          const album = s.al?.name || s.album?.name || '';
          const pic = s.al?.picUrl || s.album?.picUrl || pl.coverImgUrl || '';
          const durMs = s.dt || s.duration || 0;
          const sId = String(s.id);
          return {
            id: sId,
            songmid: sId,
            title: s.name,
            name: s.name,
            subtitle: singers,
            singer: singers,
            source: 'wy',
            ref: { id: sId, providerId: 'wy', kind: 'track' },
            artworkUrl: pic,
            img: pic,
            albumName: album,
            album: album,
            interval: Math.floor(durMs / 1000),
            metadata: {
              artists: (s.ar || s.artists || []).map(a => a.name),
              album: { title: album, id: String(s.al?.id || '') },
              coverUrl: pic,
              artworkUrl: pic,
              durationMs: durMs,
              qualities: ['128k', '320k', 'flac']
            },
            data: {
              song: {
                id: sId,
                songmid: sId,
                name: s.name,
                singer: singers,
                albumName: album,
                interval: Math.floor(durMs / 1000),
                img: pic,
                source: 'wy',
                types: ['128k', '320k', 'flac']
              }
            }
          };
        });

        return {
          id: String(pl.id || id),
          title: pl.name || `网易云歌单 (${id})`,
          author: pl.creator?.nickname || '网易云音乐',
          cover: pl.coverImgUrl || '',
          artworkUrl: pl.coverImgUrl || '',
          total: items.length,
          items: items
        };
      } catch (err) {
        console.warn('[CeruRuntime] defaultPublicPlaylistDetail wy error:', err);
        return null;
      }
    } else if (source === 'tx') {
      try {
        const url = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}&format=json&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq`;
        const resp = await nativeHttpFetch(url, {
          headers: {
            'Referer': `https://y.qq.com/n/yqq/playsquare/${id}.html`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const json = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body || '{}');
        const cd = json?.cdlist?.[0];
        if (!cd) return null;

        const items = (cd.songlist || []).map(s => {
          const singers = (s.singer || []).map(x => x.name).join(' / ') || '未知歌手';
          const pic = s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : (cd.logo || '');
          const sId = s.songmid || s.mid || String(s.id);
          const durSec = s.interval || 0;
          return {
            id: sId,
            songmid: sId,
            title: s.songname || s.name,
            name: s.songname || s.name,
            subtitle: singers,
            singer: singers,
            source: 'tx',
            ref: { id: sId, providerId: 'tx', kind: 'track' },
            artworkUrl: pic,
            img: pic,
            albumName: s.albumname || '',
            album: s.albumname || '',
            interval: durSec,
            metadata: {
              artists: (s.singer || []).map(x => x.name),
              album: { title: s.albumname || '', id: s.albummid || '' },
              coverUrl: pic,
              artworkUrl: pic,
              durationMs: durSec * 1000,
              qualities: ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master']
            },
            data: {
              song: {
                id: sId,
                songmid: sId,
                name: s.songname || s.name,
                singer: singers,
                albumName: s.albumname || '',
                interval: durSec,
                img: pic,
                source: 'tx',
                types: ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master']
              }
            }
          };
        });

        return {
          id: String(id),
          title: cd.dissname || `QQ音乐歌单 (${id})`,
          author: cd.nickname || 'QQ音乐',
          cover: cd.logo || '',
          artworkUrl: cd.logo || '',
          total: items.length,
          items: items
        };
      } catch (err) {
        console.warn('[CeruRuntime] defaultPublicPlaylistDetail tx error:', err);
        return null;
      }
    } else if (source === 'kg') {
      try {
        const url = `http://mobilecdn.kugou.com/api/v3/special/song?specialid=${id}&format=json`;
        const resp = await nativeHttpFetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' }
        });
        const json = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body || '{}');
        const data = json?.data;
        if (!data || !Array.isArray(data.info)) return null;

        const items = data.info.map(s => {
          let name = s.audio_name || '';
          let singer = s.singername || '';
          if (!name && s.filename && s.filename.includes(' - ')) {
            const parts = s.filename.split(' - ');
            singer = parts[0].trim();
            name = parts.slice(1).join(' - ').trim();
          }
          const sId = s.hash;
          const durSec = s.duration || 0;
          return {
            id: sId,
            songmid: sId,
            title: name || s.filename || '未知歌曲',
            name: name || s.filename || '未知歌曲',
            subtitle: singer || '未知歌手',
            singer: singer || '未知歌手',
            source: 'kg',
            ref: { id: sId, providerId: 'kg', kind: 'track' },
            artworkUrl: '',
            img: '',
            albumName: s.album_name || '',
            album: s.album_name || '',
            interval: durSec,
            metadata: {
              artists: [singer],
              album: { title: s.album_name || '', id: s.album_id || '' },
              coverUrl: '',
              artworkUrl: '',
              durationMs: durSec * 1000,
              qualities: ['128k', '320k', 'flac']
            },
            data: {
              song: {
                id: sId,
                songmid: sId,
                hash: s.hash,
                name: name || s.filename,
                singer: singer,
                albumName: s.album_name || '',
                interval: durSec,
                source: 'kg',
                types: ['128k', '320k', 'flac']
              }
            }
          };
        });

        return {
          id: String(id),
          title: data.specialname || `酷狗歌单 (${id})`,
          author: data.nickname || '酷狗音乐',
          cover: data.user_avatar || '',
          artworkUrl: data.user_avatar || '',
          total: items.length,
          items: items
        };
      } catch (err) {
        console.warn('[CeruRuntime] defaultPublicPlaylistDetail kg error:', err);
        return null;
      }
    }
    return null;
  }

  function nativeHttpFetch(url, options) {
    const reqId = 'req-' + (++requestIdCounter) + '-' + Date.now();
    const method = (options.method || 'GET').toUpperCase();
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    };
    if (options.headers) {
      Object.assign(headers, options.headers);
    }
    let body = options.body;
    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form).toString();
    } else if (body && typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    if (window.AndroidBridge && typeof window.AndroidBridge.httpRequest === 'function') {
      return new Promise((resolve, reject) => {
        pendingRequests.set(reqId, { resolve, reject });
        window.AndroidBridge.httpRequest(reqId, url, method, JSON.stringify(headers), body || '');
      });
    } else {
      // Fallback to fetch (for browser preview)
      return fetch(url, {
        method,
        headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : body
      }).then(async res => {
        const text = await res.text();
        let bodyData = text;
        try { bodyData = JSON.parse(text); } catch(e) {}
        return {
          statusCode: res.status,
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: bodyData,
          raw: text,
          url: res.url
        };
      });
    }
  }

  // Legacy HTTP Bridge
  function createLegacyHttpBridge(host) {
    let currentOperation;
    async function withOperation(operation, work) {
      currentOperation = operation;
      try {
        return await work();
      } finally {
        currentOperation = undefined;
      }
    }

    function httpFetch(address, options = {}) {
      const promise = nativeHttpFetch(address, options);
      return {
        promise,
        cancelHttp: () => {}
      };
    }

    return { withOperation, httpFetch };
  }

  function toUint8Array(input) {
    if (!input) return new Uint8Array(0);
    if (input instanceof Uint8Array) return input;
    if (typeof input === 'string') return new TextEncoder().encode(input);
    if (Array.isArray(input)) return new Uint8Array(input);
    if (input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.length);
    }
    return new Uint8Array(0);
  }

  function uint8ArrayToWordArray(u8) {
    const cryptoJS = window.CryptoJS || globalThis.CryptoJS;
    const words = [];
    for (let i = 0; i < u8.length; i += 4) {
      words.push(
        ((u8[i] || 0) << 24) |
        ((u8[i + 1] || 0) << 16) |
        ((u8[i + 2] || 0) << 8) |
        (u8[i + 3] || 0)
      );
    }
    return cryptoJS.lib.WordArray.create(words, u8.length);
  }

  // CryptoJS adapter for @ceru/crypto
  const cryptoModule = {
    constants: {
      RSA_NO_PADDING: 3,
      RSA_PKCS1_PADDING: 1
    },
    randomBytes: (size) => {
      const arr = new Uint8Array(size);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
      } else {
        for (let i = 0; i < size; i++) arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    publicEncrypt: ({ key, padding }, buffer) => {
      // NetEase 1024-bit RSA No-Padding public key modulus & exponent
      const n = BigInt('0xe0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7');
      const e = 65537n;
      let bufHex = '';
      if (buffer instanceof Uint8Array || Array.isArray(buffer)) {
        for (let i = 0; i < buffer.length; i++) bufHex += buffer[i].toString(16).padStart(2, '0');
      } else if (typeof buffer === 'string') {
        bufHex = buffer;
      } else if (buffer && buffer.toString) {
        bufHex = buffer.toString('hex');
      }
      const m = BigInt('0x' + (bufHex || '0'));
      let res = 1n, base = m % n, exp = e;
      while (exp > 0n) {
        if (exp % 2n === 1n) res = (res * base) % n;
        base = (base * base) % n;
        exp = exp / 2n;
      }
      const resHex = res.toString(16).padStart(256, '0');
      const out = new Uint8Array(128);
      for (let i = 0; i < 128; i++) out[i] = parseInt(resHex.substr(i * 2, 2), 16);
      return out;
    },
    createHash: (algo) => {
      const cryptoJS = window.CryptoJS || globalThis.CryptoJS || (typeof CryptoJS !== 'undefined' ? CryptoJS : null);
      if (!cryptoJS || !cryptoJS.algo) throw new Error('CryptoJS not available');
      const name = String(algo).toLowerCase();
      let hasher;
      if (name === 'md5') hasher = cryptoJS.algo.MD5.create();
      else if (name === 'sha1') hasher = cryptoJS.algo.SHA1.create();
      else if (name === 'sha256') hasher = cryptoJS.algo.SHA256.create();
      else throw new Error('Unsupported algorithm: ' + algo);

      const hashObj = {
        update: (data) => {
          let words;
          if (typeof data === 'string') {
            words = cryptoJS.enc.Utf8.parse(data);
          } else {
            const u8 = toUint8Array(data);
            words = uint8ArrayToWordArray(u8);
          }
          hasher.update(words);
          return hashObj;
        },
        digest: (encoding) => {
          const hash = hasher.finalize();
          if (encoding === 'hex') return hash.toString(cryptoJS.enc.Hex);
          if (encoding === 'base64') return hash.toString(cryptoJS.enc.Base64);
          return hash.toString();
        }
      };
      return hashObj;
    },
    createCipheriv: (algo, key, iv) => {
      let chunks = [];
      return {
        update: (buf) => {
          chunks.push(toUint8Array(buf));
          return new Uint8Array(0);
        },
        final: () => {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const dataWords = uint8ArrayToWordArray(merged);
          const keyWords = typeof key === 'string' ? window.CryptoJS.enc.Utf8.parse(key) : uint8ArrayToWordArray(toUint8Array(key));
          const ivWords = iv ? (typeof iv === 'string' ? window.CryptoJS.enc.Utf8.parse(iv) : uint8ArrayToWordArray(toUint8Array(iv))) : undefined;
          const isECB = algo.toLowerCase().includes('ecb');
          const encrypted = window.CryptoJS.AES.encrypt(dataWords, keyWords, {
            iv: ivWords,
            mode: isECB ? window.CryptoJS.mode.ECB : window.CryptoJS.mode.CBC,
            padding: window.CryptoJS.pad.Pkcs7
          });
          const hex = encrypted.ciphertext.toString(window.CryptoJS.enc.Hex);
          const res = new Uint8Array(hex.length / 2);
          for (let i = 0; i < res.length; i++) res[i] = parseInt(hex.substr(i * 2, 2), 16);
          return res;
        }
      };
    },
    createDecipheriv: (algo, key, iv) => {
      let chunks = [];
      return {
        update: (buf) => {
          chunks.push(toUint8Array(buf));
          return new Uint8Array(0);
        },
        final: () => {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          const cipherWords = uint8ArrayToWordArray(merged);
          const keyWords = typeof key === 'string' ? window.CryptoJS.enc.Utf8.parse(key) : uint8ArrayToWordArray(toUint8Array(key));
          const ivWords = iv ? (typeof iv === 'string' ? window.CryptoJS.enc.Utf8.parse(iv) : uint8ArrayToWordArray(toUint8Array(iv))) : undefined;
          const isECB = algo.toLowerCase().includes('ecb');
          const decrypted = window.CryptoJS.AES.decrypt({ ciphertext: cipherWords }, keyWords, {
            iv: ivWords,
            mode: isECB ? window.CryptoJS.mode.ECB : window.CryptoJS.mode.CBC,
            padding: window.CryptoJS.pad.Pkcs7
          });
          const hex = decrypted.toString(window.CryptoJS.enc.Hex);
          const res = new Uint8Array(hex.length / 2);
          for (let i = 0; i < res.length; i++) res[i] = parseInt(hex.substr(i * 2, 2), 16);
          return res;
        }
      };
    }
  };

  const getPako = () => window.pako || globalThis.pako || (typeof exports !== 'undefined' ? exports : null);
  const compressionModule = {
    get default() { return getPako(); },
    inflate: (buf, cb) => {
      try {
        const p = getPako();
        if (!p || typeof p.inflate !== 'function') throw new Error('pako inflate engine not available');
        const res = p.inflate(buf);
        if (cb) cb(null, res);
        return res;
      } catch (e) {
        if (cb) cb(e);
        throw e;
      }
    },
    unzipSync: (buf) => {
      const p = getPako();
      if (!p || typeof p.inflate !== 'function') throw new Error('pako inflate engine not available');
      return p.inflate(buf);
    }
  };

  const encodingModule = {
    default: {
      decode: (buf, encoding) => new TextDecoder(encoding || 'utf-8').decode(buf)
    }
  };

  const hostModules = {
    '@ceru/crypto': cryptoModule,
    '@ceru/compression': compressionModule,
    '@ceru/encoding': encodingModule,
    '@ceru/legacy-http': { createLegacyHttpBridge }
  };

  window.__ceruRequire = (id) => {
    if (hostModules[id]) return hostModules[id];
    throw new Error('Host module not found: ' + id);
  };
  globalThis.__ceruRequire = window.__ceruRequire;

  // CeruMusic NoticeCenter implementation for notification & update events
  const handlePluginNoticeEvent = (type, data) => {
    console.log('[NoticeCenter] Event received:', type, data);
    if (type === 'update' || data?.type === 'update' || data?.url || data?.updateUrl) {
      const updateData = data?.data || data || {};
      const notice = {
        type: 'update',
        dialogType: 'update',
        title: updateData.title || '音源插件更新',
        pluginName: updateData.pluginInfo?.name || window.MusicAPI?.manifest?.name || '当前音源',
        currentVersion: window.MusicAPI?.manifest?.version || '未知',
        newVersion: updateData.version || '最新版本',
        updateUrl: updateData.url || updateData.updateUrl,
        message: updateData.message || updateData.content || updateData.updateMsg || '发现音源新版本，是否立即更新？',
        notes: updateData.updateMsg || updateData.notes || updateData.content || ''
      };
      if (typeof window.showPluginNoticeDialog === 'function') {
        window.showPluginNoticeDialog(notice);
      }
    } else {
      const msg = data?.message || data?.content || (typeof data === 'string' ? data : '');
      if (msg && typeof window.toast === 'function') {
        window.toast(msg);
      }
    }
  };

  window.NoticeCenter = handlePluginNoticeEvent;
  globalThis.NoticeCenter = handlePluginNoticeEvent;
  window.cerumusic = { NoticeCenter: handlePluginNoticeEvent };
  globalThis.cerumusic = window.cerumusic;

  // High-level MusicAPI manager
  const registeredProviders = new Map();
  const registeredActions = new Map();

  window.MusicAPI = {
    initialized: false,
    manifest: null,
    providers: registeredProviders,
    actions: registeredActions,

    reset() {
      registeredProviders.clear();
      registeredActions.clear();
      this.initialized = false;
      this.manifest = null;
    },

    async init(manifest, activateFn) {
      this.manifest = manifest;
      registeredProviders.clear();
      registeredActions.clear();

      const pluginConfig = { ...(manifest.config || {}), get: async () => manifest.config };
      const ctx = {
        plugin: { id: manifest.id, version: manifest.version, name: manifest.name, manifest },
        host: { apiVersion: '2.0.0', mode: 'production' },
        config: pluginConfig,
        effects: { add: () => {} },
        permissions: {
          query: async () => ({ status: 'granted' }),
          request: async () => ({ status: 'granted' }),
          getGranted: async () => []
        },
        playback: { failure: (err) => ({ ok: false, error: err }) },
        ui: {
          toast: async (opts) => {
            if (typeof window.toast === 'function') {
              window.toast(opts?.message || String(opts));
            }
          },
          pluginUpdate: {
            request: async (data) => {
              console.log('[CeruRuntime] Plugin update requested via ctx.ui.pluginUpdate.request:', data);
              const notice = {
                type: 'update',
                dialogType: 'update',
                title: '音源插件更新',
                pluginName: manifest.name || '当前音源',
                currentVersion: manifest.version || '未知',
                newVersion: data.version || '最新版本',
                updateUrl: data.url,
                message: data.notes || `音源插件有新版本可用，是否立即更新？`,
                notes: data.notes || '',
                manifest: manifest
              };
              if (typeof window.showPluginNoticeDialog === 'function') {
                window.showPluginNoticeDialog(notice);
              }
              return { accepted: true, updated: false, queued: true };
            }
          },
          dialogs: {
            confirm: async (opts) => confirm(opts.message || opts.title),
            alert: async (opts) => alert(opts.message || opts.title)
          },
          playlistImport: { open: async () => {} }
        },
        log: {
          debug: (...args) => console.debug('[CeruPlugin]', ...args),
          info: (...args) => console.log('[CeruPlugin]', ...args),
          warn: (...args) => console.warn('[CeruPlugin]', ...args),
          error: (...args) => console.error('[CeruPlugin]', ...args)
        },
        lyricConverters: { register: () => () => {} },
        playlistImporters: { register: () => () => {} },
        providers: {
          register: (id, impl) => {
            registeredProviders.set(id, impl);
            return () => registeredProviders.delete(id);
          }
        },
        actions: {
          register: (id, impl) => {
            registeredActions.set(id, impl);
            return () => registeredActions.delete(id);
          }
        },
        http: {
          create: (defaults = {}) => {
            const reqFn = async (path, opts = {}) => {
              let fullUrl = path.startsWith('http') ? path : ((defaults.baseURL ? defaults.baseURL.replace(/\/$/, '') : '') + '/' + path.replace(/^\//, ''));
              if (opts.query || opts.params) {
                const q = new URLSearchParams(opts.query || opts.params).toString();
                if (q) fullUrl += (fullUrl.includes('?') ? '&' : '?') + q;
              }
              const method = (opts.method || 'GET').toUpperCase();
              const headers = { ...(defaults.headers || {}), ...(opts.headers || {}) };
              let body = opts.body || opts.data;
              if (body && typeof body === 'object' && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) {
                body = JSON.stringify(body);
              }
              const res = await nativeHttpFetch(fullUrl, { method, headers, body });
              return {
                status: res.status,
                statusCode: res.status,
                headers: res.headers || {},
                data: res.body,
                body: res.body
              };
            };
            return {
              request: reqFn,
              get: (path, opts = {}) => reqFn(path, { ...opts, method: 'GET' }),
              post: (path, data, opts = {}) => reqFn(path, { ...opts, method: 'POST', data }),
              put: (path, data, opts = {}) => reqFn(path, { ...opts, method: 'PUT', data }),
              delete: (path, opts = {}) => reqFn(path, { ...opts, method: 'DELETE' })
            };
          }
        }
      };

      await activateFn(ctx);
      this.initialized = true;
      console.log('MusicAPI initialized successfully!');
      try {
        if (typeof window.syncPluginUI === 'function') window.syncPluginUI();
        if (typeof window.loadDiscoverContent === 'function') window.loadDiscoverContent();
      } catch (e) {
        console.warn('UI update on MusicAPI init error:', e);
      }
    },

    async initLX(meta, bridge) {
      this.reset();
      this.manifest = {
        name: meta.name || '洛雪自定义音源',
        version: meta.version || '1.0.0',
        description: meta.description || '支持所有平台全音质解析',
        author: meta.author || '洛雪源作者',
        id: 'lx.custom.source'
      };

      const defaultQualities = ['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master'];
      const providerImpl = {
        tracks: {
          search: async ({ query, cursor, limit }) => {
            return await defaultPublicSearch(query, cursor || 1, limit || 20);
          },
          resolve: async (trackRef, quality) => {
            const providerId = trackRef.providerId || trackRef.source || trackRef.ref?.providerId || 'tx';
            const rawSong = trackRef.data?.song || {};
            const musicInfo = {
              id: trackRef.id || trackRef.ref?.id || rawSong.id || rawSong.songmid,
              songmid: trackRef.id || trackRef.ref?.id || rawSong.songmid || rawSong.id,
              hash: trackRef.raw?.hash || rawSong.hash || trackRef.id || trackRef.ref?.id,
              name: trackRef.title || rawSong.name,
              singer: trackRef.metadata?.artists?.[0] || trackRef.subtitle || rawSong.singer,
              album: trackRef.metadata?.album?.title || trackRef.metadata?.album || rawSong.albumName || '',
              interval: Math.floor((trackRef.metadata?.durationMs || 0) / 1000) || rawSong.interval || 0,
              ...rawSong,
              ...trackRef.raw
            };
            const directUrl = await bridge.resolveMusicUrl(providerId, musicInfo, quality);
            return {
              url: directUrl,
              quality: quality,
              actualQuality: quality
            };
          },
          lyrics: async (trackRef) => {
            return await defaultPublicLyrics(trackRef);
          }
        }
      };

      ['tx', 'wy', 'kg', 'kw', 'mg', 'mix'].forEach(sourceId => {
        registeredProviders.set(sourceId, providerImpl);
      });

      registeredActions.set('search.hot', async () => defaultPublicHotKeywords());

      this.initialized = true;
      console.log('MusicAPI LX mode initialized successfully!');
      try {
        if (typeof window.syncPluginUI === 'function') window.syncPluginUI();
        if (typeof window.loadDiscoverContent === 'function') window.loadDiscoverContent();
      } catch (e) {
        console.warn('UI update on MusicAPI LX init error:', e);
      }
    },

    createOp() {
      const ac = new AbortController();
      return { id: 'op-' + Date.now(), deadlineAt: Date.now() + 20000, signal: ac.signal };
    },

    async search(query, source = 'mix', page = 1, limit = 20) {
      const provider = registeredProviders.get(source) || registeredProviders.get('mix');
      if (!provider) throw new Error('音源未找到: ' + source);
      return provider.tracks.search({ query, cursor: page, limit }, this.createOp());
    },

    async resolve(trackRef, quality = '128k') {
      const providerId = trackRef.providerId || 'tx';
      const provider = registeredProviders.get(providerId) || registeredProviders.get('mix');
      if (!provider) throw new Error('音源未找到: ' + providerId);
      return provider.tracks.resolve(trackRef, quality, this.createOp());
    },

    async getLyrics(trackRef) {
      const providerId = trackRef.providerId || 'tx';
      const provider = registeredProviders.get(providerId) || registeredProviders.get('mix');
      if (!provider) throw new Error('音源未找到: ' + providerId);
      return provider.tracks.lyrics(trackRef, this.createOp());
    },

    async getHotKeywords(source = 'mix') {
      const action = registeredActions.get('search.hot');
      if (action) return action({ source }, this.createOp());
      return { list: [] };
    },

    async getSearchTips(query, source = 'mix') {
      const action = registeredActions.get('search.tips');
      if (action) return action({ source, query }, this.createOp());
      return [];
    },

    async getPlaylists(source = 'tx', page = 1, limit = 20) {
      const action = registeredActions.get('playlist.list');
      if (action) return action({ source, page, limit }, this.createOp());
      const provider = registeredProviders.get(source);
      if (provider?.playlists?.list) {
        return provider.playlists.list({ cursor: page, limit }, this.createOp());
      }
      return { items: [] };
    },

    async searchPlaylists(query, source = 'tx', page = 1, limit = 20) {
      const action = registeredActions.get('playlist.search');
      if (action) return action({ source, query, page, limit }, this.createOp());
      return { items: [] };
    },

    async getPlaylistDetail(id, source = 'tx') {
      const action = registeredActions.get('playlist.detail');
      if (action) {
        try {
          const res = await action({ source, id }, this.createOp());
          if (res && res.items && res.items.length > 0) return res;
        } catch (e) {
          console.warn('[CeruRuntime] action playlist.detail error, trying fallback:', e);
        }
      }
      return await defaultPublicPlaylistDetail(id, source);
    },

    async getComments(trackRef, page = 1, limit = 20) {
      const action = registeredActions.get('comments.get');
      if (action) {
        const ref = trackRef.ref || trackRef;
        const source = ref.providerId || trackRef.source || 'tx';
        const rawSong = trackRef.data?.song || trackRef.raw || trackRef.song || trackRef;
        return action({
          source,
          id: ref.id,
          songmid: ref.id,
          song: rawSong,
          data: trackRef.data,
          name: trackRef.title,
          singer: trackRef.metadata?.artists?.[0] || trackRef.subtitle,
          page,
          limit
        }, this.createOp());
      }
      return { comments: [], total: 0 };
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
