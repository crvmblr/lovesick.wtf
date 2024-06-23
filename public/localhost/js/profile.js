// INIT OBJECTS
let elements = {};
let ids = [
    'avatar',
    'name',
    'socials',
    'bio',
    'settings',
    'login',
    'logout',
    'loginPopupHolder',
    'settingsPopupHolder',
    'loginPopup',
    'settingsPopup',
    'loginBtn',
    'loginStatus',
    'loginUsername',
    'loginPassword',
    'avHolder',
    'bioEdit',
    'primaryColor',
    'accentColor',
    'avatarURL',
    'saveSettings',
    'settingsStatus',
    'musBack',
    'musPlay',
    'musNext',
    'muteMus',
    'musVolume',
    'moosic',
    'musProgress',
    'musTime',
    'musTimeC',
    'musName',
    'musNameI', // Music name input
    'musURL',
    'musHolder',
    'bg',
    'bgType',
    'bgImage',
    'bgVideo',
    'bgCol',
    'bgOpacity',
    'embedDesc',
    'noSanitize'
];
let documentStyle = document.documentElement.style;

// LOAD SHIKI
let highlighter = fetch('js/onig.wasm')
    .then((res) => {
        shiki.setWasm(res);
        return shiki.getHighlighter({
            theme: 'one-dark-pro',
        });
    })
    .then((hl) => {
        highlighter = hl;
        highlightCodeBlocks();
    });

for (let i = 0; i < ids.length; i++)
    elements[ids[i]] = document.getElementById(ids[i]);

// UTILITIES
let getColor = (color) =>
    color < 1 || color > 0xffffffff
        ? null
        : '#' +
          ((color >> 24) & 0xff).toString(16).padStart(2, '0') +
          ((color >> 16) & 0xff).toString(16).padStart(2, '0') +
          ((color >> 8) & 0xff).toString(16).padStart(2, '0') +
          (color & 0xff).toString(16).padStart(2, '0');

let toColorNum = (color) => {
    let rgb = parseInt(color.slice(1), 16);
    return ((rgb << 8) | 0xff) >>> 0;
};

let isDark = (color) => {
    let [r, g, b] = [
        (color >> 24) & 0xff,
        (color >> 16) & 0xff,
        (color >> 8) & 0xff,
    ];

    return Math.max(r, g, b) + Math.min(r, g, b) <= 255;
};

