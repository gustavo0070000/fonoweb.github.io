// FonoPlayer Web App Core Logic

// State management
let cdsData = null;
let selectedCdId = null;
let playingCdId = null;
let playingTrackIndex = -1;
let isPlaying = false;
let isMuted = false;
let previousVolume = 0.5;

// Settings configuration
const DEFAULT_CONFIG_URL = "https://raw.githubusercontent.com/gustavo0070000/fonoApp/main/meus_cds.json";
let settings = {
    configUrl: DEFAULT_CONFIG_URL,
    githubToken: "",
    githubUser: "gustavo0070000",
    githubRepo: "fonoApp",
    githubBranch: "main"
};

// Cache storage name
const AUDIO_CACHE_NAME = "fonoplayer-audio-cache";
let activeDownloads = new Set(); // URL strings

// DOM elements
const audioEl = document.getElementById("audioElement");
const cdListEl = document.getElementById("cdList");
const cdDetailsSection = document.getElementById("cdDetailsSection");
const emptyStateSection = document.getElementById("emptyStateSection");

// Details Header
const cdTitleEl = document.getElementById("cdTitle");
const cdDescriptionEl = document.getElementById("cdDescription");
const cdMainCoverEl = document.getElementById("cdMainCover");
const btnClearCDCache = document.getElementById("btnClearCDCache");
const btnDownloadAll = document.getElementById("btnDownloadAll");
const trackListEl = document.getElementById("trackList");

// Player controls
const playerMiniCover = document.getElementById("playerMiniCover");
const playerTrackTitle = document.getElementById("playerTrackTitle");
const playerTrackAlbum = document.getElementById("playerTrackAlbum");
const btnPrev = document.getElementById("btnPrev");
const btnPlayPause = document.getElementById("btnPlayPause");
const btnStop = document.getElementById("btnStop");
const btnNext = document.getElementById("btnNext");
const timeElapsedEl = document.getElementById("timeElapsed");
const timeDurationEl = document.getElementById("timeDuration");
const timelineSlider = document.getElementById("timelineSlider");
const sliderProgress = document.getElementById("sliderProgress");
const btnMute = document.getElementById("btnMute");
const volumeSlider = document.getElementById("volumeSlider");
const volumeProgress = document.getElementById("volumeProgress");

// Modals
const btnOpenImport = document.getElementById("btnOpenImport");
const btnSync = document.getElementById("btnSync");
const btnOpenSettings = document.getElementById("btnOpenSettings");

const modalSettings = document.getElementById("modalSettings");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const btnCancelSettings = document.getElementById("btnCancelSettings");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const settingsRepoUrl = document.getElementById("settingsRepoUrl");
const settingsToken = document.getElementById("settingsToken");
const btnToggleToken = document.getElementById("btnToggleToken");
const settingsUser = document.getElementById("settingsUser");
const settingsRepo = document.getElementById("settingsRepo");
const settingsBranch = document.getElementById("settingsBranch");
const btnClearAllCache = document.getElementById("btnClearAllCache");
const cacheSpaceLabel = document.getElementById("cacheSpaceLabel");

const modalImport = document.getElementById("modalImport");
const btnCloseImport = document.getElementById("btnCloseImport");
const btnCancelImport = document.getElementById("btnCancelImport");
const btnStartImport = document.getElementById("btnStartImport");
const btnSelectFolder = document.getElementById("btnSelectFolder");
const importFolderInput = document.getElementById("importFolderInput");
const selectedFolderText = document.getElementById("selectedFolderText");
const btnSelectCover = document.getElementById("btnSelectCover");
const importCoverInput = document.getElementById("importCoverInput");
const selectedCoverText = document.getElementById("selectedCoverText");
const importTitle = document.getElementById("importTitle");
const importDesc = document.getElementById("importDesc");

const modalProgress = document.getElementById("modalProgress");
const progressTitle = document.getElementById("progressTitle");
const progressLog = document.getElementById("progressLog");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");

// Temporary variables for file imports
let importedFilesList = [];
let importedCoverFile = null;

// ========================================================
// INITIALIZATION
// ========================================================

document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    initializeAudioEvents();
    initializeUIEvents();
    loadCatalogData(false); // Silent load from localStorage if available
    updateCacheSizeDisplay();
    
    // Register PWA service worker if supported
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log("Service Worker registration failed: ", err);
        });
    }
});

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem("fonoplayer_settings");
    if (saved) {
        try {
            settings = { ...settings, ...JSON.parse(saved) };
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }
    
    // Sync to form inputs
    settingsRepoUrl.value = settings.configUrl || DEFAULT_CONFIG_URL;
    settingsToken.value = settings.githubToken || "";
    settingsUser.value = settings.githubUser || "gustavo0070000";
    settingsRepo.value = settings.githubRepo || "fonoApp";
    settingsBranch.value = settings.githubBranch || "main";
}

