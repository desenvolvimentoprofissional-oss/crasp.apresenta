import { watchPandaPreview } from './pandaPreview';

export interface PlaylistVideo { title: string; url: string; previewSeconds?: number }
export interface PlaylistData { title: string; videos: PlaylistVideo[]; description?: string }
export interface PlaylistOptions {
  editor?: boolean;
  initialPlaylist?: PlaylistData;
  playlistUrl?: string | false;
}

interface VideoSource {
  kind: 'embed' | 'file';
  provider: 'YouTube' | 'Vimeo' | 'Panda Video' | 'MP4' | 'WebM';
  player: string;
  original: string;
}

const defaultTitle = 'Playlist de videoaulas';
const maxVideos = 50;
const maxTitle = 160;
const maxUrl = 2048;
const maxFragment = 24_000;
const maxJson = 160_000;
const youtubeHosts = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'www.youtube-nocookie.com', 'youtube-nocookie.com',
]);
const vimeoHosts = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const pandaHost = /^player-vz-[a-f\d-]+\.tv\.pandavideo\.com\.br$/;
const pandaId = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const hostLabel = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const publicHost = new RegExp(`^(?:${hostLabel}\\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$`);
const reservedHost = /(?:^|\.)(?:local|localhost|internal|lan|test|invalid|example|onion|home)$/;
let mountCount = 0;

export function parseVideoSource(value: string): VideoSource | undefined {
  if (typeof value !== 'string') return;
  const input = value.trim();
  if (!input || input.length > maxUrl || /[\\\u0000-\u001f\u007f]/.test(input)) return;
  let url: URL;
  try { url = new URL(input); } catch { return; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !publicHost.test(url.hostname) || reservedHost.test(url.hostname)) return;

  if (youtubeHosts.has(url.hostname)) {
    const id = url.hostname === 'youtu.be'
      ? /^\/([\w-]+)\/?$/.exec(url.pathname)?.[1]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : /^\/(?:embed|shorts|live)\/([\w-]+)\/?$/.exec(url.pathname)?.[1];
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    return {
      kind: 'embed', provider: 'YouTube',
      player: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      original: `https://www.youtube.com/watch?v=${id}`,
    };
  }

  if (vimeoHosts.has(url.hostname)) {
    const player = url.hostname === 'player.vimeo.com';
    const match = (player ? /^\/video\/(\d{1,15})\/?$/ : /^\/(\d{1,15})(?:\/([a-f\d]{6,20}))?\/?$/i)
      .exec(url.pathname);
    if (!match) return;
    const [, id, unlisted] = match;
    const hash = unlisted ?? url.searchParams.get('h');
    if (hash !== null && !/^[a-f\d]{6,20}$/i.test(hash)) return;
    return {
      kind: 'embed', provider: 'Vimeo',
      player: `https://player.vimeo.com/video/${id}${hash ? '?h=' + hash : ''}`,
      original: `https://vimeo.com/${id}${hash ? '/' + hash : ''}`,
    };
  }

  if (pandaHost.test(url.hostname)) {
    const ids = url.searchParams.getAll('v');
    if (ids.length !== 1 || !pandaId.test(ids[0]) || !/^\/embed\/?$/.test(url.pathname)) return;
    const address = `${url.origin}/embed/?v=${ids[0].toLowerCase()}`;
    return { kind: 'embed', provider: 'Panda Video', player: address, original: address };
  }

  const extension = /\.(mp4|webm)$/i.exec(url.pathname)?.[1]?.toLowerCase();
  if (!extension) return;
  return {
    kind: 'file', provider: extension === 'mp4' ? 'MP4' : 'WebM',
    player: url.href, original: url.href,
  };
}

function parsePlaylist(value: unknown): PlaylistData {
  if (typeof value !== 'object' || !value || Array.isArray(value))
    throw new Error('Use um arquivo JSON de playlist.');
  const { title, description, videos, version } = value as Record<string, unknown>;
  if ((version !== undefined && version !== 1) || typeof title !== 'string' || title.length > maxTitle ||
      !Array.isArray(videos) || videos.length > maxVideos)
    throw new Error('O arquivo precisa conter o nome da playlist e até 50 vídeos.');
  return {
    title: title.trim() || defaultTitle,
    ...(typeof description === 'string' && description.trim() ? { description: description.trim().slice(0, 260) } : {}),
    videos: videos.map((entry, index) => {
      const record = typeof entry === 'object' && entry ? entry as Record<string, unknown> : {};
      const name = typeof record.title === 'string' ? record.title.trim() : '';
      const source = typeof record.url === 'string' ? parseVideoSource(record.url) : undefined;
      if (!name || name.length > maxTitle || !source)
        throw new Error(`Confira o título e o endereço HTTPS do vídeo ${index + 1}.`);
      const limit = record.previewSeconds;
      if (limit === undefined) return { title: name, url: source.original };
      if (source.provider !== 'Panda Video' || typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 300)
        throw new Error(`Confira o tempo de amostra do vídeo ${index + 1}.`);
      return { title: name, url: source.original, previewSeconds: limit };
    }),
  };
}

