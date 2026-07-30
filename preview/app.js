(function () {
	'use strict';

	const slidesContainer = document.getElementById('slides');
	const emptyHint = document.getElementById('empty-hint');
	const tipEl = document.getElementById('tip-text');
	const audio = document.getElementById('audio');
	const muteBtn = document.getElementById('mute-btn');
	const logoEl = document.getElementById('logo');
	const progressFill = document.getElementById('progress-fill');

	let slideTimer = null;
	let tipTimer = null;

	function clearTimers() {
		if (slideTimer) clearInterval(slideTimer);
		if (tipTimer) clearInterval(tipTimer);
		slideTimer = null;
		tipTimer = null;
	}

	function render(config) {
		clearTimers();
		slidesContainer.innerHTML = '';

		const images = (config.images || []).filter(Boolean);
		emptyHint.classList.toggle('hidden', images.length > 0);

		const slideEls = images.map((src, i) => {
			const el = document.createElement('div');
			el.className = 'slide' + (i === 0 ? ' active' : '');
			el.style.backgroundImage = `url("${src}")`;
			slidesContainer.appendChild(el);
			return el;
		});

		if (slideEls.length > 1) {
			let current = 0;
			slideTimer = setInterval(() => {
				const next = (current + 1) % slideEls.length;
				slideEls[current].classList.remove('active');
				slideEls[next].classList.add('active');
				current = next;
			}, config.slideDurationMs || 7000);
		}

		const tips = (config.tips || []).filter((t) => t && t.trim());

		if (tips.length) {
			let current = 0;

			function showTip(index) {
				tipEl.classList.remove('visible');
				setTimeout(() => {
					tipEl.textContent = tips[index];
					tipEl.classList.add('visible');
				}, 200);
			}

			showTip(current);

			if (tips.length > 1) {
				tipTimer = setInterval(() => {
					current = (current + 1) % tips.length;
					showTip(current);
				}, config.tipDurationMs || 6000);
			}
		} else {
			tipEl.classList.remove('visible');
		}

		if (config.logo) {
			logoEl.src = config.logo;
			logoEl.classList.add('visible');
		} else {
			logoEl.classList.remove('visible');
			logoEl.removeAttribute('src');
		}

		if (config.song && config.song.url) {
			if (audio.src !== config.song.url) {
				audio.src = config.song.url;
			}
			audio.volume = typeof config.song.volume === 'number' ? config.song.volume : 0.12;
			muteBtn.style.display = 'flex';
		} else {
			audio.removeAttribute('src');
			muteBtn.style.display = 'none';
		}
	}

	muteBtn.addEventListener('click', () => {
		audio.muted = !audio.muted;
		muteBtn.classList.toggle('unmuted', !audio.muted);
		if (!audio.muted) {
			audio.play().catch(() => {});
		}
	});

	// Fake, ever-looping progress bar just so the preview looks alive.
	let fakeProgress = 0;
	setInterval(() => {
		fakeProgress = (fakeProgress + 0.02) % 1;
		progressFill.style.width = (fakeProgress * 100) + '%';
	}, 200);

	window.addEventListener('message', (e) => {
		if (e.data && e.data.type === 'previewConfig') {
			render(e.data.config || {});
		}
	});

	render({});
})();