// Save settings to localStorage
function saveSettings() {
    settings.configUrl = settingsRepoUrl.value.trim() || DEFAULT_CONFIG_URL;
    settings.githubToken = settingsToken.value.trim();
    settings.githubUser = settingsUser.value.trim() || "gustavo0070000";
    settings.githubRepo = settingsRepo.value.trim() || "fonoApp";
    settings.githubBranch = settingsBranch.value.trim() || "main";
    
    // Convert regular github web page urls to raw urls
    if (settings.configUrl.includes("github.com") && settings.configUrl.includes("/blob/")) {
        settings.configUrl = settings.configUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    }
    
    localStorage.setItem("fonoplayer_settings", JSON.stringify(settings));
    hideModal(modalSettings);
    loadCatalogData(true); // Force reload with new URL
}

// Initialize audio node event handlers
function initializeAudioEvents() {
    // Timeupdate ticks elapsed progress
    audioEl.addEventListener("timeupdate", () => {
        if (!timelineSlider.dataset.dragging) {
            const elapsed = audioEl.currentTime;
            const duration = audioEl.duration || 0;
            
            timeElapsedEl.textContent = formatTime(elapsed);
            if (duration > 0) {
                const pct = (elapsed / duration) * 100;
                timelineSlider.value = pct;
                sliderProgress.style.width = pct + "%";
            } else {
                timelineSlider.value = 0;
                sliderProgress.style.width = "0%";
            }
        }
    });

    // DurationChange gets total audio duration
    audioEl.addEventListener("durationchange", () => {
        timeDurationEl.textContent = formatTime(audioEl.duration || 0);
    });

    // Audio playback completed naturally -> move to next track
    audioEl.addEventListener("ended", () => {
        playNextTrack();
    });
}

// Bind UI buttons and input fields click events
function initializeUIEvents() {
    // Play/Pause button toggle
    btnPlayPause.addEventListener("click", () => {
        if (!playingCdId) {
            // Auto play first CD and first track if nothing selected
            if (cdsData && cdsData.cds && cdsData.cds.length > 0) {
                selectCD(cdsData.cds[0].id);
                if (cdsData.cds[0].tracks && cdsData.cds[0].tracks.length > 0) {
                    playTrack(0);
                }
            }
            return;
        }
        
        if (isPlaying) {
            pauseTrack();
        } else {
            resumeTrack();
        }
    });

    // Stop button click
    btnStop.addEventListener("click", stopTrack);

    // Prev & Next track navigation
    btnPrev.addEventListener("click", playPrevTrack);
    btnNext.addEventListener("click", playNextTrack);

    // Timeline Drag Seeking handlers
    timelineSlider.addEventListener("input", () => {
        timelineSlider.dataset.dragging = "true";
        const pct = parseFloat(timelineSlider.value);
        sliderProgress.style.width = pct + "%";
        
        const duration = audioEl.duration || 0;
        timeElapsedEl.textContent = formatTime((pct / 100) * duration);
    });

    timelineSlider.addEventListener("change", () => {
        delete timelineSlider.dataset.dragging;
        const pct = parseFloat(timelineSlider.value);
        const duration = audioEl.duration || 0;
        if (duration > 0) {
            audioEl.currentTime = (pct / 100) * duration;
        }
    });

    // Volume Slider handler
    volumeSlider.addEventListener("input", () => {
        const vol = parseFloat(volumeSlider.value) / 100;
        audioEl.volume = vol;
        volumeProgress.style.width = (vol * 100) + "%";
        
        if (vol === 0) {
            btnMute.textContent = "🔇";
            isMuted = true;
        } else {
            btnMute.textContent = vol < 0.4 ? "🔈" : "🔊";
            isMuted = false;
        }
    });

    // Mute toggle handler
    btnMute.addEventListener("click", () => {
        if (isMuted) {
            audioEl.volume = previousVolume;
            volumeSlider.value = previousVolume * 100;
            volumeProgress.style.width = (previousVolume * 100) + "%";
            btnMute.textContent = previousVolume < 0.4 ? "🔈" : "🔊";
            isMuted = false;
        } else {
            previousVolume = audioEl.volume;
            audioEl.volume = 0;
            volumeSlider.value = 0;
            volumeProgress.style.width = "0%";
            btnMute.textContent = "🔇";
            isMuted = true;
        }
    });

    // Modal Visibility Handlers
    btnOpenSettings.addEventListener("click", () => {
        loadSettings();
        updateCacheSizeDisplay();
        showModal(modalSettings);
    });
    btnCloseSettings.addEventListener("click", () => hideModal(modalSettings));
    btnCancelSettings.addEventListener("click", () => hideModal(modalSettings));
    btnSaveSettings.addEventListener("click", saveSettings);
    
    btnToggleToken.addEventListener("click", () => {
        if (settingsToken.type === "password") {
            settingsToken.type = "text";
            btnToggleToken.textContent = "🔒";
        } else {
            settingsToken.type = "password";
            btnToggleToken.textContent = "👁️";
        }
    });

    btnOpenImport.addEventListener("click", () => {
        // Validation check for Git settings
        if (!settings.githubToken || !settings.githubUser || !settings.githubRepo) {
            alert("Por favor, preencha o Token do GitHub e as informações do repositório em 'Ajustes' antes de importar um CD.");
            showModal(modalSettings);
            return;
        }
        
        // Reset dialog variables
        importTitle.value = "";
        importDesc.value = "";
        importedFilesList = [];
        importedCoverFile = null;
        selectedFolderText.textContent = "Nenhuma pasta selecionada.";
        selectedCoverText.textContent = "Nenhuma imagem selecionada.";
        showModal(modalImport);
    });
    btnCloseImport.addEventListener("click", () => hideModal(modalImport));
    btnCancelImport.addEventListener("click", () => hideModal(modalImport));
    btnStartImport.addEventListener("click", processCDImport);

    // Sync button triggers download
    btnSync.addEventListener("click", () => {
        loadCatalogData(true);
    });

    // CD Import Folder & Cover Browser Hooks
    btnSelectFolder.addEventListener("click", () => importFolderInput.click());
    importFolderInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.wav'));
        if (files.length > 0) {
            importedFilesList = files;
            selectedFolderText.textContent = `${files.length} arquivos WAV encontrados.`;
            
            // Auto-suggest CD title from folder path base
            const pathParts = files[0].webkitRelativePath.split('/');
            if (pathParts.length > 1) {
                importTitle.value = cleanName(pathParts[0]);
            }
        } else {
            importedFilesList = [];
            selectedFolderText.textContent = "Nenhum arquivo .wav encontrado nesta pasta.";
        }
    });

    btnSelectCover.addEventListener("click", () => importCoverInput.click());
    importCoverInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            importedCoverFile = e.target.files[0];
            selectedCoverText.textContent = `${importedCoverFile.name}`;
        } else {
            importedCoverFile = null;
            selectedCoverText.textContent = "Nenhuma imagem selecionada.";
        }
    });

    // CD Cache Action Buttons
    btnClearCDCache.addEventListener("click", deleteSelectedCDCache);
    btnDownloadAll.addEventListener("click", downloadAllSelectedCDTracks);

    btnClearAllCache.addEventListener("click", () => {
        if (confirm("Tem certeza de que deseja excluir permanentemente TODO o cache local? Você precisará de internet para tocar os CDs novamente.")) {
            clearEntireCache();
        }
    });
}