function serialize(playlist: PlaylistData) {
  return JSON.stringify({ version: 1, ...playlist });
}

function sharedPlaylist(hash: string) {
  if (!hash.startsWith('#playlist=')) return;
  const encoded = hash.slice('#playlist='.length);
  if (!encoded || encoded.length > maxFragment || !/^[A-Za-z0-9_-]+$/.test(encoded))
    throw new Error('O link da playlist é inválido.');
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
  const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  return parsePlaylist(JSON.parse(json));
}

function shareAddress(playlist: PlaylistData) {
  const bytes = new TextEncoder().encode(serialize(playlist));
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (encoded.length > maxFragment)
    throw new Error('Esta playlist é grande para um link. Baixe o JSON para compartilhá-la.');
  const url = new URL(location.href);
  for (const parameter of ['editar-playlist', 'matriz', 'documento']) url.searchParams.delete(parameter);
  url.hash = 'playlist=' + encoded;
  return url.href;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text: string, act: () => void, className = 'playlist-button') {
  const control = node('button', className, text);
  control.type = 'button';
  control.addEventListener('click', act);
  return control;
}

function field(label: string, input: HTMLInputElement) {
  const container = node('label', 'playlist-field');
  container.append(node('span', '', label), input);
  return container;
}

function previewLabel(seconds: number) {
  return `Amostra · até ${seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`}`;
}

export function mountPlaylist(root: HTMLElement, {
  editor = true, initialPlaylist, playlistUrl,
}: PlaylistOptions = {}): () => void {
  const key = `crasp-apresenta:playlist-v1:${location.pathname}`;
  const instance = 'playlist-' + ++mountCount;
  const app = node('div', 'playlist-app');
  const status = node('p', 'playlist-status');
  status.setAttribute('role', 'status');
  const toolbar = node('div', 'playlist-toolbar');
  const metadata = node('div', 'playlist-metadata');
  const heading = node('h3', 'playlist-name');
  const description = node('p', 'playlist-description');
  metadata.append(heading, description);
  const viewer = node('div', 'playlist-viewer');
  const playerPanel = node('div', 'playlist-program');
  const screen = node('div', 'playlist-screen');
  const videoInfo = node('div', 'playlist-video-info');
  const list = node('ol', 'playlist-list');
  list.setAttribute('aria-label', 'Vídeos da playlist');
  playerPanel.append(screen, videoInfo);
  viewer.append(playerPanel, list);

  let playlist: PlaylistData = { title: defaultTitle, videos: [] };
  let selected: PlaylistVideo | undefined;
  let personalPlaylist: PlaylistData | undefined;
  let workspaceChanged = false;
  let importGeneration = 0;
  let scrollFrame = 0;
  let stopPreview: (() => void) | undefined;

  try {
    if (initialPlaylist) playlist = parsePlaylist(initialPlaylist);
  } catch (cause) {
    status.textContent = cause instanceof Error ? cause.message : 'A playlist inicial é inválida.';
  }
  let baseline = playlist;
  if (editor) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        playlist = parsePlaylist(JSON.parse(stored));
        personalPlaylist = playlist;
      }
    } catch { /* A missing or damaged draft leaves the public playlist available. */ }
  }
  let hasShared = false;
  try {
    const shared = sharedPlaylist(location.hash);
    if (shared) {
      playlist = shared;
      hasShared = true;
    }
  } catch {
    status.textContent = 'Não foi possível abrir o link da playlist.';
  }

  const dialog = node('dialog', 'playlist-editor');
  const dialogTitle = node('h3', '', 'Montar playlist');
  dialogTitle.id = instance + '-editor';
  dialog.setAttribute('aria-labelledby', dialogTitle.id);
  const dialogHeader = node('div', 'playlist-editor-header');
  dialogHeader.append(dialogTitle, button('Fechar', () => dialog.close()));
  const editorStatus = node('p', 'playlist-status');
  editorStatus.id = instance + '-status';
  editorStatus.setAttribute('role', 'status');
  const nameInput = node('input');
  nameInput.maxLength = maxTitle;
  const form = node('form', 'playlist-add-form');
  const videoTitle = node('input');
  videoTitle.maxLength = maxTitle;
  videoTitle.required = true;
  const videoUrl = node('input');
  videoUrl.type = 'url';
  videoUrl.inputMode = 'url';
  videoUrl.placeholder = 'https://';
  videoUrl.maxLength = maxUrl;
  videoUrl.required = true;
  videoUrl.setAttribute('aria-describedby', editorStatus.id);
  const saveVideo = node('button', 'playlist-button playlist-primary', 'Adicionar vídeo');
  saveVideo.type = 'submit';
  const stopEditing = button('Cancelar edição', () => clearEditor());
  stopEditing.hidden = true;
  const formControls = node('div', 'playlist-form-controls');
  formControls.append(saveVideo, stopEditing);
  form.append(field('Título do vídeo', videoTitle), field('Link do vídeo', videoUrl), formControls);
  const editList = node('ol', 'playlist-edit-list');
  const tools = node('div', 'playlist-editor-tools');
  const importInput = node('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.hidden = true;
  const shareInput = node('input', 'playlist-share-input');
  shareInput.readOnly = true;
  shareInput.setAttribute('aria-label', 'Link da playlist');
  shareInput.hidden = true;
  let editingVideo: PlaylistVideo | undefined;

  const loadController = new AbortController();

  function updateHeading() {
    heading.textContent = playlist.title === defaultTitle ? '' : playlist.title;
    heading.hidden = !heading.textContent;
    description.textContent = playlist.description ?? '';
    description.hidden = !description.textContent;
    metadata.hidden = heading.hidden && description.hidden;
    toolbar.hidden = metadata.hidden && !editor;
  }

  function finishPreview(message: string, action: string) {
    const placeholder = node('div', 'playlist-placeholder');
    const content = node('div', 'playlist-preview-notice');
    const text = node('p', '', message);
    text.setAttribute('role', 'status');
    content.append(text, button(action, showVideo));
    placeholder.append(content);
    screen.replaceChildren(placeholder);
  }

  function showVideo() {
    stopPreview?.();
    stopPreview = undefined;
    screen.replaceChildren();
    videoInfo.replaceChildren();
    const source = selected && parseVideoSource(selected.url);
    if (!selected || !source) {
      const placeholder = node('div', 'playlist-placeholder');
      placeholder.append(node('p', '', playlist.videos.length ? 'Selecione um vídeo da playlist.' : 'Nenhum vídeo nesta playlist.'));
      screen.append(placeholder);
      return;
    }

    if (source.kind === 'embed') {
      const frame = node('iframe');
      frame.title = selected.title;
      frame.src = source.player;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      if (selected.previewSeconds) {
        const limit = selected.previewSeconds;
        const loading = node('div', 'playlist-placeholder', 'Carregando a amostra…');
        loading.setAttribute('role', 'status');
        frame.allow = 'encrypted-media';
        frame.classList.add('playlist-preview-waiting');
        screen.append(loading, frame);
        stopPreview = watchPandaPreview(frame, limit, {
          onReady: () => {
            loading.remove();
            frame.classList.remove('playlist-preview-waiting');
          },
          onEnd: () => finishPreview('Fim da amostra.', 'Rever amostra'),
          onUnavailable: () => finishPreview('Não foi possível carregar a amostra.', 'Tentar novamente'),
        });
        videoInfo.append(node('strong', '', selected.title), node('span', 'playlist-preview-label', previewLabel(limit)));
        return;
      }
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      screen.append(frame);
    } else {
      const video = node('video');
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.src = source.player;
      video.setAttribute('aria-label', selected.title);
      video.addEventListener('error', () => {
        if (!screen.contains(video)) return;
        status.textContent = 'O vídeo não carregou. Você pode tentar abri-lo no site de origem.';
      });
      screen.append(video);
    }
    const original = node('a', 'playlist-original', 'Abrir no site de origem');
    original.href = source.original;
    original.target = '_blank';
    original.rel = 'noopener noreferrer';
    videoInfo.append(node('strong', '', selected.title), original);
  }

  function renderList() {
    list.replaceChildren();
    for (const video of playlist.videos) {
      const item = node('li');
      const choose = button(video.title, () => {
        status.textContent = '';
        if (selected !== video) {
          selected = video;
          showVideo();
          for (const control of list.querySelectorAll('button')) {
            if (control === choose) control.setAttribute('aria-current', 'true');
            else control.removeAttribute('aria-current');
          }
        }
      }, 'playlist-video-choice');
      choose.append(node('span', '', video.previewSeconds ? previewLabel(video.previewSeconds) : parseVideoSource(video.url)?.provider));
      if (video === selected) choose.setAttribute('aria-current', 'true');
      item.append(choose);
      list.append(item);
    }
    list.hidden = !playlist.videos.length;
    viewer.classList.toggle('playlist-viewer-empty', list.hidden);
  }

  function render() {
    updateHeading();
    renderList();
    showVideo();
  }

  function clearEditor() {
    editingVideo = undefined;
    form.reset();
    form.classList.remove('playlist-editing');
    videoUrl.removeAttribute('aria-invalid');
    saveVideo.textContent = 'Adicionar vídeo';
    stopEditing.hidden = true;
  }

  function editVideo(video: PlaylistVideo) {
    editingVideo = video;
    videoTitle.value = video.title;
    videoUrl.value = video.url;
    videoUrl.removeAttribute('aria-invalid');
    form.classList.add('playlist-editing');
    saveVideo.textContent = 'Salvar vídeo';
    stopEditing.hidden = false;
    videoTitle.focus();
  }

  function persist() {
    workspaceChanged = true;
    personalPlaylist = playlist;
    try {
      localStorage.setItem(key, serialize(playlist));
      return '';
    } catch {
      return ' As alterações estão disponíveis nesta aba. Baixe o JSON para guardá-las.';
    }
  }

  function updateVideos(videos: PlaylistVideo[], message: string, replacement?: PlaylistVideo) {
    const before = selected;
    const wasEmpty = !playlist.videos.length;
    playlist = { ...playlist, videos };
    if (selected && !videos.includes(selected)) selected = replacement;
    editorStatus.textContent = message + persist();
    shareInput.hidden = true;
    renderList();
    if (before !== selected || wasEmpty !== !videos.length) showVideo();
    renderEditorList();
  }

  function renderEditorList() {
    editList.replaceChildren();
    playlist.videos.forEach((video, index) => {
      const row = node('li');
      const actions = node('div', 'playlist-row-actions');
      function move(offset: number) {
        const next = index + offset;
        const videos = [...playlist.videos];
        [videos[index], videos[next]] = [videos[next], videos[index]];
        updateVideos(videos, 'Ordem atualizada.');
        editList.children[next]?.querySelector<HTMLButtonElement>('.playlist-edit-video')?.focus();
      }
      const up = button('↑', () => move(-1));
      up.disabled = index === 0;
      up.setAttribute('aria-label', `Subir ${video.title}`);
      const down = button('↓', () => move(1));
      down.disabled = index === playlist.videos.length - 1;
      down.setAttribute('aria-label', `Descer ${video.title}`);
      const edit = button('Editar', () => editVideo(video), 'playlist-button playlist-edit-video');
      edit.setAttribute('aria-label', `Editar ${video.title}`);
      const remove = button('Remover', () => {
        if (editingVideo === video) clearEditor();
        updateVideos(playlist.videos.filter((entry) => entry !== video), 'Vídeo removido.');
        const next = editList.children[Math.min(index, editList.children.length - 1)];
        (next?.querySelector<HTMLButtonElement>('.playlist-edit-video') ?? videoTitle).focus();
      });
      remove.setAttribute('aria-label', `Remover ${video.title}`);
      actions.append(up, down, edit, remove);
      row.append(node('span', 'playlist-edit-name', video.title), actions);
      editList.append(row);
    });
    editList.hidden = !playlist.videos.length;
  }

  if (editor) {
    toolbar.append(metadata, button('Montar playlist', () => {
      editorStatus.textContent = '';
      shareInput.hidden = true;
      nameInput.value = playlist.title;
      clearEditor();
      renderEditorList();
      dialog.showModal();
      nameInput.focus();
    }, 'playlist-button playlist-primary'));

    nameInput.addEventListener('input', () => {
      playlist = { ...playlist, title: nameInput.value.trim() || defaultTitle };
      const failure = persist();
      if (failure) editorStatus.textContent = failure.trim();
      shareInput.hidden = true;
      updateHeading();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = videoTitle.value.trim();
      const source = parseVideoSource(videoUrl.value);
      if (!title || !source) {
        editorStatus.textContent = !title ? 'Informe o título do vídeo.'
          : 'Use um link HTTPS do YouTube, Vimeo, Panda Video ou um arquivo MP4 ou WebM.';
        if (!source) {
          videoUrl.setAttribute('aria-invalid', 'true');
          videoUrl.focus();
        }
        return;
      }
      if (!editingVideo && playlist.videos.length >= maxVideos) {
        editorStatus.textContent = 'Cada playlist comporta até 50 vídeos.';
        return;
      }
      const previous = editingVideo;
      const next: PlaylistVideo = { title, url: source.original };
      if (source.provider === 'Panda Video' && previous?.previewSeconds) next.previewSeconds = previous.previewSeconds;
      const videos = previous
        ? playlist.videos.map((item) => item === previous ? next : item)
        : [...playlist.videos, next];
      updateVideos(videos, previous ? 'Vídeo atualizado.' : 'Vídeo adicionado.',
        previous && selected === previous ? next : undefined);
      clearEditor();
      videoTitle.focus();
    });

    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      const generation = ++importGeneration;
      try {
        if (file.size > maxJson) throw new Error('O arquivo da playlist excede o tamanho permitido.');
        const imported = parsePlaylist(JSON.parse(await file.text()));
        if (loadController.signal.aborted || generation !== importGeneration) return;
        playlist = imported;
        selected = undefined;
        nameInput.value = playlist.title;
        clearEditor();
        render();
        renderEditorList();
        shareInput.hidden = true;
        editorStatus.textContent = 'Playlist importada.' + persist();
      } catch (cause) {
        if (!loadController.signal.aborted && generation === importGeneration)
          editorStatus.textContent = cause instanceof SyntaxError ? 'Este arquivo não contém um JSON válido.'
            : cause instanceof Error ? cause.message : 'Não foi possível importar a playlist.';
      }
    });

    tools.append(
      button('Importar JSON', () => importInput.click()),
      button('Baixar JSON', () => {
        const href = URL.createObjectURL(new Blob([serialize(playlist)], { type: 'application/json' }));
        const link = node('a');
        link.href = href;
        link.download = 'playlist.json';
        app.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }),
      button('Copiar link', () => {
        let address: string;
        try { address = shareAddress(playlist); }
        catch (cause) {
          editorStatus.textContent = cause instanceof Error ? cause.message : 'Não foi possível compartilhar a playlist.';
          return;
        }
        shareInput.value = address;
        shareInput.hidden = false;
        if (!navigator.clipboard) {
          shareInput.select();
          editorStatus.textContent = 'Selecione e copie o link da playlist.';
          return;
        }
        void navigator.clipboard.writeText(address).then(() => {
          editorStatus.textContent = 'Link da playlist copiado.';
        }, () => {
          shareInput.select();
          editorStatus.textContent = 'Selecione e copie o link da playlist.';
        });
      }, 'playlist-button playlist-primary'),
    );
    dialog.addEventListener('close', () => { importGeneration += 1; });
    dialog.append(dialogHeader, field('Nome da playlist', nameInput), form, editorStatus, editList, tools, importInput, shareInput);
    app.append(toolbar, status, viewer, dialog);
  } else {
    toolbar.append(metadata);
    app.append(toolbar, status, viewer);
  }
  function showSharedSection() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      (root.closest('#videoaulas') ?? app).scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }

  root.replaceChildren(app);
  render();
  if (hasShared) showSharedSection();

  function onHashChange() {
    try {
      const next = sharedPlaylist(location.hash);
      if (!next && !hasShared) return;
      hasShared = Boolean(next);
      playlist = next ?? personalPlaylist ?? baseline;
      selected = undefined;
      status.textContent = '';
      render();
      if (next) showSharedSection();
      if (dialog.open) {
        nameInput.value = playlist.title;
        clearEditor();
        renderEditorList();
      }
    } catch {
      status.textContent = 'Não foi possível abrir o link da playlist.';
    }
  }
  window.addEventListener('hashchange', onHashChange);

  if (playlistUrl !== false && (playlistUrl || !initialPlaylist)) {
    const seed = new URL(playlistUrl || './playlist.json', document.baseURI);
    if (seed.origin === location.origin) {
      void fetch(seed, { signal: loadController.signal }).then(async (response) => {
        if (!response.ok) return;
        const json = await response.text();
        if (json.length > maxJson) return;
        const published = parsePlaylist(JSON.parse(json));
        if (loadController.signal.aborted) return;
        baseline = published;
        if (workspaceChanged || hasShared || personalPlaylist) return;
        playlist = published;
        render();
        if (dialog.open) {
          nameInput.value = playlist.title;
          renderEditorList();
        }
      }).catch(() => { /* A public playlist file is optional. */ });
    }
  }

  return () => {
    importGeneration += 1;
    loadController.abort();
    cancelAnimationFrame(scrollFrame);
    stopPreview?.();
    window.removeEventListener('hashchange', onHashChange);
    if (dialog.open) dialog.close();
    app.remove();
  };
}