let minSec = (sec) => {
    sec = sec || 0;

    let mins = Math.floor(sec / 60);
    let secs = Math.floor(sec % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
};

let toUTF8 = (str) => String.fromCodePoint(...new TextEncoder().encode(str));
let toUnicode = (str) =>
    new TextDecoder().decode(Uint8Array.from(str, (c) => c.codePointAt(0)));

// LOAD PROFILE
function loadProfile() {
    elements.avatar.src = profile.avatar || '';
    if (!profile.avatar) elements.avHolder.style.display = 'none';
    elements.name.textContent = profile.name || '';
    elements.name.dataset.text = profile.name || '';

    if (profile.music && profile.music.url) {
        elements.musHolder.style.display = '';
        if (elements.moosic.src !== profile.music.url)
            elements.moosic.src = profile.music.url;
        elements.musName.textContent = profile.music.name || '';
    } else elements.musHolder.style.display = 'none';

    if (profile.background && profile.background.type) {
        switch (profile.background.type) {
            case 1:
                elements.bg.style.setProperty(
                    '--bg',
                    getColor(profile.background.color)
                );
                break;
            case 2:
                elements.bg.style.setProperty(
                    '--bg',
                    'url(' + profile.background.image + ')'
                );
                elements.bg.src = '';
                break;
            case 3:
                elements.bg.src = profile.background.video;
                elements.bg.style.setProperty('--bg', '');
                elements.bg.play();
                break;
        }

        elements.bg.style.setProperty(
            '--opacity',
            typeof profile.background.opacity === 'number'
                ? profile.background.opacity
                : 1
        );
    } else elements.bg.style.setProperty('--bg', '');

    let sanitizer = profile.noSanitize ? s => s : DOMPurify.sanitize;
    elements.bio.innerHTML = sanitizer(
        marked.marked(profile.bio || '')
    );

    if (profile.noSanitize) loadBioScripts();

    let theme = {
        ...profile.theme,
        primaryDark: isDark(profile.theme.primary),
        accentDark: isDark(profile.theme.accent),
    };

    documentStyle.setProperty('--primary', getColor(theme.primary));
    documentStyle.setProperty('--accent', getColor(theme.accent));

    if (!(highlighter instanceof Promise)) highlightCodeBlocks();
}

// SCRIPTING IN BIO
function loadBioScripts(parent = elements.bio) {
    for (let i = 0; i < parent.childNodes.length; i++) {
        let child = parent.childNodes[i];
        if (!child) continue;

        if (child.nodeName !== 'SCRIPT') {
            loadBioScripts(child); // RECURSIVE
            continue;
        }

        let { src, textContent } = child;
        
        let newEl = document.createElement('script');
        newEl.src = src;
        if (textContent) try {
            new Function(textContent)();
        } catch{}
        else document.head.appendChild(newEl);
        child.remove();

    }
}

// SHIKI
function highlightCodeBlocks() {
    let blocks = document.querySelectorAll('pre > code');
    for (let i = 0; i < blocks.length; i++) {
        let block = blocks[i];
        let lang = block.className.replace('language-', '');
        let code = block.textContent.trim();
        let highlighted = highlighter.codeToHtml(code, lang);
        block.parentElement.outerHTML = highlighted;
    }
}

// MUSIC PLAYER
function loadMusic() {
    elements.musBack.onclick = () => {
        elements.moosic.currentTime -= 10;
    };

    elements.musPlay.onclick = () => {
        if (elements.moosic.paused) elements.moosic.play();
        else elements.moosic.pause();
    };

    elements.musNext.onclick = () => {
        elements.moosic.currentTime += 10;
    };

    let savedVolume = parseInt(localStorage.profile_volume) || 100;
    elements.muteMus.onclick = () => {
        let newVol = elements.moosic.volume > 0 ? 0 : savedVolume / 100;

        elements.musVolume.value = newVol * 100;
        elements.musVolume.oninput();
    };

    elements.musVolume.oninput = () => {
        let vol = elements.musVolume.value;
        elements.moosic.volume = vol / 100;
        localStorage.profile_volume = vol;

        if (vol == 0) elements.muteMus.textContent = 'volume_off';
        else if (vol < 50) elements.muteMus.textContent = 'volume_down';
        else elements.muteMus.textContent = 'volume_up';
    };

    setInterval(() => {
        elements.musProgress.style.setProperty(
            '--progress',
            (elements.moosic.currentTime / elements.moosic.duration) * 100 + '%'
        );

        elements.musTime.textContent = minSec(elements.moosic.currentTime);
        elements.musTimeC.textContent = minSec(elements.moosic.duration);

        if (elements.moosic.paused) elements.musPlay.textContent = 'play_arrow';
        else elements.musPlay.textContent = 'pause';
    }, 1000 / 30);
}

// AUTHENTICATION HANDLERS + PROFILE SETTINGS
function loadAuth() {
    elements.loginPopupHolder.onclick = () =>
        elements.loginPopupHolder.classList.remove('active');

    elements.settingsPopupHolder.onclick = () =>
        elements.settingsPopupHolder.classList.remove('active');

    elements.loginPopup.onclick = (e) => e.stopPropagation();
    elements.settingsPopup.onclick = (e) => e.stopPropagation();

    elements.login.onclick = () =>
        elements.loginPopupHolder.classList.add('active');

    elements.logout.onclick = () => {
        delete localStorage.token;
        elements.settings.style.display = 'none';
        elements.logout.style.display = 'none';
        elements.login.style.display = '';
    };

    elements.settings.onclick = () => {
        elements.settingsPopupHolder.classList.add('active');

        elements.bioEdit.value = profile.bio;
        elements.primaryColor.value = getColor(profile.theme.primary).slice(
            0,
            -2
        );
        elements.accentColor.value = getColor(profile.theme.accent).slice(
            0,
            -2
        );
        elements.avatarURL.value = profile.avatar;
        elements.musNameI.value = profile.music?.name || '';
        elements.musURL.value = profile.music?.url || '';

        elements.bgType.onchange = () => {
            switch (elements.bgType.value) {
                case 'none':
                    elements.bgImage.style.display = 'none';
                    elements.bgVideo.style.display = 'none';
                    elements.bgCol.style.display = 'none';
                    break;
                case 'color':
                    elements.bgImage.style.display = 'none';
                    elements.bgVideo.style.display = 'none';
                    elements.bgCol.style.display = '';
                    break;
                case 'image':
                    elements.bgImage.style.display = '';
                    elements.bgVideo.style.display = 'none';
                    elements.bgCol.style.display = 'none';
                    break;
                case 'video':
                    elements.bgImage.style.display = 'none';
                    elements.bgVideo.style.display = '';
                    elements.bgCol.style.display = 'none';
                    break;
            }
        };

        elements.bgType.value = ['none', 'color', 'image', 'video'][
            profile.background?.type || 0
        ];
        elements.bgType.onchange();

        elements.bgImage.value = profile.background?.image || '';
        elements.bgVideo.value = profile.background?.video || '';
        elements.bgCol.value =
            getColor(profile.background?.color).slice(0, -2) || '#000000';

        elements.bgOpacity.value =
            typeof profile.background?.opacity == 'number'
                ? profile.background?.opacity * 100
                : 100;

        elements.embedDesc.value = profile.embedDescription || '';
        elements.noSanitize.checked = profile.noSanitize;
    };

    elements.loginBtn.onclick = () => {
        elements.loginBtn.disabled = true;
        elements.loginStatus.textContent = 'Please wait...';

        let username = elements.loginUsername.value;
        let password = elements.loginPassword.value;
        let silent = false;

        if (
            !elements.loginPopupHolder.classList.contains('active') &&
            localStorage.token
        ) {
            let [u, p] = localStorage.token.split(':').map(atob);

            username = u;
            password = p;
            silent = true;
        }

        fetch('/api/login', {
            method: 'POST',
            body: JSON.stringify({
                username,
                password,
            }),
        })
            .then((r) => {
                if (r.status !== 200) {
                    if (!silent)
                        elements.loginStatus.textContent = 'Login failed.';
                    elements.loginBtn.disabled = false;
                    return null;
                } else {
                    if (!silent)
                        elements.loginStatus.textContent =
                            'Logged in successfully.';

                    localStorage.token =
                        btoa(toUTF8(username)) + ':' + btoa(toUTF8(password));

                    setTimeout(() => {
                        elements.loginPopupHolder.classList.remove('active');
                        elements.loginStatus.textContent = '';
                        elements.loginBtn.disabled = false;
                    }, 500);

                    return r.json();
                }
            })
            .then((user) => {
                if (!user) return;

                let viewingUser =
                    username === window.profile?.name || user.horny;

                elements.settings.style.display = viewingUser ? '' : 'none';
                elements.logout.style.display = '';
                elements.login.style.display = 'none';

                if (!user.horny) {
                    let style = document.createElement('style');
                    style.textContent = '.devOnly { display: none !important }';
                    document.head.appendChild(style);
                }
            });
    };

    elements.saveSettings.onclick = () => {
        elements.saveSettings.disabled = true;

        let bio = elements.bioEdit.value;
        let primary = toColorNum(elements.primaryColor.value);
        let accent = toColorNum(elements.accentColor.value);
        let avatar = elements.avatarURL.value;

        if (
            bio !== profile.bio ||
            primary !== profile.theme.primary ||
            accent !== profile.theme.accent ||
            avatar !== profile.avatar ||
            elements.musNameI.value !== profile.music?.name ||
            elements.musURL.value !== profile.music?.url ||
            elements.bgType.value !==
                ['none', 'color', 'image', 'video'][
                    profile.background?.type || 0
                ] ||
            elements.bgImage.value !== profile.background?.image ||
            elements.bgVideo.value !== profile.background?.image ||
            elements.bgCol.value !==
                getColor(profile.background?.color).slice(0, -2) ||
            elements.bgOpacity.value !== profile.background?.opacity * 100 ||
            elements.embedDesc.value !== profile.embedDescription ||
            elements.noSanitize.value !== profile.noSanitize
        ) {
            let oldProfile = JSON.parse(JSON.stringify(profile));

            profile.bio = bio;
            profile.theme.primary = primary;
            profile.theme.accent = accent;
            profile.avatar = avatar;
            profile.music = {
                name: elements.musNameI.value || '',
                url: elements.musURL.value || '',
            };
            profile.background = {
                type: ['none', 'color', 'image', 'video'].indexOf(
                    elements.bgType.value
                ),
                image: elements.bgImage.value || '',
                video: elements.bgVideo.value || '',
                color: toColorNum(elements.bgCol.value),
                opacity: elements.bgOpacity.value / 100,
            };
            profile.embedDescription = elements.embedDesc.value || '';
            profile.noSanitize = !!elements.noSanitize.checked;

            fetch('/api/profile', {
                method: 'POST',
                body: JSON.stringify(profile),
                headers: {
                    Authorization: 'Basic ' + localStorage.token,
                },
            }).then((r) => {
                if (r.status !== 200) {
                    elements.settingsStatus.textContent = 'Failed to save.';
                    profile = oldProfile;
                    elements.saveSettings.disabled = false;
                } else {
                    elements.settingsStatus.textContent = 'Saved successfully.';

                    loadProfile();
                    setTimeout(() => {
                        elements.settingsPopupHolder.classList.remove('active');
                        elements.settingsStatus.textContent = '';
                        elements.saveSettings.disabled = false;
                    }, 500);
                }
            });
        } else {
            elements.settingsStatus.textContent = 'No changes to save.';
            elements.saveSettings.disabled = false;
        }
    };

    elements.loginBtn.click();
}

// RUN ON LOAD
loadProfile();
loadMusic();
loadAuth();
