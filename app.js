(function () {
	'use strict';

	const CFG = window.SITE_CONFIG;
	const API = 'https://api.github.com';
	const STORAGE_KEY = 'loadscreenPanel.token';

	// ===================================================================
	//  State
	// ===================================================================
	let token = null;
	let pending = null; // working copy of config.json, edited locally
	let configSha = null; // sha of config.json on GitHub, needed to update it
	let dirty = false;

	// ===================================================================
	//  DOM references
	// ===================================================================
	const $ = (id) => document.getElementById(id);

	const loginScreen = $('login-screen');
	const loginForm = $('login-form');
	const loginToken = $('login-token');
	const loginRemember = $('login-remember');
	const loginError = $('login-error');

	const dashboard = $('dashboard');
	const repoLabel = $('repo-label');
	const saveBtn = $('save-btn');
	const saveStatus = $('save-status');
	const logoutBtn = $('logout-btn');

	const imageList = $('image-list');
	const imageUpload = $('image-upload');

	const songCurrent = $('song-current');
	const songPreview = $('song-preview');
	const songVolume = $('song-volume');
	const volumeValue = $('volume-value');
	const songUpload = $('song-upload');
	const songRemoveBtn = $('song-remove-btn');

	const logoCurrent = $('logo-current');
	const logoPreview = $('logo-preview');
	const logoUpload = $('logo-upload');
	const logoRemoveBtn = $('logo-remove-btn');

	const tipList = $('tip-list');
	const tipAddBtn = $('tip-add-btn');

	const slideDurationInput = $('slide-duration');
	const tipDurationInput = $('tip-duration');

	const previewFrame = $('preview-frame');
	const toast = $('toast');

	// ===================================================================
	//  Helpers
	// ===================================================================
	function showToast(message, isError) {
		toast.textContent = message;
		toast.classList.toggle('error', !!isError);
		toast.classList.remove('hidden');
		clearTimeout(showToast._t);
		showToast._t = setTimeout(() => toast.classList.add('hidden'), 3500);
	}

	function markDirty() {
		dirty = true;
		saveBtn.disabled = false;
		saveStatus.textContent = 'Cambios sin guardar';
	}

	function markClean() {
		dirty = false;
		saveBtn.disabled = true;
		saveStatus.textContent = 'Todo guardado';
	}

	function b64EncodeUtf8(str) {
		return btoa(unescape(encodeURIComponent(str)));
	}

	function b64DecodeUtf8(str) {
		return decodeURIComponent(escape(atob(str)));
	}

	function fileToBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result.split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function slugifyFilename(name) {
		const parts = name.split('.');
		const ext = parts.length > 1 ? parts.pop() : '';
		const base = parts.join('.').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
		const stamp = Date.now();
		return (base || 'file') + '-' + stamp + (ext ? '.' + ext.toLowerCase() : '');
	}

	function rawUrlFor(path) {
		return `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/${path}`;
	}

	// ===================================================================
	//  GitHub API
	// ===================================================================
	async function gh(path, options) {
		const response = await fetch(`${API}/repos/${CFG.owner}/${CFG.repo}${path}`, Object.assign({
			headers: Object.assign({
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github+json'
			}, (options && options.headers) || {})
		}, options));

		if (!response.ok) {
			let detail = '';
			try {
				detail = (await response.json()).message || '';
			} catch (e) { /* ignore */ }
			throw new Error(`GitHub API ${response.status}: ${detail || response.statusText}`);
		}

		if (response.status === 204) {
			return null;
		}

		return response.json();
	}

	async function verifyToken() {
		if (!CFG.owner || CFG.owner === 'your-github-username' || !CFG.repo || CFG.repo === 'your-loadscreen-panel-repo') {
			throw new Error(`site.config.js todavia tiene valores de ejemplo (owner/repo). Editalo en GitHub con tu usuario y repo reales, y volve a intentar (puede hacer falta refrescar fuerte la pagina, Ctrl+Shift+R).`);
		}

		try {
			await gh('');
		} catch (err) {
			if (String(err.message).startsWith('GitHub API 404')) {
				throw new Error(`No se encontro el repositorio "${CFG.owner}/${CFG.repo}" (revisa que site.config.js tenga el owner/repo correctos, que el repo exista con ese nombre exacto, y refresca la pagina con Ctrl+Shift+R por si quedo en cache una version vieja). Detalle: ${err.message}`);
			}
			if (String(err.message).startsWith('GitHub API 401')) {
				throw new Error('El token no es valido o ya expiro/fue revocado. Genera uno nuevo en GitHub y probá de nuevo.');
			}
			throw err;
		}
	}

	async function getFile(path) {
		try {
			return await gh(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${CFG.branch}`);
		} catch (err) {
			if (String(err.message).includes('404')) {
				return null;
			}
			throw err;
		}
	}

	async function putFile(path, base64Content, message, sha) {
		const body = { message, content: base64Content, branch: CFG.branch };
		if (sha) {
			body.sha = sha;
		}
		return gh(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	}

	async function deleteFile(path, message, sha) {
		return gh(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message, sha, branch: CFG.branch })
		});
	}

	async function tryDeleteByUrl(url) {
		if (!url || !url.startsWith('https://raw.githubusercontent.com/')) {
			return;
		}

		const prefix = `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${CFG.branch}/`;

		if (!url.startsWith(prefix)) {
			return;
		}

		const path = url.slice(prefix.length);

		try {
			const file = await getFile(path);
			if (file && file.sha) {
				await deleteFile(path, `Remove ${path} via panel`, file.sha);
			}
		} catch (err) {
			console.warn('Could not delete previous asset', path, err);
		}
	}

	async function uploadAsset(file, folder) {
		const filename = slugifyFilename(file.name);
		const path = `${folder}/${filename}`;
		const base64 = await fileToBase64(file);
		await putFile(path, base64, `Upload ${filename} via panel`);
		return rawUrlFor(path);
	}

	// ===================================================================
	//  Auth / session
	// ===================================================================
	function storedToken() {
		return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
	}

	async function tryUnlock(candidateToken, remember) {
		token = candidateToken;
		await verifyToken();

		if (remember) {
			localStorage.setItem(STORAGE_KEY, candidateToken);
		} else {
			sessionStorage.setItem(STORAGE_KEY, candidateToken);
		}
	}

	function logout() {
		token = null;
		localStorage.removeItem(STORAGE_KEY);
		sessionStorage.removeItem(STORAGE_KEY);
		dashboard.classList.add('hidden');
		loginScreen.classList.remove('hidden');
		loginToken.value = '';
	}

	// ===================================================================
	//  Loading / rendering config
	// ===================================================================
	async function loadConfigFromRepo() {
		const file = await getFile(CFG.configPath);

		if (!file) {
			pending = { images: [], song: { url: '', volume: 0.12 }, logo: '', slideDurationMs: 7000, tips: [], tipDurationMs: 6000 };
			configSha = null;
			return;
		}

		configSha = file.sha;
		pending = JSON.parse(b64DecodeUtf8(file.content));

		pending.images = pending.images || [];
		pending.song = pending.song || { url: '', volume: 0.12 };
		pending.tips = pending.tips || [];
		pending.slideDurationMs = pending.slideDurationMs || 7000;
		pending.tipDurationMs = pending.tipDurationMs || 6000;
	}

	function renderAll() {
		renderImages();
		renderSong();
		renderLogo();
		renderTips();
		slideDurationInput.value = Math.round(pending.slideDurationMs / 1000);
		tipDurationInput.value = Math.round(pending.tipDurationMs / 1000);
		sendPreview();
	}

	function renderImages() {
		imageList.innerHTML = '';

		if (!pending.images.length) {
			const empty = document.createElement('div');
			empty.className = 'image-card empty';
			empty.textContent = 'Todavia no hay imagenes. Agrega al menos una.';
			imageList.appendChild(empty);
			return;
		}

		pending.images.forEach((url, index) => {
			const card = document.createElement('div');
			card.className = 'image-card';

			const img = document.createElement('img');
			img.src = url;
			card.appendChild(img);

			const actions = document.createElement('div');
			actions.className = 'image-actions';

			const upBtn = document.createElement('button');
			upBtn.textContent = '↑';
			upBtn.title = 'Subir';
			upBtn.disabled = index === 0;
			upBtn.addEventListener('click', () => moveImage(index, -1));

			const downBtn = document.createElement('button');
			downBtn.textContent = '↓';
			downBtn.title = 'Bajar';
			downBtn.disabled = index === pending.images.length - 1;
			downBtn.addEventListener('click', () => moveImage(index, 1));

			const removeBtn = document.createElement('button');
			removeBtn.textContent = '✕';
			removeBtn.className = 'remove';
			removeBtn.title = 'Quitar';
			removeBtn.addEventListener('click', () => removeImage(index));

			actions.appendChild(upBtn);
			actions.appendChild(downBtn);
			actions.appendChild(removeBtn);
			card.appendChild(actions);

			imageList.appendChild(card);
		});
	}

	function moveImage(index, delta) {
		const target = index + delta;
		if (target < 0 || target >= pending.images.length) {
			return;
		}
		const [item] = pending.images.splice(index, 1);
		pending.images.splice(target, 0, item);
		markDirty();
		renderImages();
		sendPreview();
	}

	async function removeImage(index) {
		const [url] = pending.images.splice(index, 1);
		markDirty();
		renderImages();
		sendPreview();
		tryDeleteByUrl(url);
	}

	function renderSong() {
		if (pending.song && pending.song.url) {
			songCurrent.textContent = decodeURIComponent(pending.song.url.split('/').pop());
			songPreview.src = pending.song.url;
			songPreview.classList.remove('hidden');
			songRemoveBtn.disabled = false;
		} else {
			songCurrent.textContent = 'Sin cancion configurada.';
			songPreview.classList.add('hidden');
			songPreview.removeAttribute('src');
			songRemoveBtn.disabled = true;
		}

		const volumePct = Math.round((pending.song.volume ?? 0.12) * 100);
		songVolume.value = volumePct;
		volumeValue.textContent = volumePct;
	}

	function renderLogo() {
		if (pending.logo) {
			logoCurrent.textContent = decodeURIComponent(pending.logo.split('/').pop());
			logoPreview.src = pending.logo;
			logoPreview.classList.remove('hidden');
			logoRemoveBtn.disabled = false;
		} else {
			logoCurrent.textContent = 'Sin logo configurado.';
			logoPreview.classList.add('hidden');
			logoPreview.removeAttribute('src');
			logoRemoveBtn.disabled = true;
		}
	}

	function renderTips() {
		tipList.innerHTML = '';

		pending.tips.forEach((tip, index) => {
			const row = document.createElement('div');
			row.className = 'tip-row';

			const input = document.createElement('input');
			input.type = 'text';
			input.value = tip;
			input.placeholder = 'Texto del tip...';
			input.addEventListener('input', () => {
				pending.tips[index] = input.value;
				markDirty();
				sendPreview();
			});

			const removeBtn = document.createElement('button');
			removeBtn.textContent = '✕';
			removeBtn.addEventListener('click', () => {
				pending.tips.splice(index, 1);
				markDirty();
				renderTips();
				sendPreview();
			});

			row.appendChild(input);
			row.appendChild(removeBtn);
			tipList.appendChild(row);
		});
	}

	// ===================================================================
	//  Preview bridge (postMessage to preview/index.html iframe)
	// ===================================================================
	function sendPreview() {
		if (!previewFrame.contentWindow) {
			return;
		}
		previewFrame.contentWindow.postMessage({ type: 'previewConfig', config: pending }, '*');
	}

	previewFrame.addEventListener('load', sendPreview);

	// ===================================================================
	//  Save
	// ===================================================================
	async function saveConfig() {
		saveBtn.disabled = true;
		saveStatus.textContent = 'Guardando...';

		try {
			const content = b64EncodeUtf8(JSON.stringify(pending, null, 2));
			const result = await putFile(CFG.configPath, content, 'Update loading screen config via panel', configSha || undefined);
			configSha = result.content.sha;
			markClean();
			showToast('Cambios guardados. Puede tardar unos minutos en verse en el servidor.');
		} catch (err) {
			console.error(err);
			saveBtn.disabled = false;
			saveStatus.textContent = '';
			showToast('Error al guardar: ' + err.message, true);
		}
	}

	// ===================================================================
	//  Event wiring
	// ===================================================================
	loginForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		loginError.classList.add('hidden');

		const candidate = loginToken.value.trim();
		if (!candidate) {
			return;
		}

		try {
			await tryUnlock(candidate, loginRemember.checked);
			await enterDashboard();
		} catch (err) {
			loginError.textContent = 'No se pudo validar la clave: ' + err.message;
			loginError.classList.remove('hidden');
		}
	});

	logoutBtn.addEventListener('click', logout);

	saveBtn.addEventListener('click', saveConfig);

	imageUpload.addEventListener('change', async () => {
		const file = imageUpload.files[0];
		imageUpload.value = '';
		if (!file) {
			return;
		}

		showToast('Subiendo imagen...');
		try {
			const url = await uploadAsset(file, CFG.imagesPath);
			pending.images.push(url);
			markDirty();
			renderImages();
			sendPreview();
			showToast('Imagen subida.');
		} catch (err) {
			showToast('Error al subir la imagen: ' + err.message, true);
		}
	});

	songUpload.addEventListener('change', async () => {
		const file = songUpload.files[0];
		songUpload.value = '';
		if (!file) {
			return;
		}

		showToast('Subiendo cancion...');
		try {
			const previousUrl = pending.song.url;
			const url = await uploadAsset(file, CFG.audioPath);
			pending.song.url = url;
			markDirty();
			renderSong();
			sendPreview();
			showToast('Cancion subida.');
			if (previousUrl) {
				tryDeleteByUrl(previousUrl);
			}
		} catch (err) {
			showToast('Error al subir la cancion: ' + err.message, true);
		}
	});

	songVolume.addEventListener('input', () => {
		volumeValue.textContent = songVolume.value;
		pending.song.volume = Number(songVolume.value) / 100;
		markDirty();
		sendPreview();
	});

	songRemoveBtn.addEventListener('click', () => {
		const previousUrl = pending.song.url;
		pending.song.url = '';
		markDirty();
		renderSong();
		sendPreview();
		if (previousUrl) {
			tryDeleteByUrl(previousUrl);
		}
	});

	logoUpload.addEventListener('change', async () => {
		const file = logoUpload.files[0];
		logoUpload.value = '';
		if (!file) {
			return;
		}

		showToast('Subiendo logo...');
		try {
			const previousUrl = pending.logo;
			const url = await uploadAsset(file, CFG.imagesPath);
			pending.logo = url;
			markDirty();
			renderLogo();
			sendPreview();
			showToast('Logo subido.');
			if (previousUrl) {
				tryDeleteByUrl(previousUrl);
			}
		} catch (err) {
			showToast('Error al subir el logo: ' + err.message, true);
		}
	});

	logoRemoveBtn.addEventListener('click', () => {
		const previousUrl = pending.logo;
		pending.logo = '';
		markDirty();
		renderLogo();
		sendPreview();
		if (previousUrl) {
			tryDeleteByUrl(previousUrl);
		}
	});

	tipAddBtn.addEventListener('click', () => {
		pending.tips.push('');
		markDirty();
		renderTips();
	});

	slideDurationInput.addEventListener('input', () => {
		const seconds = Math.max(2, Number(slideDurationInput.value) || 7);
		pending.slideDurationMs = seconds * 1000;
		markDirty();
		sendPreview();
	});

	tipDurationInput.addEventListener('input', () => {
		const seconds = Math.max(2, Number(tipDurationInput.value) || 6);
		pending.tipDurationMs = seconds * 1000;
		markDirty();
		sendPreview();
	});

	window.addEventListener('beforeunload', (e) => {
		if (dirty) {
			e.preventDefault();
			e.returnValue = '';
		}
	});

	// ===================================================================
	//  Boot
	// ===================================================================
	async function enterDashboard() {
		repoLabel.textContent = `${CFG.owner}/${CFG.repo} (${CFG.branch})`;
		loginScreen.classList.add('hidden');
		dashboard.classList.remove('hidden');

		await loadConfigFromRepo();
		markClean();
		renderAll();
	}

	(async function init() {
		const existing = storedToken();
		if (!existing) {
			return;
		}

		try {
			await tryUnlock(existing, !!localStorage.getItem(STORAGE_KEY));
			await enterDashboard();
		} catch (err) {
			logout();
		}
	})();
})();