// Modal Toggle helpers
function showModal(modal) {
    modal.style.display = "flex";
}
function hideModal(modal) {
    modal.style.display = "none";
}

// ========================================================
// CATALOG DATA MANAGEMENT & RENDERERS
// ========================================================

// Fetch configuration JSON
async function loadCatalogData(forceFetch = false) {
    // 1. Try to load from localStorage first if not forcing sync
    const cachedData = localStorage.getItem("fonoplayer_catalog_data");
    if (cachedData && !forceFetch) {
        try {
            cdsData = JSON.parse(cachedData);
            rebuildCDSidebar();
            console.log("Loaded catalog from localStorage cache.");
            return;
        } catch (e) {
            console.error("Error loading localStorage catalog:", e);
        }
    }
    
    // 2. Fetch from remote raw URL
    const url = settings.configUrl || DEFAULT_CONFIG_URL;
    if (forceFetch) {
        cdListEl.innerHTML = '<div class="loading-placeholder">Carregando catálogo da nuvem...</div>';
    }
    
    try {
        const response = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data || !data.cds) {
            throw new Error("Formato de catálogo inválido. Chave 'cds' não encontrada.");
        }
        
        // Save to cache
        cdsData = data;
        localStorage.setItem("fonoplayer_catalog_data", JSON.stringify(data));
        
        rebuildCDSidebar();
        
        if (forceFetch) {
            alert("Catálogo sincronizado e atualizado com sucesso!");
        }
    } catch (e) {
        console.error("Failed to fetch remote catalog:", e);
        if (forceFetch) {
            alert(`Falha ao sincronizar com o link informado:\n${e.message}\n\nO catálogo antigo continuará ativo.`);
        }
        // Fallback to local storage if present
        if (cachedData && forceFetch) {
            cdsData = JSON.parse(cachedData);
            rebuildCDSidebar();
        } else if (forceFetch) {
            cdListEl.innerHTML = '<div class="loading-placeholder" style="color:red">Falha ao carregar catálogo. Verifique sua conexão e ajustes.</div>';
        }
    }
}

// Rebuild CD cards list in left sidebar
function rebuildCDSidebar() {
    if (!cdsData || !cdsData.cds) {
        cdListEl.innerHTML = '<div class="loading-placeholder">Nenhum CD disponível.</div>';
        return;
    }
    
    cdListEl.innerHTML = "";
    
    cdsData.cds.forEach(cd => {
        const div = document.createElement("div");
        div.className = "cd-nav-item";
        if (cd.id === selectedCdId) {
            div.className += " active";
        }
        
        div.addEventListener("click", () => selectCD(cd.id));
        
        // Circular Cover Art thumbnail
        const thumbDiv = document.createElement("div");
        thumbDiv.className = "cd-nav-thumbnail";
        if (!cd.cover_url) {
            thumbDiv.className += " placeholder-art";
            const hole = document.createElement("div");
            hole.className = "center-hole";
            thumbDiv.appendChild(hole);
        } else {
            const img = document.createElement("img");
            img.src = cd.cover_url;
            img.alt = cd.title;
            // Handle loading error by falling back to placeholder
            img.onerror = () => {
                thumbDiv.innerHTML = '<div class="center-hole"></div>';
                thumbDiv.className += " placeholder-art";
            };
            thumbDiv.appendChild(img);
        }
        
        // Meta details
        const infoDiv = document.createElement("div");
        infoDiv.className = "cd-nav-info";
        
        const titleDiv = document.createElement("div");
        titleDiv.className = "cd-nav-title";
        titleDiv.textContent = cd.title;
        
        const descDiv = document.createElement("div");
        descDiv.className = "cd-nav-desc";
        descDiv.textContent = cd.description || `${cd.tracks.length} faixas`;
        
        infoDiv.appendChild(titleDiv);
        infoDiv.appendChild(descDiv);
        
        div.appendChild(thumbDiv);
        div.appendChild(infoDiv);
        cdListEl.appendChild(div);
    });
    
    // Auto-select first CD if nothing is selected yet
    if (!selectedCdId && cdsData.cds.length > 0) {
        selectCD(cdsData.cds[0].id);
    }
}

// Select CD and display tracks list in main content
async function selectCD(cdId) {
    selectedCdId = cdId;
    
    // Highlight active card in sidebar list
    const items = cdListEl.querySelectorAll(".cd-nav-item");
    const cds = cdsData.cds;
    const cdIdx = cds.findIndex(c => c.id === cdId);
    
    if (cdIdx === -1) return;
    const cd = cds[cdIdx];
    
    // Re-render sidebar highlights
    items.forEach((item, idx) => {
        if (cds[idx].id === cdId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
    
    // Switch views
    emptyStateSection.style.display = "none";
    cdDetailsSection.style.display = "block";
    
    // Render CD Header
    cdTitleEl.textContent = cd.title;
    cdDescriptionEl.textContent = cd.description || "Sem descrição disponível.";
    
    // Render large header cover image
    cdMainCoverEl.innerHTML = "";
    if (cd.cover_url) {
        const img = document.createElement("img");
        img.src = cd.cover_url;
        img.alt = cd.title;
        img.onerror = () => {
            cdMainCoverEl.innerHTML = '<div class="center-hole-large"></div>';
        };
        cdMainCoverEl.appendChild(img);
    } else {
        const hole = document.createElement("div");
        hole.className = "center-hole-large";
        cdMainCoverEl.appendChild(hole);
    }
    
    // Check local Cache Storage to dynamically show which tracks are downloaded
    renderCDTracksList(cd);
}

// Render tracks of a CD with local cache check badges
async function renderCDTracksList(cd) {
    trackListEl.innerHTML = "";
    
    const cache = await caches.open(AUDIO_CACHE_NAME);
    
    cd.tracks.forEach((track, index) => {
        const row = document.createElement("div");
        row.className = "track-row";
        if (playingCdId === cd.id && playingTrackIndex === index) {
            row.classList.add("playing");
        }
        
        // Col 1: Number & Play Icon
        const numCol = document.createElement("div");
        numCol.className = "track-num-col";
        
        const btnPlay = document.createElement("button");
        btnPlay.className = "btn-play-row";
        
        if (playingCdId === cd.id && playingTrackIndex === index && isPlaying) {
            btnPlay.textContent = "⏸";
        } else {
            btnPlay.textContent = `${String(track.track_number).padStart(2, '0')}`;
            // Show hover play arrow
            row.addEventListener("mouseenter", () => {
                if (!(playingCdId === cd.id && playingTrackIndex === index && isPlaying)) {
                    btnPlay.textContent = "▶";
                }
            });
            row.addEventListener("mouseleave", () => {
                if (!(playingCdId === cd.id && playingTrackIndex === index && isPlaying)) {
                    btnPlay.textContent = `${String(track.track_number).padStart(2, '0')}`;
                }
            });
        }
        
        btnPlay.addEventListener("click", (e) => {
            e.stopPropagation();
            if (playingCdId === cd.id && playingTrackIndex === index) {
                if (isPlaying) pauseTrack();
                else resumeTrack();
            } else {
                playingCdId = cd.id;
                playTrack(index);
            }
        });
        
        numCol.appendChild(btnPlay);
        
        // Col 2: Title
        const titleCol = document.createElement("div");
        titleCol.className = "track-title-col";
        const titleSpan = document.createElement("span");
        titleSpan.className = "track-row-title";
        titleSpan.textContent = track.title;
        titleCol.appendChild(titleSpan);
        
        // Col 3: Status Cloud Badge
        const statusCol = document.createElement("div");
        statusCol.className = "track-status-col";
        const badge = document.createElement("span");
        statusCol.appendChild(badge);
        
        // Col 4: Duration
        const durationCol = document.createElement("div");
        durationCol.className = "track-duration-col";
        durationCol.textContent = track.duration;
        
        row.appendChild(numCol);
        row.appendChild(titleCol);
        row.appendChild(statusCol);
        row.appendChild(durationCol);
        trackListEl.appendChild(row);
        
        // Check cache async to render badge
        cache.match(track.url).then(cachedResponse => {
            if (activeDownloads.has(track.url)) {
                badge.className = "status-badge downloading";
                badge.textContent = "⬇️ Baixando...";
            } else if (cachedResponse) {
                badge.className = "status-badge downloaded";
                badge.textContent = "✅ Local";
            } else {
                badge.className = "status-badge cloud";
                badge.textContent = "☁️ Nuvem";
            }
        });
        
        // Clicking row plays it
        row.addEventListener("click", () => {
            playingCdId = cd.id;
            playTrack(index);
        });
    });
}

// ========================================================
// AUDIO ENGINE (PLAYBACK CONTROLS)
// ========================================================

// Play selected track by index
async function playTrack(index) {
    const cd = cdsData.cds.find(c => c.id === playingCdId);
    if (!cd || index < 0 || index >= cd.tracks.length) return;
    
    playingTrackIndex = index;
    const track = cd.tracks[index];
    
    // Update player control bar text metadata
    playerTrackTitle.textContent = track.title;
    playerTrackAlbum.textContent = cd.title;
    
    // Update player mini cover
    playerMiniCover.innerHTML = "";
    if (cd.cover_url) {
        const img = document.createElement("img");
        img.src = cd.cover_url;
        img.alt = cd.title;
        img.onerror = () => {
            playerMiniCover.innerHTML = "";
        };
        playerMiniCover.appendChild(img);
    }
    
    // 1. Check if track is cached in Web Cache API
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cachedResponse = await cache.match(track.url);
    
    if (cachedResponse) {
        // Play from Cache Storage locally (Works offline!)
        const blob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        audioEl.src = objectUrl;
        console.log("Playing track from Cache Storage locally.");
    } else {
        // Stream directly from remote URL (Online)
        audioEl.src = track.url;
        console.log("Streaming track from remote GitHub Raw URL.");
    }
    
    audioEl.play().then(() => {
        isPlaying = true;
        btnPlayPause.textContent = "⏸";
        btnPlayPause.classList.add("playing");
        
        // Refresh details list rows highlights
        if (selectedCdId === playingCdId) {
            selectCD(selectedCdId);
        }
    }).catch(err => {
        console.error("Playback failed:", err);
        alert(`Erro de reprodução: não foi possível carregar o arquivo de áudio.\n\nDetalhes: ${err.message}`);
    });
}

// Resume paused track
function resumeTrack() {
    if (audioEl.src) {
        audioEl.play().then(() => {
            isPlaying = true;
            btnPlayPause.textContent = "⏸";
            
            if (selectedCdId === playingCdId) {
                selectCD(selectedCdId);
            }
        });
    }
}

// Pause playing track
function pauseTrack() {
    audioEl.pause();
    isPlaying = false;
    btnPlayPause.textContent = "▶";
    
    if (selectedCdId === playingCdId) {
        selectCD(selectedCdId);
    }
}

// Stop track playback
function stopTrack() {
    audioEl.pause();
    audioEl.currentTime = 0;
    isPlaying = false;
    btnPlayPause.textContent = "▶";
    
    if (selectedCdId === playingCdId) {
        selectCD(selectedCdId);
    }
}

// Next track navigation
function playNextTrack() {
    if (!playingCdId) return;
    const cd = cdsData.cds.find(c => c.id === playingCdId);
    if (!cd) return;
    
    let nextIndex = playingTrackIndex + 1;
    if (nextIndex >= cd.tracks.length) {
        nextIndex = 0; // loop back to first track
    }
    playTrack(nextIndex);
}

// Previous track navigation
function playPrevTrack() {
    if (!playingCdId) return;
    const cd = cdsData.cds.find(c => c.id === playingCdId);
    if (!cd) return;
    
    let prevIndex = playingTrackIndex - 1;
    if (prevIndex < 0) {
        prevIndex = cd.tracks.length - 1; // loop back to last track
    }
    playTrack(prevIndex);
}

// ========================================================
// OFFLINE CACHING & DOWNLOAD ENGINE
// ========================================================

// Download all tracks of selected CD in the background
async function downloadAllSelectedCDTracks() {
    const cd = cdsData.cds.find(c => c.id === selectedCdId);
    if (!cd) return;
    
    let triggeredCount = 0;
    btnDownloadAll.disabled = true;
    btnDownloadAll.textContent = "📥 Iniciando Downloads...";
    
    const cache = await caches.open(AUDIO_CACHE_NAME);
    
    // Sequential download loop to keep stream responsive and avoid browser throttling
    for (const track of cd.tracks) {
        const cached = await cache.match(track.url);
        if (!cached && !activeDownloads.has(track.url)) {
            triggeredCount++;
            activeDownloads.add(track.url);
            
            // Re-render immediately to show "downloading" progress badge
            renderCDTracksList(cd);
            
            try {
                await downloadFileToCache(track.url);
            } catch (err) {
                console.error(`Error downloading ${track.title}:`, err);
            } finally {
                activeDownloads.delete(track.url);
                renderCDTracksList(cd);
            }
        }
    }
    
    btnDownloadAll.disabled = false;
    btnDownloadAll.textContent = "📥 Baixar Todas as Faixas";
    updateCacheSizeDisplay();
    
    if (triggeredCount > 0) {
        alert(`Download de ${triggeredCount} faixas concluído! O CD já pode ser executado offline.`);
    } else {
        alert("Todas as faixas deste CD já estão salvas localmente!");
    }
}

// Chunk-by-chunk download engine utilizing ReadableStream to allow fetch cancel/progress
async function downloadFileToCache(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download: status ${response.status}`);
    }
    
    // Write fetched response body directly into Web Cache Storage
    const cache = await caches.open(AUDIO_CACHE_NAME);
    await cache.put(url, response.clone());
    return true;
}

// Delete cache of all tracks for selected CD
async function deleteSelectedCDCache() {
    const cd = cdsData.cds.find(c => c.id === selectedCdId);
    if (!cd) return;
    
    if (!confirm(`Deseja excluir permanentemente todos os arquivos baixados do '${cd.title}'?`)) {
        return;
    }
    
    if (playingCdId === selectedCdId) {
        stopTrack();
    }
    
    const cache = await caches.open(AUDIO_CACHE_NAME);
    let deletedCount = 0;
    
    for (const track of cd.tracks) {
        const success = await cache.delete(track.url);
        if (success) deletedCount++;
    }
    
    // Delete cover image from cache too if stored
    if (cd.cover_url) {
        await cache.delete(cd.cover_url);
    }
    
    selectCD(selectedCdId); // Re-render tracks list
    updateCacheSizeDisplay();
    alert(`Cache do CD '${cd.title}' limpo com sucesso (${deletedCount} arquivos excluídos).`);
}

// Wipe entire browser audio cache
async function clearEntireCache() {
    stopTrack();
    const success = await caches.delete(AUDIO_CACHE_NAME);
    if (success) {
        alert("Todo o cache local foi apagado com sucesso.");
        updateCacheSizeDisplay();
        if (selectedCdId) {
            selectCD(selectedCdId);
        }
    }
}

// Calculate total cache disk space used in MB and update settings UI label
async function updateCacheSizeDisplay() {
    try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const keys = await cache.keys();
        let totalBytes = 0;
        
        for (const request of keys) {
            const res = await cache.match(request);
            if (res) {
                const blob = await res.blob();
                totalBytes += blob.size;
            }
        }
        
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        cacheSpaceLabel.textContent = `Espaço em cache: ${totalMB} MB (${keys.length} arquivos)`;
    } catch (e) {
        cacheSpaceLabel.textContent = "Espaço em cache: 0.00 MB";
    }
}

// ========================================================
// WAV BINARY HEADER READER (JS SIDE DURATION CALCULATOR)
// ========================================================

// Lightweight binary parser to parse WAV headers and get exact duration
// Reads first 100 bytes of WAV file
function calculateWavDurationSeconds(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const slice = file.slice(0, 100);
        
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                const view = new DataView(buffer);
                
                // 1. Verify RIFF header matches "RIFF"
                const riffId = readStringFromBuffer(view, 0, 4);
                const format = readStringFromBuffer(view, 8, 4);
                
                if (riffId !== "RIFF" || format !== "WAVE") {
                    throw new Error("Formato de arquivo inválido. Não é um arquivo WAV.");
                }
                
                // 2. Read format chunk details
                // Find fmt chunk
                let fmtOffset = 12;
                while (fmtOffset < view.byteLength - 8) {
                    const chunkId = readStringFromBuffer(view, fmtOffset, 4);
                    if (chunkId === "fmt ") {
                        break;
                    }
                    // Move past chunk
                    const chunkSize = view.getUint32(fmtOffset + 4, true);
                    fmtOffset += 8 + chunkSize;
                }
                
                if (fmtOffset >= view.byteLength - 8) {
                    throw new Error("Não foi possível encontrar a sub-chunk 'fmt ' no cabeçalho.");
                }
                
                // Read sample rate and byte rate
                const sampleRate = view.getUint32(fmtOffset + 12, true);
                const byteRate = view.getUint32(fmtOffset + 16, true);
                
                // 3. Search for data subchunk size
                let dataOffset = fmtOffset + 8 + view.getUint32(fmtOffset + 4, true);
                let dataSize = 0;
                
                // Read up to file length or slice boundary to find "data" chunk
                const fileReaderFull = new FileReader();
                // Slice more headers just in case we need to search further (metadata LIST tags can push data chunk back)
                const extendedSlice = file.slice(0, 4096);
                
                fileReaderFull.onload = (event) => {
                    try {
                        const fullBuffer = event.target.result;
                        const fullView = new DataView(fullBuffer);
                        
                        let offset = 12;
                        let foundData = false;
                        while (offset < fullView.byteLength - 8) {
                            const chunkId = readStringFromBuffer(fullView, offset, 4);
                            const chunkSize = fullView.getUint32(offset + 4, true);
                            
                            if (chunkId === "data") {
                                dataSize = chunkSize;
                                foundData = true;
                                break;
                            }
                            
                            offset += 8 + chunkSize;
                        }
                        
                        if (!foundData) {
                            // Fallback approximation based on total file size minus standard header size
                            dataSize = file.size - 44;
                        }
                        
                        const durationSeconds = dataSize / byteRate;
                        resolve(durationSeconds);
                    } catch (err) {
                        reject(err);
                    }
                };
                
                fileReaderFull.onerror = () => reject(new Error("Erro ao ler dados do áudio."));
                fileReaderFull.readAsArrayBuffer(extendedSlice);
                
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = () => reject(new Error("Falha ao ler cabeçalho do arquivo WAV."));
        reader.readAsArrayBuffer(slice);
    });
}

function readStringFromBuffer(view, offset, length) {
    let str = "";
    for (let i = 0; i < length; i++) {
        str += String.fromCharCode(view.getUint8(offset + i));
    }
    return str;
}

// ========================================================
// GITHUB REST API UPLOADS & CD IMPORT PIPELINE
// ========================================================

// Orchestrator for importing CDs directly from browser
async function processCDImport() {
    const title = importTitle.value.trim();
    const desc = importDesc.value.trim();
    
    // Validations
    if (importedFilesList.length === 0) {
        alert("Por favor, selecione uma pasta local contendo arquivos WAV.");
        return;
    }
    if (!title) {
        alert("Por favor, insira um título para o CD.");
        return;
    }
    
    // Generate clean ID from title (safe for directories: alphanumeric only)
    const cleanId = title.toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
        
    if (!cleanId) {
        alert("O título digitado é inválido. Por favor utilize caracteres alfanuméricos.");
        return;
    }
    
    // Confirm and close select modal
    hideModal(modalImport);
    showModal(modalProgress);
    
    try {
        updateProgress("Importando CD...", "Preparando arquivos e calculando durações...", 5);
        
        // 1. Calculate WAV durations locally in parallel
        const trackDataList = [];
        let completedDurations = 0;
        
        for (let i = 0; i < importedFilesList.length; i++) {
            const file = importedFilesList[i];
            updateProgress(
                "Processando áudios...", 
                `Calculando duração de: ${file.name} (${i+1}/${importedFilesList.length})`, 
                5 + Math.floor((i / importedFilesList.length) * 15)
            );
            
            let durationStr = "00:00";
            try {
                const durationSeconds = await calculateWavDurationSeconds(file);
                const mins = Math.floor(durationSeconds / 60);
                const secs = Math.floor(durationSeconds % 60);
                durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            } catch (durErr) {
                console.warn(`Could not parse duration for ${file.name}, using fallback 00:00:`, durErr);
            }
            
            trackDataList.push({
                file: file,
                title: cleanName(file.name),
                duration: durationStr
            });
        }
        
        // Sort tracks alphabetically by filename to keep original album sequence order
        trackDataList.sort((a, b) => a.file.name.localeCompare(b.file.name));
        
        // 2. Upload cover art if selected
        let coverFilename = "";
        let coverUrl = "";
        
        if (importedCoverFile) {
            updateProgress("Fazendo upload da capa...", `Enviando imagem de capa (${importedCoverFile.name})...`, 25);
            const ext = importedCoverFile.name.substring(importedCoverFile.name.lastIndexOf('.'));
            coverFilename = `cover${ext}`;
            const coverPath = `Cds/${cleanId}/${coverFilename}`;
            
            const coverBase64 = await readFileAsBase64(importedCoverFile);
            await uploadFileToGitHub(coverPath, coverBase64, `Upload cover image for CD ${title}`);
            
            coverUrl = `https://raw.githubusercontent.com/${settings.githubUser}/${settings.githubRepo}/${settings.githubBranch}/Cds/${cleanId}/${coverFilename}`;
        }
        
        // 3. Upload WAV audio files one by one to GitHub Contents API
        const uploadedTracksMetadata = [];
        for (let idx = 0; idx < trackDataList.length; idx++) {
            const track = trackDataList[idx];
            const pct = 30 + Math.floor((idx / trackDataList.length) * 50);
            updateProgress(
                "Enviando áudios...", 
                `Enviando ${track.file.name} (${idx+1}/${trackDataList.length}) para o GitHub...`, 
                pct
            );
            
            const filePath = `Cds/${cleanId}/${track.file.name}`;
            const audioBase64 = await readFileAsBase64(track.file);
            await uploadFileToGitHub(filePath, audioBase64, `Upload track ${track.title} for CD ${title}`);
            
            const rawUrl = `https://raw.githubusercontent.com/${settings.githubUser}/${settings.githubRepo}/${settings.githubBranch}/Cds/${cleanId}/${encodeURIComponent(track.file.name)}`;
            
            uploadedTracksMetadata.push({
                track_number: idx + 1,
                title: track.title,
                url: rawUrl,
                duration: track.duration
            });
        }
        
        // 4. Update Remote meus_cds.json catalogue database
        updateProgress("Atualizando catálogo...", "Fazendo o commit da configuração atualizada no GitHub...", 85);
        
        // Get remote JSON from git first to merge edits
        let remoteCatalog = { cds: [] };
        let sha = null;
        
        try {
            const jsonGetRes = await fetch(`https://api.github.com/repos/${settings.githubUser}/${settings.githubRepo}/contents/meus_cds.json`, {
                headers: {
                    "Authorization": `token ${settings.githubToken}`,
                    "Accept": "application/vnd.github.v3+json"
                }
            });
            
            if (jsonGetRes.ok) {
                const getJson = await jsonGetRes.json();
                sha = getJson.sha;
                const decodedText = decodeURIComponent(escape(atob(getJson.content)));
                remoteCatalog = JSON.parse(decodedText);
            }
        } catch (getErr) {
            console.warn("Could not find remote meus_cds.json, creating a new one...", getErr);
        }
        
        // Check if CD already exists and edit, else add new
        if (!remoteCatalog.cds) remoteCatalog.cds = [];
        const existingCdIdx = remoteCatalog.cds.findIndex(c => c.id === cleanId);
        
        const newCdMetadata = {
            id: cleanId,
            title: title,
            description: desc || `Exercícios e faixas de áudio do CD ${title}.`,
            cover_url: coverUrl || (existingCdIdx !== -1 ? remoteCatalog.cds[existingCdIdx].cover_url : ""),
            tracks: uploadedTracksMetadata
        };
        
        if (existingCdIdx !== -1) {
            remoteCatalog.cds[existingCdIdx] = newCdMetadata;
        } else {
            remoteCatalog.cds.push(newCdMetadata);
        }
        
        // Update App version inside the updated JSON
        remoteCatalog.app_version = "1.3";
        remoteCatalog.app_url = `https://github.com/${settings.githubUser}/${settings.githubRepo}/raw/${settings.githubBranch}/FonoPlayer.exe`;
        
        // Save modified file back to GitHub
        const updatedJsonText = JSON.stringify(remoteCatalog, null, 4);
        // UTF-8 safe base64 encoder
        const updatedJsonBase64 = btoa(unescape(encodeURIComponent(updatedJsonText)));
        await uploadFileToGitHub("meus_cds.json", updatedJsonBase64, `Add/Update CD: ${title} via FonoPlayer Web`, sha);
        
        updateProgress("Concluído!", "CD importado e publicado com sucesso no seu GitHub!", 100);
        
        // Save locally and rebuild list instantly
        cdsData = remoteCatalog;
        localStorage.setItem("fonoplayer_catalog_data", JSON.stringify(remoteCatalog));
        
        setTimeout(() => {
            hideModal(modalProgress);
            rebuildCDSidebar();
            selectCD(cleanId);
            alert("Sucesso! CD importado e publicado no GitHub com sucesso!");
        }, 1200);
        
    } catch (err) {
        console.error("Import error:", err);
        hideModal(modalProgress);
        alert(`Falha ao importar o CD:\n${err.message}`);
    }
}

// Upload a single file base64 chunk directly to GitHub REST Contents API
async function uploadFileToGitHub(path, base64Content, commitMessage, sha = null) {
    const url = `https://api.github.com/repos/${settings.githubUser}/${settings.githubRepo}/contents/${path}`;
    
    // Check if file already exists if we don't have SHA yet
    if (!sha) {
        try {
            const checkRes = await fetch(url, {
                headers: {
                    "Authorization": `token ${settings.githubToken}`,
                    "Accept": "application/vnd.github.v3+json"
                }
            });
            if (checkRes.ok) {
                const data = await checkRes.json();
                sha = data.sha;
            }
        } catch (e) {
            // Not found is fine, means file is new
        }
    }
    
    const body = {
        message: commitMessage,
        content: base64Content,
        branch: settings.branch
    };
    if (sha) {
        body.sha = sha;
    }
    
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `token ${settings.githubToken}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro API GitHub ao enviar ${path}: ${errorData.message || response.statusText}`);
    }
    
    return true;
}

// Convert browser File object to Base64 asynchronously
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Strip data:audio/wav;base64, prefixes
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Update the progress overlay modal labels
function updateProgress(title, logMsg, pct) {
    progressTitle.textContent = title;
    progressLog.textContent = logMsg;
    progressBar.style.width = pct + "%";
    progressPercent.textContent = pct + "%";
}

// ========================================================
// UTILITIES AND FORMATTING HELPERS
// ========================================================

// Cleans filenames into human-readable track titles
function cleanName(name) {
    const base = name.substring(0, name.lastIndexOf('.')) || name;
    // Replace underscores, dashes and multiple spaces
    const clean = base.replace(/_/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
    // Title Case format
    return clean.split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

// Formats durations into MM:SS format
function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
