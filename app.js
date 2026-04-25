const DRAFT_STORAGE_KEY = "funpic-draft";
const LEGACY_STORAGE_KEY = "funpic-project";
const RIGHTBAR_WIDTH_STORAGE_KEY = "funpic-rightbar-width";
const RIGHTBAR_COLLAPSED_STORAGE_KEY = "funpic-rightbar-collapsed";
const CANVAS_ZOOM_STORAGE_KEY = "funpic-canvas-zoom";
const DB_NAME = "funpic-db";
const DB_VERSION = 1;
const PROJECT_STORE = "projects";

const templates = [
  {
    id: "single",
    name: "Single",
    slots: [{ x: 0, y: 0, width: 1, height: 1 }],
    preview: { columns: "1fr", rows: "1fr", cells: 1 },
  },
  {
    id: "two-up",
    name: "2 x 1",
    slots: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
    preview: { columns: "1fr 1fr", rows: "1fr", cells: 2 },
  },
  {
    id: "triple",
    name: "3 x 1",
    slots: [
      { x: 0, y: 0, width: 1 / 3, height: 1 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 1 },
    ],
    preview: { columns: "1fr 1fr 1fr", rows: "1fr", cells: 3 },
  },
  {
    id: "grid",
    name: "2 x 2",
    slots: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
    preview: { columns: "1fr 1fr", rows: "1fr 1fr", cells: 4 },
  },
];

const stickerCatalog = ["✨", "❤️", "🎉", "🌈", "🔥", "🌸", "⭐", "🦋", "🍓", "🎀"];
const fontChoices = ["Trebuchet MS", "Georgia", "Courier New", "Verdana", "Times New Roman"];
const TRANSPARENT_TEXT_BG = "transparent";
const filterPresets = [
  { id: "normal", name: "Normal", values: { brightness: 100, contrast: 100, saturate: 100, blur: 0 } },
  { id: "vintage", name: "Vintage", values: { brightness: 108, contrast: 92, saturate: 82, blur: 0.4 } },
  { id: "cool", name: "Cool", values: { brightness: 102, contrast: 108, saturate: 92, blur: 0 } },
  { id: "warm", name: "Warm", values: { brightness: 106, contrast: 104, saturate: 118, blur: 0 } },
  { id: "gray", name: "Grayscale", values: { brightness: 100, contrast: 104, saturate: 0, blur: 0 } },
];

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatProjectDate(timestamp) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function createTextLayer(overrides = {}) {
  return {
    id: uid("text"),
    text: "Tulis di sini",
    x: 0.5,
    y: 0.9,
    size: 34,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    color: "#ffffff",
    bgColor: TRANSPARENT_TEXT_BG,
    bgRadius: 999,
    fontFamily: fontChoices[0],
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    border: {
      enabled: true,
      size: 2,
      color: "#ff6b4a",
      style: "solid",
    },
    ...overrides,
  };
}

function templateSlotsFor(templateId) {
  const template = templates.find((item) => item.id === templateId) || templates[0];
  return template.slots.map((slot, index) => ({
    id: uid(`slot-${index}`),
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
  }));
}

function templateSlotsForCount(count) {
  const safeCount = clamp(count, 1, 8);
  if (safeCount === 1) return templateSlotsFor("single");
  if (safeCount === 2) return templateSlotsFor("two-up");
  if (safeCount === 3) return templateSlotsFor("triple");
  if (safeCount === 4) return templateSlotsFor("grid");
  const columns = Math.ceil(Math.sqrt(safeCount));
  const rows = Math.ceil(safeCount / columns);
  return Array.from({ length: safeCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: uid(`slot-${index}`),
      x: column / columns,
      y: row / rows,
      width: 1 / columns,
      height: 1 / rows,
    };
  });
}

function createDefaultState() {
  return {
    projectId: null,
    projectName: "",
    templateId: "grid",
    templateSlots: templateSlotsFor("grid"),
    canvasWidth: 1080,
    canvasHeight: 1080,
    backgroundColor: "#ffffff",
    gap: 12,
    radius: 20,
    frameBorder: {
      enabled: true,
      size: 2,
      color: "#000000",
      style: "solid",
    },
    photos: [],
    slotAssignments: {},
    slotEdits: {},
    selectedSlotIndex: 0,
    selectedPhotoId: null,
    texts: [],
    selectedTextId: null,
    filter: {
      preset: "normal",
      brightness: 100,
      contrast: 100,
      saturate: 100,
      blur: 0,
    },
    stickers: [],
    selectedStickerId: null,
    activeSelectionType: "slot",
    drawingDataUrl: "",
    drawingLayer: null,
    drawingEnabled: false,
    brush: {
      color: "#ff6b4a",
      size: 6,
      eraser: false,
    },
  };
}

const state = createDefaultState();
const history = [];
const future = [];
let suppressHistory = false;
let deferredPrompt = null;
let cameraInput = null;
let autosaveTimer = null;
let savedProjectsCache = [];
let activeDrag = null;
const drawStates = new WeakMap();
let suppressSlotClickUntil = 0;
let pendingSlotAssignment = null;
let mobileView = "home";
let mobileTool = "pointer";
let exportPreset = "hd";
let activeDesktopTool = "pointer";
let activePanelTab = "props";
let rightbarWidth = clamp(Number(localStorage.getItem(RIGHTBAR_WIDTH_STORAGE_KEY)) || 340, 260, 560);
let rightbarCollapsed = localStorage.getItem(RIGHTBAR_COLLAPSED_STORAGE_KEY) === "1";
let activeRightbarResize = null;
let canvasViewportZoom = clamp(Number(localStorage.getItem(CANVAS_ZOOM_STORAGE_KEY)) || 1, 0.4, 2.5);

function initViewFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedMobileView = params.get("mobile");
  const requestedTool = params.get("tool");
  const requestedPanel = params.get("panel");
  const requestedPreset = params.get("export");

  if (requestedMobileView && ["home", "editor", "share"].includes(requestedMobileView)) {
    mobileView = requestedMobileView;
  }
  if (requestedTool && ["pointer", "frame", "sticker", "text", "filter", "draw", "layer"].includes(requestedTool)) {
    mobileTool = requestedTool;
  }
  if (requestedPanel && ["props", "layer", "filter"].includes(requestedPanel)) {
    activePanelTab = requestedPanel;
  }
  if (requestedPreset && ["hd", "standard", "web"].includes(requestedPreset)) {
    exportPreset = requestedPreset;
  }
}

const photoInput = document.querySelector("#photoInput");
const cameraButton = document.querySelector("#cameraButton");
const clearProjectButton = document.querySelector("#clearProjectButton");
const templateList = document.querySelector("#templateList");
const photoLibrary = document.querySelector("#photoLibrary");
const photoCount = document.querySelector("#photoCount");
const stickerList = document.querySelector("#stickerList");
const savedProjectsList = document.querySelector("#savedProjectsList");
const refreshProjectsButton = document.querySelector("#refreshProjectsButton");
const editorStage = document.querySelector("#editorStage");
const drawingCanvas = document.querySelector("#drawingCanvas");
const mobileDrawingCanvas = document.querySelector("#mobileDrawingCanvas");
const selectionActions = document.querySelector("#selectionActions");
const selectionCancelButton = document.querySelector("#selectionCancelButton");
const selectionDeleteButton = document.querySelector("#selectionDeleteButton");
const mobileSelectionActions = document.querySelector("#mobileSelectionActions");
const mobileSelectionCancelButton = document.querySelector("#mobileSelectionCancelButton");
const mobileSelectionDeleteButton = document.querySelector("#mobileSelectionDeleteButton");
const installAppButton = document.querySelector("#installAppButton");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const canvasZoomOutButton = document.querySelector("#canvasZoomOutButton");
const canvasZoomResetButton = document.querySelector("#canvasZoomResetButton");
const canvasZoomInButton = document.querySelector("#canvasZoomInButton");
const saveButton = document.querySelector("#saveButton");
const imageFormatInput = document.querySelector("#imageFormatInput");
const saveImageButton = document.querySelector("#saveImageButton");
const saveAsButton = document.querySelector("#saveAsButton");
const renameProjectButton = document.querySelector("#renameProjectButton");
const exportPngButton = document.querySelector("#exportPngButton");
const shareButton = document.querySelector("#shareButton");
const loadProjectButton = document.querySelector("#loadProjectButton");
const importProjectButton = document.querySelector("#importProjectButton");
const projectImportInput = document.querySelector("#projectImportInput");
const downloadProjectButton = document.querySelector("#downloadProjectButton");
const brightnessInput = document.querySelector("#brightnessInput");
const contrastInput = document.querySelector("#contrastInput");
const saturateInput = document.querySelector("#saturateInput");
const blurInput = document.querySelector("#blurInput");
const resetFilterButton = document.querySelector("#resetFilterButton");
const filterPresetList = document.querySelector("#filterPresetList");
const backgroundColorInput = document.querySelector("#backgroundColorInput");
const gapInput = document.querySelector("#gapInput");
const radiusInput = document.querySelector("#radiusInput");
const frameBorderEnabledInput = document.querySelector("#frameBorderEnabledInput");
const frameBorderColorInput = document.querySelector("#frameBorderColorInput");
const frameBorderSizeInput = document.querySelector("#frameBorderSizeInput");
const frameBorderStyleInput = document.querySelector("#frameBorderStyleInput");
const canvasWidthInput = document.querySelector("#canvasWidthInput");
const canvasHeightInput = document.querySelector("#canvasHeightInput");
const canvasRatioInput = document.querySelector("#canvasRatioInput");
const slotWidthInput = document.querySelector("#slotWidthInput");
const slotHeightInput = document.querySelector("#slotHeightInput");
const drawToggle = document.querySelector("#drawToggle");
const brushColorInput = document.querySelector("#brushColorInput");
const brushSizeInput = document.querySelector("#brushSizeInput");
const eraserToggle = document.querySelector("#eraserToggle");
const clearDrawingButton = document.querySelector("#clearDrawingButton");
const slotZoomInput = document.querySelector("#slotZoomInput");
const slotOffsetXInput = document.querySelector("#slotOffsetXInput");
const slotOffsetYInput = document.querySelector("#slotOffsetYInput");
const resetSlotButton = document.querySelector("#resetSlotButton");
const addTextLayerButton = document.querySelector("#addTextLayerButton");
const textLayerList = document.querySelector("#textLayerList");
const deleteTextLayerButton = document.querySelector("#deleteTextLayerButton");
const textLayerInput = document.querySelector("#textLayerInput");
const textSizeInput = document.querySelector("#textSizeInput");
const textColorInput = document.querySelector("#textColorInput");
const textFontInput = document.querySelector("#textFontInput");
const textRotationInput = document.querySelector("#textRotationInput");
const textNormalButton = document.querySelector("#textNormalButton");
const textBoldInput = document.querySelector("#textBoldInput");
const textItalicInput = document.querySelector("#textItalicInput");
const textUnderlineInput = document.querySelector("#textUnderlineInput");
const textBorderEnabledInput = document.querySelector("#textBorderEnabledInput");
const textBorderColorInput = document.querySelector("#textBorderColorInput");
const textBorderSizeInput = document.querySelector("#textBorderSizeInput");
const textBorderStyleInput = document.querySelector("#textBorderStyleInput");
const textBgColorInput = document.querySelector("#textBgColorInput");
const textBgColorValue = document.querySelector("#textBgColorValue");
const textBgTransparentInput = document.querySelector("#textBgTransparentInput");
const textBgRoundedInput = document.querySelector("#textBgRoundedInput");
const textBgRadiusInput = document.querySelector("#textBgRadiusInput");
const textPosXInput = document.querySelector("#textPosXInput");
const textPosYInput = document.querySelector("#textPosYInput");
const stickerSizeInput = document.querySelector("#stickerSizeInput");
const stickerRotationInput = document.querySelector("#stickerRotationInput");
const deleteStickerButton = document.querySelector("#deleteStickerButton");
const mobileUploadCard = document.querySelector("#mobileUploadCard");
const mobileCameraButton = document.querySelector("#mobileCameraButton");
const mobileClearProjectButton = document.querySelector("#mobileClearProjectButton");
const mobileTemplateList = document.querySelector("#mobileTemplateList");
const mobilePhotoLibrary = document.querySelector("#mobilePhotoLibrary");
const mobilePhotoCount = document.querySelector("#mobilePhotoCount");
const mobileStickerList = document.querySelector("#mobileStickerList");
const mobileSavedProjectsList = document.querySelector("#mobileSavedProjectsList");
const mobileRefreshProjectsButton = document.querySelector("#mobileRefreshProjectsButton");
const mobileEditorPreview = document.querySelector("#mobileEditorPreview");
const mobileSharePreview = document.querySelector("#mobileSharePreview");
const mobileSavePlatformButton = document.querySelector("#mobileSavePlatformButton");
const mobileSaveGalleryButton = document.querySelector("#mobileSaveGalleryButton");
const mobileStages = Array.from(document.querySelectorAll(".phone-stage"));
const mobileShells = document.querySelector(".mobile-shells");
const mobileNavButtons = Array.from(document.querySelectorAll("[data-mobile-view]"));
const mobileEditorBackButton = document.querySelector(".phone-stage--editor .back-btn");
const mobileShareBackButton = document.querySelector(".phone-stage--share .back-btn");
const mobileEditorUndoButton = document.querySelector(".phone-stage--editor .compact-btn--ghost");
const mobileEditorExportButton = document.querySelector(".phone-stage--editor .compact-btn--accent");
const mobileControls = document.querySelector("#mobileControls");
const mobileEditorTitle = document.querySelector(".phone-stage--editor .mobile-editor-title");
const desktopProjectName = document.querySelector(".desktop-project-name");
const mobileStatusButton = document.querySelector("#mobileStatusButton");
const mobileSettingsButton = document.querySelector("#mobileSettingsButton");
const mobileQualityToggleButton = document.querySelector("#mobileQualityToggleButton");
const mobileToolButtons = Array.from(document.querySelectorAll("[data-mobile-tool]"));
const exportPresetButtons = Array.from(document.querySelectorAll("[data-export-preset]"));
const shareTargetButtons = Array.from(document.querySelectorAll("[data-share-target]"));
const desktopToolButtons = Array.from(document.querySelectorAll("[data-desktop-tool]"));
const desktopTabButtons = Array.from(document.querySelectorAll("[data-panel-tab]"));
const desktopBody = document.querySelector(".desktop-body");
const desktopCanvasZone = document.querySelector(".desktop-canvas-zone");
const desktopRightPanel = document.querySelector(".desktop-right-panel");
const rightbarResizeHandle = document.querySelector("#rightbarResizeHandle");
const rightbarToggleButton = document.querySelector("#rightbarToggleButton");
const sectionMedia = document.querySelector("#section-media");
const sectionText = document.querySelector("#section-text");
const sectionFilter = document.querySelector("#section-filter");
const sectionFrame = document.querySelector("#section-frame");
const sectionCrop = document.querySelector("#section-crop");
const sectionSticker = document.querySelector("#section-sticker");
const sectionDraw = document.querySelector("#section-draw");
const sectionProject = document.querySelector("#section-project");

function cloneState() {
  return clone(state);
}

function normalizeTextBgColor(value) {
  if (!value) return TRANSPARENT_TEXT_BG;
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === "transparent") return TRANSPARENT_TEXT_BG;
  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return trimmed;
  return TRANSPARENT_TEXT_BG;
}

function colorForInputValue(value) {
  const normalized = normalizeTextBgColor(value);
  if (normalized === TRANSPARENT_TEXT_BG) return "#000000";
  if (normalized.length === 9) return normalized.slice(0, 7) || "#000000";
  return normalized;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeFilename(value, fallback = "my-image-editor") {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || fallback;
}

function applyRightbarLayout({ render = false } = {}) {
  if (!desktopBody) return;
  desktopBody.style.setProperty("--rightbar-width", `${rightbarWidth}px`);
  desktopBody.classList.toggle("is-rightbar-collapsed", rightbarCollapsed);
  if (rightbarToggleButton) {
    rightbarToggleButton.textContent = rightbarCollapsed ? "Panel Buka" : "Panel Tutup";
    rightbarToggleButton.setAttribute("aria-pressed", rightbarCollapsed ? "true" : "false");
  }
  localStorage.setItem(RIGHTBAR_WIDTH_STORAGE_KEY, String(rightbarWidth));
  localStorage.setItem(RIGHTBAR_COLLAPSED_STORAGE_KEY, rightbarCollapsed ? "1" : "0");
  if (render) requestAnimationFrame(renderEditorSurfaceOnly);
}

function applyCanvasViewportZoom(nextZoom, { render = true } = {}) {
  canvasViewportZoom = clamp(nextZoom, 0.4, 2.5);
  localStorage.setItem(CANVAS_ZOOM_STORAGE_KEY, String(canvasViewportZoom));
  const label = `${Math.round(canvasViewportZoom * 100)}%`;
  if (canvasZoomResetButton) canvasZoomResetButton.textContent = label;
  if (canvasZoomOutButton) canvasZoomOutButton.disabled = canvasViewportZoom <= 0.41;
  if (canvasZoomInButton) canvasZoomInButton.disabled = canvasViewportZoom >= 2.49;
  if (render) requestAnimationFrame(renderEditorSurfaceOnly);
}

function normalizeSnapshot(snapshot) {
  const defaults = createDefaultState();
  const normalized = {
    ...defaults,
    ...snapshot,
    filter: { ...defaults.filter, ...(snapshot.filter || {}) },
    brush: { ...defaults.brush, ...(snapshot.brush || {}) },
    frameBorder: { ...defaults.frameBorder, ...(snapshot.frameBorder || {}) },
    photos: Array.isArray(snapshot.photos) ? snapshot.photos : [],
    stickers: Array.isArray(snapshot.stickers)
      ? snapshot.stickers.map((sticker) => ({ scaleX: 1, scaleY: 1, rotation: 0, size: 48, ...sticker }))
      : [],
    slotAssignments: snapshot.slotAssignments || {},
    slotEdits: snapshot.slotEdits || {},
    drawingLayer: snapshot.drawingLayer || (snapshot.drawingDataUrl ? {
      id: "drawing-layer",
      dataUrl: snapshot.drawingDataUrl,
      x: 0.5,
      y: 0.5,
      width: 1,
      height: 1,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    } : null),
    templateSlots:
      Array.isArray(snapshot.templateSlots) && snapshot.templateSlots.length
        ? snapshot.templateSlots
        : templateSlotsFor(snapshot.templateId || defaults.templateId),
    texts:
      Array.isArray(snapshot.texts)
        ? snapshot.texts.map((text) => ({ ...createTextLayer(), ...text, bgColor: normalizeTextBgColor(text.bgColor) }))
        : (snapshot.caption?.text ? [createTextLayer({ text: snapshot.caption.text })] : []),
  };

  if (
    normalized.texts.length === 1
    && normalized.texts[0].text === "Liburan Seru"
    && !normalized.photos.length
    && !normalized.stickers.length
  ) {
    normalized.texts = [];
  }

  normalized.selectedTextId = normalized.texts.some((item) => item.id === normalized.selectedTextId)
    ? normalized.selectedTextId
    : normalized.texts[0]?.id || null;
  normalized.selectedStickerId = normalized.stickers.some((item) => item.id === normalized.selectedStickerId)
    ? normalized.selectedStickerId
    : normalized.stickers[0]?.id || null;
  normalized.selectedSlotIndex = Math.min(
    normalized.templateSlots.length - 1,
    Math.max(0, normalized.selectedSlotIndex || 0),
  );
  normalized.activeSelectionType = normalized.activeSelectionType || "slot";
  return normalized;
}

function applySnapshot(snapshot) {
  suppressHistory = true;
  Object.assign(state, normalizeSnapshot(snapshot));
  suppressHistory = false;
  syncInputs();
  renderAll();
}

function pushHistory() {
  if (suppressHistory) return;
  history.push(cloneState());
  if (history.length > 60) history.shift();
  future.length = 0;
  updateHistoryButtons();
}

function setState(mutator, options = {}) {
  const shouldTrack = options.trackHistory !== false;
  mutator(state);
  if (shouldTrack) pushHistory();
  const renderMode = options.renderMode || (shouldTrack ? "all" : "editor");
  if (renderMode === "none") return;
  if (renderMode === "all") {
    renderAll();
    return;
  }
  if (renderMode === "editor") {
    renderEditorSurfaceOnly();
    return;
  }
  if (renderMode === "surfaces") {
    renderEditorSurfacesOnly();
  }
}

function getCurrentText() {
  return state.texts.find((text) => text.id === state.selectedTextId) || state.texts[0] || null;
}

function getCurrentSticker() {
  return state.stickers.find((sticker) => sticker.id === state.selectedStickerId) || null;
}

function getCurrentSlot() {
  return state.templateSlots[state.selectedSlotIndex] || null;
}

function getSlotEdit(slotIndex, source = state) {
  return { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1, ...(source.slotEdits[slotIndex] || {}) };
}

function getPhotoById(photoId) {
  return state.photos.find((photo) => photo.id === photoId) || null;
}

function textTransform(text) {
  return `translate(-50%, -50%) rotate(${text.rotation || 0}deg) scale(${text.scaleX || 1}, ${text.scaleY || 1})`;
}

function stickerTransform(sticker) {
  return `translate(-50%, -50%) rotate(${sticker.rotation || 0}deg) scale(${sticker.scaleX || 1}, ${sticker.scaleY || 1})`;
}

function slotImageTransform(slotEdit) {
  return `translate(${slotEdit.offsetX * 100}%, ${slotEdit.offsetY * 100}%) scale(${(slotEdit.zoom || 1) * (slotEdit.scaleX || 1)}, ${(slotEdit.zoom || 1) * (slotEdit.scaleY || 1)}) rotate(${slotEdit.rotation || 0}deg)`;
}

function drawingTransform(layer) {
  return `translate(-50%, -50%) rotate(${layer.rotation || 0}deg) scale(${layer.scaleX || 1}, ${layer.scaleY || 1})`;
}

function getActiveSelection() {
  if (state.activeSelectionType === "text" && getCurrentText()) return { type: "text" };
  if (state.activeSelectionType === "sticker" && getCurrentSticker()) return { type: "sticker" };
  if (state.activeSelectionType === "slot" && getCurrentSlot() && state.slotAssignments[state.selectedSlotIndex]) return { type: "slot" };
  if (state.activeSelectionType === "drawing" && state.drawingLayer?.dataUrl) return { type: "drawing" };
  return null;
}

function getDeleteLabel() {
  const selection = getActiveSelection();
  if (!selection) return "Hapus";
  if (selection.type === "slot") return "Hapus Foto";
  if (selection.type === "text") return "Hapus Teks";
  if (selection.type === "sticker") return "Hapus Stiker";
  if (selection.type === "drawing") return "Hapus Coretan";
  return "Hapus";
}

function syncDeleteLabels() {
  const label = getDeleteLabel();
  if (selectionDeleteButton) selectionDeleteButton.title = label;
  if (mobileSelectionDeleteButton) mobileSelectionDeleteButton.title = label;
  if (selectionDeleteButton) selectionDeleteButton.setAttribute("aria-label", label);
  if (mobileSelectionDeleteButton) mobileSelectionDeleteButton.setAttribute("aria-label", label);
  if (deleteTextLayerButton) {
    deleteTextLayerButton.textContent = "🗑";
    deleteTextLayerButton.title = state.activeSelectionType === "sticker" ? "Hapus stiker aktif" : "Hapus teks aktif";
    deleteTextLayerButton.setAttribute("aria-label", deleteTextLayerButton.title);
  }
  if (deleteStickerButton) {
    deleteStickerButton.textContent = "🗑";
    deleteStickerButton.title = "Hapus stiker aktif";
    deleteStickerButton.setAttribute("aria-label", "Hapus stiker aktif");
  }
}

function updateHistoryButtons() {
  if (undoButton) undoButton.disabled = history.length <= 1;
  if (redoButton) redoButton.disabled = future.length === 0;
}

function openProjectsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const store = db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, handler) {
  const db = await openProjectsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, mode);
    const store = tx.objectStore(PROJECT_STORE);
    const result = handler(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function saveProjectRecord(record) {
  return withStore("readwrite", (store) => {
    store.put(record);
  });
}

async function getProjectRecord(projectId) {
  const db = await openProjectsDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).get(projectId);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function listProjectRecords() {
  const db = await openProjectsDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).getAll();
    request.onsuccess = () => {
      db.close();
      const records = request.result || [];
      records.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(records);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function deleteProjectRecord(projectId) {
  return withStore("readwrite", (store) => {
    store.delete(projectId);
  });
}

function syncColorPreview() {
  textBgColorInput.parentElement.style.background = normalizeTextBgColor(textBgColorValue.value) === TRANSPARENT_TEXT_BG
    ? "linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,107,74,.18))"
    : textBgColorValue.value;
}

function syncInputs() {
  const currentText = getCurrentText();
  const currentSticker = getCurrentSticker();
  const currentSlot = getCurrentSlot();
  const currentSlotEdit = getSlotEdit(state.selectedSlotIndex);

  brightnessInput.value = String(state.filter.brightness);
  contrastInput.value = String(state.filter.contrast);
  saturateInput.value = String(state.filter.saturate);
  blurInput.value = String(state.filter.blur);
  backgroundColorInput.value = state.backgroundColor;
  gapInput.value = String(state.gap);
  radiusInput.value = String(state.radius);
  frameBorderEnabledInput.checked = Boolean(state.frameBorder.enabled);
  frameBorderColorInput.value = state.frameBorder.color || "#000000";
  frameBorderSizeInput.value = String(state.frameBorder.size ?? 2);
  frameBorderStyleInput.value = state.frameBorder.style || "solid";
  canvasWidthInput.value = String(state.canvasWidth);
  canvasHeightInput.value = String(state.canvasHeight);
  canvasRatioInput.value = currentCanvasRatioKey();
  slotWidthInput.value = String(Math.round((currentSlot?.width || 0.5) * 100));
  slotHeightInput.value = String(Math.round((currentSlot?.height || 0.5) * 100));
  drawToggle.checked = state.drawingEnabled;
  brushColorInput.value = state.brush.color;
  brushSizeInput.value = String(state.brush.size);
  if (eraserToggle) eraserToggle.checked = Boolean(state.brush.eraser);

  slotZoomInput.value = String(Math.round(currentSlotEdit.zoom * 100));
  slotOffsetXInput.value = String(Math.round(currentSlotEdit.offsetX * 100));
  slotOffsetYInput.value = String(Math.round(currentSlotEdit.offsetY * 100));

  textLayerInput.value = currentText?.text || "";
  textSizeInput.value = String(currentText?.size || 34);
  textColorInput.value = currentText?.color || "#ffffff";
  textRotationInput.value = String(Math.round(currentText?.rotation || 0));
  textFontInput.value = currentText?.fontFamily || fontChoices[0];
  textBoldInput.checked = (currentText?.fontWeight || "normal") === "bold";
  textItalicInput.checked = (currentText?.fontStyle || "normal") === "italic";
  textUnderlineInput.checked = Boolean(currentText?.underline);
  textBorderEnabledInput.checked = Boolean(currentText?.border?.enabled);
  textBorderColorInput.value = currentText?.border?.color || "#ff6b4a";
  textBorderSizeInput.value = String(currentText?.border?.size ?? 2);
  textBorderStyleInput.value = currentText?.border?.style || "solid";
  textBgColorValue.value = currentText?.bgColor || TRANSPARENT_TEXT_BG;
  textBgColorInput.value = colorForInputValue(currentText?.bgColor || TRANSPARENT_TEXT_BG);
  textBgTransparentInput.checked = normalizeTextBgColor(currentText?.bgColor || TRANSPARENT_TEXT_BG) === TRANSPARENT_TEXT_BG;
  textBgRoundedInput.checked = (currentText?.bgRadius ?? 999) > 0;
  textBgRadiusInput.value = String(Math.min(80, currentText?.bgRadius ?? 80));
  textPosXInput.value = String(Math.round((currentText?.x ?? 0.5) * 100));
  textPosYInput.value = String(Math.round((currentText?.y ?? 0.9) * 100));
  textLayerInput.disabled = !currentText;
  textSizeInput.disabled = !currentText;
  textColorInput.disabled = !currentText;
  textRotationInput.disabled = !currentText;
  textFontInput.disabled = !currentText;
  textNormalButton.disabled = !currentText;
  textBoldInput.disabled = !currentText;
  textItalicInput.disabled = !currentText;
  textUnderlineInput.disabled = !currentText;
  textBorderEnabledInput.disabled = !currentText;
  textBorderColorInput.disabled = !currentText;
  textBorderSizeInput.disabled = !currentText;
  textBorderStyleInput.disabled = !currentText;
  textBgColorInput.disabled = !currentText;
  textBgColorValue.disabled = !currentText;
  textBgTransparentInput.disabled = !currentText;
  textBgRoundedInput.disabled = !currentText;
  textBgRadiusInput.disabled = !currentText || normalizeTextBgColor(currentText?.bgColor || TRANSPARENT_TEXT_BG) === TRANSPARENT_TEXT_BG;
  textPosXInput.disabled = !currentText;
  textPosYInput.disabled = !currentText;
  deleteTextLayerButton.disabled = !currentText;
  syncColorPreview();

  stickerSizeInput.value = String(currentSticker?.size || 48);
  stickerRotationInput.value = String(currentSticker?.rotation || 0);
  stickerSizeInput.disabled = !currentSticker;
  stickerRotationInput.disabled = !currentSticker;
  deleteStickerButton.disabled = !currentSticker;

  saveButton.textContent = state.projectName ? `Update Project: ${state.projectName}` : "Save Project";
  if (desktopProjectName) desktopProjectName.textContent = state.projectName ? `${state.projectName}.myimage` : "Kolase Liburan.myimage";
  if (mobileEditorTitle) mobileEditorTitle.textContent = state.projectName || "Kolase Liburan";
}

function createTemplateCard(template) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "template-card";
  if (template.id === state.templateId) button.classList.add("is-active");

  const grid = document.createElement("div");
  grid.className = "template-card__grid";
  grid.style.gridTemplateColumns = template.preview.columns;
  grid.style.gridTemplateRows = template.preview.rows;
  for (let index = 0; index < template.preview.cells; index += 1) {
    const cell = document.createElement("div");
    cell.className = "template-card__cell";
    grid.appendChild(cell);
  }
  const title = document.createElement("strong");
  title.textContent = template.name;
  const info = document.createElement("small");
  info.textContent = `${template.slots.length} slot`;
  button.append(grid, title, info);
  button.addEventListener("click", () => {
    setState((draft) => {
      draft.templateId = template.id;
      draft.templateSlots = templateSlotsFor(template.id);
      draft.selectedSlotIndex = 0;
      draft.activeSelectionType = "slot";
      const nextAssignments = {};
      Object.entries(draft.slotAssignments)
        .slice(0, draft.templateSlots.length)
        .forEach(([slotIndex, photoId]) => {
          nextAssignments[slotIndex] = photoId;
        });
      draft.slotAssignments = nextAssignments;
    });
  });
  return button;
}

function renderTemplates() {
  templateList.replaceChildren(...templates.map(createTemplateCard));
  if (mobileTemplateList) mobileTemplateList.replaceChildren(...templates.map(createTemplateCard));
}

function renderPhotoLibrary() {
  const renderEmpty = (container) => {
    if (!container) return;
    container.className = "photo-library empty-state";
    container.innerHTML = "<p>Belum ada foto. Upload dulu untuk mulai edit.</p>";
  };

  photoCount.textContent = `${state.photos.length} foto`;
  if (mobilePhotoCount) mobilePhotoCount.textContent = `${state.photos.length} foto`;

  if (!state.photos.length) {
    renderEmpty(photoLibrary);
    renderEmpty(mobilePhotoLibrary);
    return;
  }

  const createPhotoNode = (photo) => {
    const button = document.querySelector("#photoThumbTemplate").content.firstElementChild.cloneNode(true);
    const img = button.querySelector("img");
    img.src = photo.dataUrl;
    img.alt = photo.name;
    img.draggable = false;
    button.draggable = true;
    if (state.selectedPhotoId === photo.id) button.classList.add("is-selected");
    button.addEventListener("click", () => {
      if (pendingSlotAssignment && Date.now() <= pendingSlotAssignment.expiresAt) {
        const pending = pendingSlotAssignment;
        pendingSlotAssignment = null;
        applySlotPhoto(pending.slotIndex, photo.id);
        return;
      }
      pendingSlotAssignment = null;
      setState((draft) => {
        draft.selectedPhotoId = photo.id;
        draft.activeSelectionType = "photo";
      }, { trackHistory: false, renderMode: "all" });
    });
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/photo-id", photo.id);
      event.dataTransfer?.setData("text/source", "library");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "copyMove";
      }
      suppressSlotClickUntil = Date.now() + 180;
      setState((draft) => {
        draft.selectedPhotoId = photo.id;
      }, { trackHistory: false, renderMode: "editor" });
    });
    button.addEventListener("dragend", () => {
      suppressSlotClickUntil = Date.now() + 120;
    });
    return button;
  };

  const nodes = state.photos.map(createPhotoNode);
  photoLibrary.className = "photo-library";
  photoLibrary.replaceChildren(...nodes);
  if (mobilePhotoLibrary) {
    mobilePhotoLibrary.className = "photo-library";
    mobilePhotoLibrary.replaceChildren(...state.photos.map(createPhotoNode));
  }
}

function renderStickerCatalog() {
  const createStickerNode = (emoji) => {
    const button = document.querySelector("#stickerTemplate").content.firstElementChild.cloneNode(true);
    button.textContent = emoji;
    button.addEventListener("click", () => {
      addSticker(emoji);
    });
    return button;
  };

  stickerList.replaceChildren(...stickerCatalog.map(createStickerNode));
  if (mobileStickerList) mobileStickerList.replaceChildren(...stickerCatalog.map(createStickerNode));
}

function renderTextLayerList() {
  const imageLayerNodes = state.templateSlots
    .map((slot, index) => ({ slot, index, photo: getPhotoById(state.slotAssignments[index]) }))
    .filter((entry) => entry.photo)
    .map(({ index, photo }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-chip layer-chip--image";
      if (state.activeSelectionType === "slot" && state.selectedSlotIndex === index) button.classList.add("is-active");
      button.textContent = `Gambar Slot ${index + 1}: ${photo.name || "Foto"}`;
      button.addEventListener("click", () => {
        setState((draft) => {
          draft.selectedSlotIndex = index;
          draft.selectedPhotoId = draft.slotAssignments[index] || null;
          draft.activeSelectionType = "slot";
        }, { trackHistory: false, renderMode: "all" });
      });
      return button;
    });

  const drawingNode = state.drawingLayer?.dataUrl
    ? (() => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "layer-chip layer-chip--draw";
        if (state.activeSelectionType === "drawing") button.classList.add("is-active");
        button.textContent = "Coretan Pen";
        button.addEventListener("click", () => {
          setState((draft) => {
            draft.activeSelectionType = "drawing";
          }, { trackHistory: false, renderMode: "all" });
        });
        return button;
      })()
    : null;

  if (!state.texts.length && !state.stickers.length && !imageLayerNodes.length && !drawingNode) {
    textLayerList.innerHTML = "<p class='hint-text'>Belum ada layer.</p>";
    return;
  }
  const textNodes = state.texts.map((text, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "layer-chip";
    if (text.id === state.selectedTextId && state.activeSelectionType === "text") button.classList.add("is-active");
    button.textContent = `Text ${index + 1}: ${text.text.trim() || "Tanpa teks"}`;
    button.addEventListener("click", () => {
      setState((draft) => {
        draft.selectedTextId = text.id;
        draft.activeSelectionType = "text";
      }, { trackHistory: false, renderMode: "all" });
    });
    return button;
  });
  const stickerNodes = state.stickers.map((sticker, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "layer-chip";
    if (sticker.id === state.selectedStickerId && state.activeSelectionType === "sticker") button.classList.add("is-active");
    button.textContent = `Stiker ${index + 1}: ${sticker.emoji}`;
    button.addEventListener("click", () => {
      setState((draft) => {
        draft.selectedStickerId = sticker.id;
        draft.activeSelectionType = "sticker";
      }, { trackHistory: false, renderMode: "all" });
    });
    return button;
  });
  textLayerList.replaceChildren(...[drawingNode].filter(Boolean), ...stickerNodes, ...textNodes, ...imageLayerNodes);
}

function addTextLayer() {
  const value = window.prompt("Tulis text yang ingin ditambahkan:", "");
  if (value === null) return;
  const textValue = value.trim();
  if (!textValue) return;
  setState((draft) => {
    const text = createTextLayer({ text: textValue, y: clamp(0.2 + draft.texts.length * 0.12, 0.08, 0.92) });
    draft.texts.push(text);
    draft.selectedTextId = text.id;
    draft.activeSelectionType = "text";
  });
}

function addSticker(emoji) {
  setState((draft) => {
    const sticker = { id: uid("sticker"), emoji, x: 0.42, y: 0.42, size: 48, rotation: 0, scaleX: 1, scaleY: 1 };
    draft.stickers.push(sticker);
    draft.selectedStickerId = sticker.id;
    draft.activeSelectionType = "sticker";
  });
}

function renderSavedProjects() {
  const renderEmpty = (container) => {
    if (!container) return;
    container.innerHTML = "<p class='hint-text'>Belum ada project tersimpan.</p>";
  };

  if (!savedProjectsCache.length) {
    renderEmpty(savedProjectsList);
    renderEmpty(mobileSavedProjectsList);
    return;
  }

  const createProjectNode = (record) => {
    const article = document.querySelector("#savedProjectTemplate").content.firstElementChild.cloneNode(true);
    const loadButton = article.querySelector(".saved-project__load");
    const nameNode = article.querySelector(".saved-project__name");
    const timeNode = article.querySelector(".saved-project__time");
    const thumbNode = article.querySelector(".saved-project__thumb");
    const deleteButton = article.querySelector(".saved-project__delete");

    nameNode.textContent = record.name;
    timeNode.textContent = formatProjectDate(record.updatedAt);
    if (record.thumbnail) {
      thumbNode.src = record.thumbnail;
      thumbNode.classList.remove("hidden");
    }

    loadButton.addEventListener("click", async () => {
      const fullRecord = await getProjectRecord(record.id);
      if (!fullRecord?.data) return;
      applySnapshot(fullRecord.data);
      history.length = 0;
      history.push(cloneState());
      future.length = 0;
      updateHistoryButtons();
      window.alert(`Project "${record.name}" berhasil dimuat.`);
    });

    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Hapus project "${record.name}"?`)) return;
      await deleteProjectRecord(record.id);
      if (state.projectId === record.id) {
        state.projectId = null;
        state.projectName = "";
      }
      await refreshSavedProjects();
      renderAll();
    });
    return article;
  };

  savedProjectsList.replaceChildren(...savedProjectsCache.map(createProjectNode));
  if (mobileSavedProjectsList) {
    mobileSavedProjectsList.replaceChildren(...savedProjectsCache.map(createProjectNode));
  }
}

function isPresetActive(preset) {
  const values = preset.values;
  return (
    state.filter.brightness === values.brightness &&
    state.filter.contrast === values.contrast &&
    state.filter.saturate === values.saturate &&
    state.filter.blur === values.blur
  );
}

function renderFilterPresets() {
  const nodes = filterPresets.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-chip";
    if (isPresetActive(preset)) button.classList.add("is-active");
    button.textContent = preset.name;
    button.addEventListener("click", () => {
      setState((draft) => {
        draft.filter = { ...draft.filter, preset: preset.id, ...preset.values };
      });
    });
    return button;
  });
  filterPresetList.replaceChildren(...nodes);
}

function getFilterCss() {
  const { brightness, contrast, saturate, blur } = state.filter;
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) blur(${blur}px)`;
}

function applySelectionActionsVisibility() {
  selectionActions?.classList.add("hidden");
  mobileSelectionActions?.classList.add("hidden");
}

function refreshStageSelectionClasses(stageElement) {
  if (!stageElement) return;
  Array.from(stageElement.querySelectorAll(".slot.is-selected")).forEach((node) => node.classList.remove("is-selected"));
  Array.from(stageElement.querySelectorAll(".text-layer.is-active")).forEach((node) => node.classList.remove("is-active"));
  Array.from(stageElement.querySelectorAll(".sticker-instance.is-active")).forEach((node) => node.classList.remove("is-active"));

  if (state.activeSelectionType === "slot") {
    const selectedSlot = stageElement.querySelector(`.slot[data-slot-index="${state.selectedSlotIndex}"]`);
    selectedSlot?.classList.add("is-selected");
  }
  if (state.activeSelectionType === "text" && state.selectedTextId) {
    const selectedText = stageElement.querySelector(`.text-layer[data-text-id="${state.selectedTextId}"]`);
    selectedText?.classList.add("is-active");
  }
  if (state.activeSelectionType === "sticker" && state.selectedStickerId) {
    const selectedSticker = stageElement.querySelector(`.sticker-instance[data-sticker-id="${state.selectedStickerId}"]`);
    selectedSticker?.classList.add("is-active");
  }
  if (state.activeSelectionType === "drawing") {
    stageElement.querySelector(".drawing-preview")?.classList.add("is-active");
  }
}

function getSlotImageVisualRect(slotNode, slotIndex) {
  const imageNode = slotNode?.querySelector(".slot__image");
  if (!slotNode || !imageNode || imageNode.classList.contains("hidden")) return slotNode?.getBoundingClientRect();
  const slotRect = slotNode.getBoundingClientRect();
  const naturalWidth = imageNode.naturalWidth || 1;
  const naturalHeight = imageNode.naturalHeight || 1;
  const slotRatio = slotRect.width / Math.max(1, slotRect.height);
  const imageRatio = naturalWidth / Math.max(1, naturalHeight);
  const containedWidth = imageRatio > slotRatio ? slotRect.width : slotRect.height * imageRatio;
  const containedHeight = imageRatio > slotRatio ? slotRect.width / imageRatio : slotRect.height;
  const edit = getSlotEdit(slotIndex);
  const visualWidth = containedWidth * (edit.zoom || 1) * (edit.scaleX || 1);
  const visualHeight = containedHeight * (edit.zoom || 1) * (edit.scaleY || 1);
  const centerX = slotRect.left + slotRect.width / 2 + (edit.offsetX || 0) * slotRect.width;
  const centerY = slotRect.top + slotRect.height / 2 + (edit.offsetY || 0) * slotRect.height;
  const rotation = Math.abs(((edit.rotation || 0) * Math.PI) / 180);
  const rotatedWidth = Math.abs(visualWidth * Math.cos(rotation)) + Math.abs(visualHeight * Math.sin(rotation));
  const rotatedHeight = Math.abs(visualWidth * Math.sin(rotation)) + Math.abs(visualHeight * Math.cos(rotation));
  const visualLeft = centerX - rotatedWidth / 2;
  const visualTop = centerY - rotatedHeight / 2;
  const visualRight = centerX + rotatedWidth / 2;
  const visualBottom = centerY + rotatedHeight / 2;
  const left = Math.max(slotRect.left, visualLeft);
  const top = Math.max(slotRect.top, visualTop);
  const right = Math.min(slotRect.right, visualRight);
  const bottom = Math.min(slotRect.bottom, visualBottom);
  if (right <= left || bottom <= top) return slotRect;
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function createSelectionFrame(stageElement, targetNode, type, targetId) {
  if (!stageElement || !targetNode) return;
  const stageRect = stageElement.getBoundingClientRect();
  const rect = type === "slot" ? getSlotImageVisualRect(targetNode, targetId) : targetNode.getBoundingClientRect();
  if (!rect) return;
  const pad = 2;
  const frame = document.createElement("div");
  frame.className = "selection-frame";
  frame.style.left = `${rect.left - stageRect.left - pad}px`;
  frame.style.top = `${rect.top - stageRect.top - pad}px`;
  frame.style.width = `${rect.width + pad * 2}px`;
  frame.style.height = `${rect.height + pad * 2}px`;

  const rotateHandle = document.createElement("div");
  rotateHandle.className = "transform-handle transform-handle--rotate";
  rotateHandle.textContent = "↻";
  const scaleHandle = document.createElement("div");
  scaleHandle.className = "transform-handle transform-handle--scale";
  scaleHandle.textContent = "↘";
  const stretchXHandle = document.createElement("div");
  stretchXHandle.className = "transform-handle transform-handle--stretch-x";
  stretchXHandle.textContent = "↔";
  const stretchYHandle = document.createElement("div");
  stretchYHandle.className = "transform-handle transform-handle--stretch-y";
  stretchYHandle.textContent = "↕";
  const deleteHandle = document.createElement("button");
  deleteHandle.type = "button";
  deleteHandle.className = "transform-handle transform-handle--delete";
  deleteHandle.textContent = "x";
  deleteHandle.title = "Hapus";
  deleteHandle.setAttribute("aria-label", "Hapus layer aktif");

  const startHandleDrag = (kind, event) => {
    event.preventDefault();
    event.stopPropagation();
    const stageBounds = stageElement.getBoundingClientRect();
    const center = {
      x: ((rect.left + rect.right) / 2) - stageBounds.left,
      y: ((rect.top + rect.bottom) / 2) - stageBounds.top,
    };
    const pointer = { x: event.clientX - stageBounds.left, y: event.clientY - stageBounds.top };
    activeDrag = {
      kind,
      targetId,
      stageElement,
      center,
      startPointer: pointer,
      startDistance: Math.max(1, distanceBetween(center, pointer)),
      startAngle: angleBetween(center, pointer),
      startSize: type === "text" ? (getCurrentText()?.size || 34) : type === "sticker" ? (getCurrentSticker()?.size || 48) : type === "drawing" ? 1 : (getSlotEdit(targetId).zoom || 1),
      startRotation: type === "text" ? (getCurrentText()?.rotation || 0) : type === "sticker" ? (getCurrentSticker()?.rotation || 0) : type === "drawing" ? (state.drawingLayer?.rotation || 0) : (getSlotEdit(targetId).rotation || 0),
      startScaleX: type === "text" ? (getCurrentText()?.scaleX || 1) : type === "sticker" ? (getCurrentSticker()?.scaleX || 1) : type === "drawing" ? (state.drawingLayer?.scaleX || 1) : (getSlotEdit(targetId).scaleX || 1),
      startScaleY: type === "text" ? (getCurrentText()?.scaleY || 1) : type === "sticker" ? (getCurrentSticker()?.scaleY || 1) : type === "drawing" ? (state.drawingLayer?.scaleY || 1) : (getSlotEdit(targetId).scaleY || 1),
      pointerId: event.pointerId,
    };
  };

  rotateHandle.addEventListener("pointerdown", (event) => startHandleDrag(`${type}-rotate-handle`, event));
  scaleHandle.addEventListener("pointerdown", (event) => startHandleDrag(`${type}-scale-handle`, event));
  stretchXHandle.addEventListener("pointerdown", (event) => startHandleDrag(`${type}-stretch-x-handle`, event));
  stretchYHandle.addEventListener("pointerdown", (event) => startHandleDrag(`${type}-stretch-y-handle`, event));
  deleteHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  deleteHandle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    confirmDeleteCurrentSelection();
  });

  frame.append(rotateHandle, scaleHandle, stretchXHandle, stretchYHandle, deleteHandle);
  stageElement.appendChild(frame);
}

function getSelectionTargetNode(stageElement) {
  if (!stageElement) return null;
  if (state.activeSelectionType === "text" && state.selectedTextId) {
    return stageElement.querySelector(`.text-layer[data-text-id="${state.selectedTextId}"]`);
  }
  if (state.activeSelectionType === "sticker" && state.selectedStickerId) {
    return stageElement.querySelector(`.sticker-instance[data-sticker-id="${state.selectedStickerId}"]`);
  }
  if (state.activeSelectionType === "slot" && state.slotAssignments[state.selectedSlotIndex]) {
    return stageElement.querySelector(`.slot[data-slot-index="${state.selectedSlotIndex}"]`);
  }
  if (state.activeSelectionType === "drawing") return stageElement.querySelector(".drawing-preview");
  return null;
}

function positionSelectionActions(stageElement, actionsNode) {
  if (!actionsNode) return;
  actionsNode.classList.add("hidden");
}

function renderSelectionFrame(stageElement) {
  stageElement.querySelector(".selection-frame")?.remove();
  if (!stageElement) return;
  if (state.activeSelectionType === "slot" && state.slotAssignments[state.selectedSlotIndex]) {
    const node = stageElement.querySelector(`.slot[data-slot-index="${state.selectedSlotIndex}"]`);
    if (node) createSelectionFrame(stageElement, node, "slot", state.selectedSlotIndex);
    return;
  }
  if (state.activeSelectionType === "text") {
    const node = stageElement.querySelector(`.text-layer[data-text-id="${state.selectedTextId}"]`);
    if (node) createSelectionFrame(stageElement, node, "text", state.selectedTextId);
    return;
  }
  if (state.activeSelectionType === "sticker") {
    const node = stageElement.querySelector(`.sticker-instance[data-sticker-id="${state.selectedStickerId}"]`);
    if (node) createSelectionFrame(stageElement, node, "sticker", state.selectedStickerId);
    return;
  }
  if (state.activeSelectionType === "drawing" && state.drawingLayer?.dataUrl) {
    const node = stageElement.querySelector(".drawing-preview");
    if (node) createSelectionFrame(stageElement, node, "drawing", "drawing-layer");
  }
}

function getExportSize() {
  if (exportPreset === "web") return 1080;
  if (exportPreset === "standard") return 2000;
  return 4000;
}

function getSectionMap() {
  return {
    media: sectionMedia,
    frame: sectionFrame,
    sticker: sectionSticker,
    text: sectionText,
    filter: sectionFilter,
    draw: sectionDraw,
    project: sectionProject,
    layer: sectionText,
    saved: sectionProject,
    crop: sectionCrop,
    props: sectionMedia,
  };
}

function scrollDesktopSection(target) {
  const map = getSectionMap();
  const section = map[target];
  if (!section || !desktopRightPanel) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDesktopButtonStates() {
  desktopToolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.desktopTool === activeDesktopTool);
  });
  desktopTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.panelTab === activePanelTab);
  });

  const sections = [sectionMedia, sectionText, sectionFilter, sectionFrame, sectionCrop, sectionSticker, sectionDraw, sectionProject];
  sections.forEach((section) => section?.classList.add("hidden"));

  if (activeDesktopTool === "pointer") {
    sectionMedia?.classList.remove("hidden");
    return;
  }

  if (activePanelTab === "filter") {
    sectionFilter?.classList.remove("hidden");
    return;
  }

  if (activePanelTab === "layer") {
    sectionText?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "frame") {
    sectionFrame?.classList.remove("hidden");
    sectionCrop?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "sticker") {
    sectionSticker?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "text" || activeDesktopTool === "layer") {
    sectionText?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "filter") {
    sectionFilter?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "draw") {
    sectionDraw?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "project") {
    sectionProject?.classList.remove("hidden");
    return;
  }

  if (activeDesktopTool === "saved") {
    sectionProject?.classList.remove("hidden");
    return;
  }

  sectionMedia?.classList.remove("hidden");
}

function renderExportPresetUI() {
  exportPresetButtons.forEach((button) => {
    button.classList.toggle("sel", button.dataset.exportPreset === exportPreset);
  });
  if (mobileQualityToggleButton) {
    mobileQualityToggleButton.textContent = exportPreset === "web" ? "WEB" : exportPreset === "standard" ? "STD" : "HD";
  }
}

function renderMobileToolPanel() {
  if (!mobileControls) return;
  mobileToolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mobileTool === mobileTool);
  });

  const currentText = getCurrentText();
  const currentSticker = getCurrentSticker();
  const currentSlotEdit = getSlotEdit(state.selectedSlotIndex);
  const photoCountLabel = `${state.photos.length} foto`;
  const layerCount = `${state.texts.length} text, ${state.stickers.length} stiker`;
  const pendingSlotIndex = pendingSlotAssignment && Date.now() <= pendingSlotAssignment.expiresAt
    ? pendingSlotAssignment.slotIndex
    : null;
  const mobilePhotoPicker = state.photos.length
    ? state.photos
      .map((photo, index) => `
        <button class="mobile-photo-pick ${state.selectedPhotoId === photo.id ? "is-active" : ""}" data-mobile-photo-id="${photo.id}" type="button">
          <img src="${photo.dataUrl}" alt="" />
          <span>${escapeHtml(photo.name || `Foto ${index + 1}`)}</span>
        </button>`)
      .join("")
    : "<p class='hint-text'>Belum ada foto di layer. Pilih Galeri untuk menambahkan.</p>";
  const stickerRotation = Math.round(currentSticker?.rotation || 0);
  const stickerSize = Math.round(currentSticker?.size || 48);
  const textSize = Math.round(currentText?.size || 34);
  const textRotation = Math.round(currentText?.rotation || 0);
  const textColor = currentText?.color || "#ffffff";
  const bgColor = colorForInputValue(currentText?.bgColor || TRANSPARENT_TEXT_BG);

  const templatesByTool = {
    pointer: `
      <div class="mobile-tool-card">
        <strong>Pointer aktif</strong>
        <p>Mode pilih/geser aktif. Pen dimatikan, jadi kamu bisa pilih frame, gambar, text, atau stiker tanpa mencoret.</p>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="open-frame">Atur Frame</button>
          <button class="mini-button" data-mobile-action="focus-text">Layer Text</button>
        </div>
      </div>`,
    frame: `
      <div class="mobile-tool-card">
        <strong>Frame aktif</strong>
        <p>Template: ${state.templateId}. Canvas ${state.canvasWidth} x ${state.canvasHeight}px.</p>
        <div class="mobile-tool-grid">
          <label class="field"><span>Ratio Canvas</span><select id="mobileCanvasRatio">
            <option value="custom" ${currentCanvasRatioKey() === "custom" ? "selected" : ""}>Custom</option>
            <option value="1:1" ${currentCanvasRatioKey() === "1:1" ? "selected" : ""}>1:1 Square</option>
            <option value="4:5" ${currentCanvasRatioKey() === "4:5" ? "selected" : ""}>4:5 Portrait</option>
            <option value="9:16" ${currentCanvasRatioKey() === "9:16" ? "selected" : ""}>9:16 Story</option>
            <option value="16:9" ${currentCanvasRatioKey() === "16:9" ? "selected" : ""}>16:9 Landscape</option>
          </select></label>
          <label class="field"><span>Lebar Canvas</span><input id="mobileCanvasWidth" type="number" min="320" max="3000" step="10" value="${state.canvasWidth}" /></label>
          <label class="field"><span>Slide Lebar</span><input id="mobileCanvasWidthSlider" type="range" min="320" max="3000" step="10" value="${state.canvasWidth}" /></label>
          <label class="field"><span>Tinggi Canvas</span><input id="mobileCanvasHeight" type="number" min="320" max="3000" step="10" value="${state.canvasHeight}" /></label>
          <label class="field"><span>Slide Tinggi</span><input id="mobileCanvasHeightSlider" type="range" min="320" max="3000" step="10" value="${state.canvasHeight}" /></label>
          <label class="field"><span>Background</span><input id="mobileBgColor" type="color" value="${state.backgroundColor}" /></label>
          <label class="field"><span>Gap</span><input id="mobileGapInput" type="range" min="0" max="32" step="1" value="${state.gap}" /></label>
          <label class="field"><span>Radius</span><input id="mobileRadiusInput" type="range" min="0" max="40" step="1" value="${state.radius}" /></label>
          <label class="field"><span>Border Aktif</span><input id="mobileFrameBorderEnabled" type="checkbox" ${state.frameBorder.enabled ? "checked" : ""} /></label>
          <label class="field"><span>Warna Border</span><input id="mobileFrameBorderColor" type="color" value="${state.frameBorder.color || "#000000"}" /></label>
          <label class="field"><span>Tebal Border</span><input id="mobileFrameBorderSize" type="range" min="0" max="24" step="1" value="${state.frameBorder.size ?? 2}" /></label>
          <label class="field"><span>Bentuk Border</span><select id="mobileFrameBorderStyle">
            <option value="solid" ${state.frameBorder.style === "solid" ? "selected" : ""}>Solid</option>
            <option value="dashed" ${state.frameBorder.style === "dashed" ? "selected" : ""}>Dashed</option>
            <option value="dotted" ${state.frameBorder.style === "dotted" ? "selected" : ""}>Dotted</option>
            <option value="double" ${state.frameBorder.style === "double" ? "selected" : ""}>Double</option>
          </select></label>
          <label class="field"><span>Lebar Frame Aktif</span><input id="mobileSlotWidth" type="range" min="14" max="100" step="1" value="${Math.round((getCurrentSlot()?.width || 0.5) * 100)}" /></label>
          <label class="field"><span>Tinggi Frame Aktif</span><input id="mobileSlotHeight" type="range" min="14" max="100" step="1" value="${Math.round((getCurrentSlot()?.height || 0.5) * 100)}" /></label>
          <label class="field"><span>Zoom Slot</span><input id="mobileSlotZoom" type="range" min="100" max="220" step="1" value="${Math.round(currentSlotEdit.zoom * 100)}" /></label>
          <label class="field"><span>Geser X</span><input id="mobileSlotOffsetX" type="range" min="-35" max="35" step="1" value="${Math.round(currentSlotEdit.offsetX * 100)}" /></label>
          <label class="field"><span>Geser Y</span><input id="mobileSlotOffsetY" type="range" min="-35" max="35" step="1" value="${Math.round(currentSlotEdit.offsetY * 100)}" /></label>
        </div>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="reset-slot">Reset Crop</button>
          <button class="mini-button" data-mobile-action="zoom-out-canvas">Zoom -</button>
          <button class="mini-button mini-button--dark" data-mobile-action="zoom-reset-canvas">${Math.round(canvasViewportZoom * 100)}%</button>
          <button class="mini-button" data-mobile-action="zoom-in-canvas">Zoom +</button>
        </div>
      </div>`,
    sticker: `
      <div class="mobile-tool-card">
        <strong>Stiker</strong>
        <p>${currentSticker ? `Aktif: ${currentSticker.emoji} ukuran ${stickerSize}.` : "Pilih stiker dari daftar untuk mulai."}</p>
        <div class="mobile-sticker-picker">
          ${stickerCatalog
            .map((emoji) => `<button class="sticker-button" data-mobile-sticker="${emoji}" type="button">${emoji}</button>`)
            .join("")}
        </div>
        <div class="mobile-tool-grid">
          <label class="field"><span>Ukuran</span><input id="mobileStickerSize" type="range" min="24" max="220" step="1" value="${stickerSize}" ${currentSticker ? "" : "disabled"} /></label>
          <label class="field"><span>Rotasi</span><input id="mobileStickerRotation" type="range" min="-180" max="180" step="1" value="${stickerRotation}" ${currentSticker ? "" : "disabled"} /></label>
        </div>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="add-random-sticker">Tambah Acak</button>
          <button class="mini-button" data-mobile-action="delete-selection">Hapus Aktif</button>
          <button class="mini-button" data-mobile-action="delete-sticker">Hapus Stiker</button>
        </div>
      </div>`,
    text: `
      <div class="mobile-tool-card">
        <strong>Teks</strong>
        <p>${currentText ? `Layer aktif: "${currentText.text || "Tanpa teks"}".` : "Belum ada text layer."}</p>
        <div class="mobile-layer-picker">
          ${state.texts
            .map(
              (text, index) =>
                `<button class="layer-chip ${text.id === state.selectedTextId ? "is-active" : ""}" data-mobile-text-id="${text.id}" type="button">${
                  text.text.trim() || `Text ${index + 1}`
                }</button>`
            )
            .join("")}
        </div>
        <div class="mobile-tool-grid">
          <label class="field"><span>Isi teks</span><input id="mobileTextInput" type="text" maxlength="60" value="${(currentText?.text || "").replace(/"/g, "&quot;")}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Ukuran Font</span><input id="mobileTextSize" type="range" min="18" max="72" step="1" value="${textSize}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Rotasi</span><input id="mobileTextRotation" type="range" min="-180" max="180" step="1" value="${textRotation}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Warna</span><input id="mobileTextColor" type="color" value="${textColor}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>BG Text</span><input id="mobileTextBgColor" type="color" value="${bgColor}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>BG Transparan</span><input id="mobileTextBgTransparent" type="checkbox" ${normalizeTextBgColor(currentText?.bgColor || TRANSPARENT_TEXT_BG) === TRANSPARENT_TEXT_BG ? "checked" : ""} ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Rounded BG</span><input id="mobileTextBgRounded" type="checkbox" ${(currentText?.bgRadius ?? 999) > 0 ? "checked" : ""} ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Radius BG</span><input id="mobileTextBgRadius" type="range" min="0" max="80" step="1" value="${Math.min(80, currentText?.bgRadius ?? 80)}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Border</span><input id="mobileTextBorderEnabled" type="checkbox" ${currentText?.border?.enabled ? "checked" : ""} ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Warna Frame</span><input id="mobileTextBorderColor" type="color" value="${currentText?.border?.color || "#ff6b4a"}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Ukuran Border</span><input id="mobileTextBorderSize" type="range" min="0" max="12" step="1" value="${currentText?.border?.size ?? 2}" ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Style Border</span><select id="mobileTextBorderStyle" ${currentText ? "" : "disabled"}>
            <option value="solid" ${currentText?.border?.style === "solid" ? "selected" : ""}>Solid</option>
            <option value="dashed" ${currentText?.border?.style === "dashed" ? "selected" : ""}>Dashed</option>
            <option value="dotted" ${currentText?.border?.style === "dotted" ? "selected" : ""}>Dotted</option>
            <option value="double" ${currentText?.border?.style === "double" ? "selected" : ""}>Double</option>
          </select></label>
          <label class="field"><span>Bold</span><input id="mobileTextBold" type="checkbox" ${currentText?.fontWeight === "bold" ? "checked" : ""} ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Italic</span><input id="mobileTextItalic" type="checkbox" ${currentText?.fontStyle === "italic" ? "checked" : ""} ${currentText ? "" : "disabled"} /></label>
          <label class="field"><span>Underline</span><input id="mobileTextUnderline" type="checkbox" ${currentText?.underline ? "checked" : ""} ${currentText ? "" : "disabled"} /></label>
        </div>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="add-text">Tambah Text</button>
          <button class="mini-button" data-mobile-action="normal-text">Normal</button>
          <button class="mini-button" data-mobile-action="delete-text">Hapus Text</button>
          <button class="mini-button" data-mobile-action="focus-text">Pilih Layer</button>
        </div>
      </div>`,
    filter: `
      <div class="mobile-tool-card">
        <strong>Filter</strong>
        <p>Preset: ${state.filter.preset}. Brightness ${state.filter.brightness}, Contrast ${state.filter.contrast}.</p>
        <div class="mobile-tool-grid">
          <label class="field"><span>Brightness</span><input id="mobileBrightness" type="range" min="50" max="150" step="1" value="${state.filter.brightness}" /></label>
          <label class="field"><span>Contrast</span><input id="mobileContrast" type="range" min="50" max="150" step="1" value="${state.filter.contrast}" /></label>
          <label class="field"><span>Saturate</span><input id="mobileSaturate" type="range" min="0" max="200" step="1" value="${state.filter.saturate}" /></label>
          <label class="field"><span>Blur</span><input id="mobileBlur" type="range" min="0" max="8" step="0.5" value="${state.filter.blur}" /></label>
        </div>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="apply-preset-normal">Normal</button>
          <button class="mini-button" data-mobile-action="apply-preset-vintage">Vintage</button>
          <button class="mini-button" data-mobile-action="apply-preset-cool">Cool</button>
          <button class="mini-button" data-mobile-action="apply-preset-warm">Warm</button>
          <button class="mini-button" data-mobile-action="apply-preset-gray">Gray</button>
          <button class="mini-button" data-mobile-action="reset-filter">Reset</button>
        </div>
      </div>`,
    draw: `
      <div class="mobile-tool-card">
        <strong>Draw</strong>
        <p>${state.drawingEnabled ? "Mode draw aktif." : "Mode draw belum aktif."} Brush ${state.brush.size}px.</p>
        <div class="mobile-tool-grid">
          <label class="field"><span>Aktif</span><input id="mobileDrawToggle" type="checkbox" ${state.drawingEnabled ? "checked" : ""} /></label>
          <label class="field"><span>Warna</span><input id="mobileBrushColor" type="color" value="${state.brush.color}" /></label>
          <label class="field"><span>Ukuran Brush</span><input id="mobileBrushSize" type="range" min="2" max="32" step="1" value="${state.brush.size}" /></label>
          <label class="field"><span>Eraser</span><input id="mobileEraserToggle" type="checkbox" ${state.brush.eraser ? "checked" : ""} /></label>
        </div>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="clear-draw">Hapus Coretan</button>
        </div>
      </div>`,
    layer: `
      <div class="mobile-tool-card">
        <strong>Layer</strong>
        <p>${pendingSlotIndex === null ? "Pilih layer untuk edit, drag di kanvas untuk pindah, atau hapus layer aktif." : `Frame ${pendingSlotIndex + 1} kosong. Pilih foto di bawah atau ambil dari galeri.`}</p>
        <div class="mobile-layer-section">
          <div class="mobile-layer-section__head">
            <strong>Foto / Galeri</strong>
            <button class="mini-button" data-mobile-action="upload-for-slot" type="button">${pendingSlotIndex === null ? "Tambah Foto" : "Pilih Galeri"}</button>
          </div>
          <div class="mobile-photo-picker">
            ${mobilePhotoPicker}
          </div>
        </div>
        <div class="mobile-layer-stack">
          ${
            [...state.stickers.map((sticker, index) => ({
              type: "sticker",
              id: sticker.id,
              label: `Stiker ${index + 1}: ${sticker.emoji}`,
              active: state.activeSelectionType === "sticker" && state.selectedStickerId === sticker.id,
            })), ...state.texts.map((text, index) => ({
              type: "text",
              id: text.id,
              label: `Text ${index + 1}: ${text.text.trim() || "Tanpa teks"}`,
              active: state.activeSelectionType === "text" && state.selectedTextId === text.id,
            })), ...state.templateSlots
              .map((slot, index) => ({ index, photo: getPhotoById(state.slotAssignments[index]) }))
              .filter((entry) => entry.photo)
              .map(({ index, photo }) => ({
                type: "slot",
                id: String(index),
                label: `Gambar Slot ${index + 1}: ${photo.name || "Foto"}`,
                active: state.activeSelectionType === "slot" && state.selectedSlotIndex === index,
              }))]
              .map((layer) => `<button class="mobile-layer-row ${layer.active ? "is-active" : ""}" data-mobile-layer-type="${layer.type}" data-mobile-layer-id="${layer.id}" type="button"><span>${layer.label}</span><small>${layer.type === "slot" ? "Gambar" : layer.type === "text" ? "Teks" : "Stiker"}</small></button>`)
              .join("") || "<p class='hint-text'>Belum ada text atau stiker.</p>"
          }
        </div>
        <div class="mobile-tool-actions">
          <button class="mini-button" data-mobile-action="add-text">Tambah Text</button>
          <button class="mini-button" data-mobile-action="add-random-sticker">Tambah Stiker</button>
          <button class="mini-button mini-button--danger" data-mobile-action="delete-active-layer">Hapus Aktif</button>
        </div>
      </div>`,
  };

  mobileControls.innerHTML = `
    ${templatesByTool[mobileTool] || ""}
    <div class="slot-help">
      <strong>Status:</strong> ${photoCountLabel}, ${layerCount}, kualitas export ${exportPreset.toUpperCase()}.
    </div>
  `;

  Array.from(mobileControls.querySelectorAll("[data-mobile-action]")).forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.mobileAction;
      if (action === "open-frame") {
        activeDesktopTool = "frame";
        activePanelTab = "props";
        scrollDesktopSection("frame");
      } else if (action === "open-crop") {
        activeDesktopTool = "frame";
        activePanelTab = "props";
        scrollDesktopSection("crop");
      } else if (action === "focus-stickers") {
        activeDesktopTool = "sticker";
        activePanelTab = "props";
        scrollDesktopSection("sticker");
      } else if (action === "delete-selection") {
        deleteCurrentSelection();
        return;
      } else if (action === "delete-active-layer") {
        deleteActiveOverlayLayer();
        return;
      } else if (action === "add-random-sticker") {
        addSticker(stickerCatalog[Math.floor(Math.random() * stickerCatalog.length)]);
        return;
      } else if (action === "delete-sticker") {
        deleteCurrentStickerLayer();
        return;
      } else if (action === "add-text") {
        addTextLayer();
        return;
      } else if (action === "delete-text") {
        deleteCurrentTextLayer();
        return;
      } else if (action === "normal-text") {
        setState((draft) => {
          const current = draft.texts.find((item) => item.id === draft.selectedTextId);
          if (!current) return;
          current.fontWeight = "normal";
          current.fontStyle = "normal";
          current.underline = false;
        });
        return;
      } else if (action === "focus-text") {
        activeDesktopTool = "text";
        activePanelTab = "layer";
        scrollDesktopSection("text");
      } else if (action === "open-filter") {
        activeDesktopTool = "filter";
        activePanelTab = "filter";
        scrollDesktopSection("filter");
      } else if (action?.startsWith("apply-preset-")) {
        const presetId = action.replace("apply-preset-", "");
        const preset = filterPresets.find((item) => item.id === presetId);
        if (preset) {
          setState((draft) => {
            draft.filter = { ...draft.filter, preset: preset.id, ...preset.values };
          }, { trackHistory: false });
        }
        return;
      } else if (action === "reset-filter") {
        resetFilterButton.click();
        return;
      } else if (action === "toggle-draw") {
        drawToggle.checked = !drawToggle.checked;
        drawToggle.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      } else if (action === "clear-draw") {
        clearDrawingButton.click();
        return;
      } else if (action === "open-project") {
        activeDesktopTool = "project";
        activePanelTab = "props";
        scrollDesktopSection("project");
      } else if (action === "rename-project") {
        renameProjectButton.click();
        return;
      } else if (action === "save-project") {
        await saveCurrentProject({ forcePrompt: !state.projectId });
        return;
      } else if (action === "save-as-project") {
        saveAsButton.click();
        return;
      } else if (action === "load-project") {
        loadProjectButton.click();
        return;
      } else if (action === "reset-slot") {
        resetSlotButton.click();
        return;
      } else if (action === "zoom-out-canvas") {
        applyCanvasViewportZoom(canvasViewportZoom - 0.1);
        return;
      } else if (action === "zoom-reset-canvas") {
        applyCanvasViewportZoom(1);
        return;
      } else if (action === "zoom-in-canvas") {
        applyCanvasViewportZoom(canvasViewportZoom + 0.1);
        return;
      } else if (action === "upload-for-slot") {
        if (pendingSlotIndex === null) setPendingSlotAssignment(state.selectedSlotIndex);
        photoInput.click();
        return;
      }
      renderAll();
    });
  });

  Array.from(mobileControls.querySelectorAll("[data-mobile-sticker]")).forEach((button) => {
    button.addEventListener("click", () => {
      const emoji = button.dataset.mobileSticker;
      if (!emoji) return;
      addSticker(emoji);
    });
  });

  Array.from(mobileControls.querySelectorAll("[data-mobile-text-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.mobileTextId;
      if (!id) return;
      setState((draft) => {
        draft.selectedTextId = id;
        draft.activeSelectionType = "text";
      }, { trackHistory: false });
    });
  });

  Array.from(mobileControls.querySelectorAll("[data-mobile-layer-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.mobileLayerId;
      const type = button.dataset.mobileLayerType;
      if (!id || !type) return;
      setState((draft) => {
        draft.activeSelectionType = type;
        if (type === "text") draft.selectedTextId = id;
        if (type === "sticker") draft.selectedStickerId = id;
        if (type === "slot") {
          draft.selectedSlotIndex = Number(id);
          draft.selectedPhotoId = draft.slotAssignments[draft.selectedSlotIndex] || null;
        }
      }, { trackHistory: false });
    });
  });

  Array.from(mobileControls.querySelectorAll("[data-mobile-photo-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      const photoId = button.dataset.mobilePhotoId;
      if (!photoId) return;
      if (pendingSlotAssignment && Date.now() <= pendingSlotAssignment.expiresAt) {
        const pending = pendingSlotAssignment;
        pendingSlotAssignment = null;
        applySlotPhoto(pending.slotIndex, photoId);
        return;
      }
      pendingSlotAssignment = null;
      setState((draft) => {
        draft.selectedPhotoId = photoId;
        draft.activeSelectionType = "photo";
      }, { trackHistory: false });
    });
  });

  const bindInput = (selector, eventName, handler) => {
    const node = mobileControls.querySelector(selector);
    if (!node) return;
    node.addEventListener(eventName, handler);
  };
  const updateMobileState = (mutator, options = {}) => {
    setState(mutator, { trackHistory: false, renderMode: "surfaces", ...options });
  };
  const syncMobileCanvasControls = () => {
    const widthNode = mobileControls.querySelector("#mobileCanvasWidth");
    const widthSlider = mobileControls.querySelector("#mobileCanvasWidthSlider");
    const heightNode = mobileControls.querySelector("#mobileCanvasHeight");
    const heightSlider = mobileControls.querySelector("#mobileCanvasHeightSlider");
    const ratioNode = mobileControls.querySelector("#mobileCanvasRatio");
    if (widthNode) widthNode.value = String(state.canvasWidth);
    if (widthSlider) widthSlider.value = String(state.canvasWidth);
    if (heightNode) heightNode.value = String(state.canvasHeight);
    if (heightSlider) heightSlider.value = String(state.canvasHeight);
    if (ratioNode) ratioNode.value = currentCanvasRatioKey();
  };

  bindInput("#mobileCanvasRatio", "change", (event) => {
    updateMobileState((draft) => {
      applyCanvasRatio(event.target.value, draft);
    });
    syncMobileCanvasControls();
  });
  bindInput("#mobileCanvasWidth", "input", (event) => {
    updateMobileState((draft) => {
      draft.canvasWidth = clamp(Number(event.target.value) || draft.canvasWidth, 320, 3000);
    });
    syncMobileCanvasControls();
  });
  bindInput("#mobileCanvasWidthSlider", "input", (event) => {
    updateMobileState((draft) => {
      draft.canvasWidth = clamp(Number(event.target.value) || draft.canvasWidth, 320, 3000);
    });
    syncMobileCanvasControls();
  });
  bindInput("#mobileCanvasHeight", "input", (event) => {
    updateMobileState((draft) => {
      draft.canvasHeight = clamp(Number(event.target.value) || draft.canvasHeight, 320, 3000);
    });
    syncMobileCanvasControls();
  });
  bindInput("#mobileCanvasHeightSlider", "input", (event) => {
    updateMobileState((draft) => {
      draft.canvasHeight = clamp(Number(event.target.value) || draft.canvasHeight, 320, 3000);
    });
    syncMobileCanvasControls();
  });

  bindInput("#mobileBgColor", "input", (event) => {
    updateMobileState((draft) => {
      draft.backgroundColor = event.target.value;
    });
  });
  bindInput("#mobileGapInput", "input", (event) => {
    updateMobileState((draft) => {
      draft.gap = Number(event.target.value);
    });
  });
  bindInput("#mobileRadiusInput", "input", (event) => {
    updateMobileState((draft) => {
      draft.radius = Number(event.target.value);
    });
  });
  bindInput("#mobileFrameBorderEnabled", "change", (event) => {
    updateMobileState((draft) => {
      draft.frameBorder.enabled = event.target.checked;
    });
  });
  bindInput("#mobileFrameBorderColor", "input", (event) => {
    updateMobileState((draft) => {
      draft.frameBorder.color = event.target.value;
    });
  });
  bindInput("#mobileFrameBorderSize", "input", (event) => {
    updateMobileState((draft) => {
      draft.frameBorder.size = Number(event.target.value);
    });
  });
  bindInput("#mobileFrameBorderStyle", "change", (event) => {
    updateMobileState((draft) => {
      draft.frameBorder.style = event.target.value;
    });
  });
  bindInput("#mobileSlotWidth", "input", (event) => {
    updateMobileState((draft) => {
      resizeSlotByPercent(draft.selectedSlotIndex, "width", Number(event.target.value), draft);
    });
  });
  bindInput("#mobileSlotHeight", "input", (event) => {
    updateMobileState((draft) => {
      resizeSlotByPercent(draft.selectedSlotIndex, "height", Number(event.target.value), draft);
    });
  });
  bindInput("#mobileSlotZoom", "input", (event) => {
    updateMobileState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = {
        ...getSlotEdit(draft.selectedSlotIndex, draft),
        zoom: Number(event.target.value) / 100,
      };
    });
  });
  bindInput("#mobileSlotOffsetX", "input", (event) => {
    updateMobileState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = {
        ...getSlotEdit(draft.selectedSlotIndex, draft),
        offsetX: Number(event.target.value) / 100,
      };
    });
  });
  bindInput("#mobileSlotOffsetY", "input", (event) => {
    updateMobileState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = {
        ...getSlotEdit(draft.selectedSlotIndex, draft),
        offsetY: Number(event.target.value) / 100,
      };
    });
  });
  bindInput("#mobileStickerSize", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.stickers.find((item) => item.id === draft.selectedStickerId);
      if (current) current.size = Number(event.target.value);
    });
  });
  bindInput("#mobileStickerRotation", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.stickers.find((item) => item.id === draft.selectedStickerId);
      if (current) current.rotation = Number(event.target.value);
    });
  });
  bindInput("#mobileTextInput", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.text = event.target.value;
    });
  });
  bindInput("#mobileTextSize", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.size = Number(event.target.value);
    });
  });
  bindInput("#mobileTextRotation", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.rotation = Number(event.target.value);
    });
  });
  bindInput("#mobileTextColor", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.color = event.target.value;
    });
  });
  bindInput("#mobileTextBgColor", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgColor = event.target.value;
    });
  });
  bindInput("#mobileTextBgTransparent", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.bgColor = event.target.checked ? TRANSPARENT_TEXT_BG : "#000000";
    });
  });
  bindInput("#mobileTextBgRounded", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgRadius = event.target.checked ? 999 : 0;
    });
  });
  bindInput("#mobileTextBgRadius", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgRadius = Number(event.target.value);
    });
  });
  bindInput("#mobileTextBorderEnabled", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: event.target.checked, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.enabled = event.target.checked;
    });
  });
  bindInput("#mobileTextBorderColor", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: true, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.color = event.target.value;
    });
  });
  bindInput("#mobileTextBorderSize", "input", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: Number(event.target.value) > 0, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.size = Number(event.target.value);
      current.border.enabled = current.border.size > 0 && current.border.enabled !== false;
    });
  });
  bindInput("#mobileTextBorderStyle", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: true, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.style = event.target.value;
    });
  });
  bindInput("#mobileTextBold", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.fontWeight = event.target.checked ? "bold" : "normal";
    });
  });
  bindInput("#mobileTextItalic", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.fontStyle = event.target.checked ? "italic" : "normal";
    });
  });
  bindInput("#mobileTextUnderline", "change", (event) => {
    updateMobileState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.underline = event.target.checked;
    });
  });
  bindInput("#mobileBrightness", "input", (event) => {
    updateMobileState((draft) => { draft.filter.brightness = Number(event.target.value); });
  });
  bindInput("#mobileContrast", "input", (event) => {
    updateMobileState((draft) => { draft.filter.contrast = Number(event.target.value); });
  });
  bindInput("#mobileSaturate", "input", (event) => {
    updateMobileState((draft) => { draft.filter.saturate = Number(event.target.value); });
  });
  bindInput("#mobileBlur", "input", (event) => {
    updateMobileState((draft) => { draft.filter.blur = Number(event.target.value); });
  });
  bindInput("#mobileDrawToggle", "change", (event) => {
    updateMobileState((draft) => { draft.drawingEnabled = event.target.checked; });
    if (!event.target.checked) mobileTool = "layer";
  });
  bindInput("#mobileBrushColor", "input", (event) => {
    updateMobileState((draft) => { draft.brush.color = event.target.value; });
  });
  bindInput("#mobileBrushSize", "input", (event) => {
    updateMobileState((draft) => { draft.brush.size = Number(event.target.value); });
  });
  bindInput("#mobileEraserToggle", "change", (event) => {
    updateMobileState((draft) => { draft.brush.eraser = event.target.checked; });
  });
}

function showProjectStatus() {
  const currentText = getCurrentText();
  window.alert(
    `Project: ${state.projectName || "Belum disimpan"}\nFoto: ${state.photos.length}\nText layer: ${state.texts.length}\nStiker: ${state.stickers.length}\nText aktif: ${currentText?.text || "-"}`
  );
}

function openSettingsView() {
  mobileView = "editor";
  mobileTool = "frame";
  activeDesktopTool = "frame";
  activePanelTab = "props";
  renderAll();
  scrollDesktopSection("frame");
}

async function copyCompositeImage() {
  const blob = await exportCompositeBlob("image/png", 0.92, getExportSize());
  if (navigator.clipboard && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    window.alert("Gambar berhasil disalin ke clipboard.");
    return;
  }
  await triggerDownload(blob, "funpic-copy.png");
}

async function handleShareTarget(target) {
  if (target === "copy") {
    await copyCompositeImage();
    return;
  }
  if (target === "save") {
    await saveCompositeAsDeviceImage({ preferShare: true });
    return;
  }
  if (target === "system") {
    await shareCompositePng();
    return;
  }
  window.alert(`Menyiapkan share ke ${target}. Browser akan membuka share sheet atau mengunduh PNG jika tidak didukung.`);
  await shareCompositePng();
}

function renderStageContents(stageElement, { interactive = false, allowResize = interactive, applySelection = interactive } = {}) {
  if (!stageElement) return;

  const isDesktopStage = stageElement.classList.contains("editor-stage--desktop");
  const isMobileEditorStage = stageElement === mobileEditorPreview;
  const isZoomableStage = isDesktopStage || isMobileEditorStage;
  const viewportElement = isDesktopStage
    ? stageElement.closest(".desktop-canvas-zone") || stageElement.parentElement
    : stageElement.parentElement;
  const parentRect = viewportElement?.getBoundingClientRect();
  const rawAvailableWidth = parentRect?.width || stageElement.getBoundingClientRect().width || 1;
  const horizontalPadding = isDesktopStage ? 72 : 32;
  let availableWidth = Math.max(1, rawAvailableWidth - horizontalPadding);
  if (availableWidth < 60) {
    availableWidth = isDesktopStage
      ? Math.max(560, window.innerWidth - 72 - 340 - 112)
      : Math.max(280, window.innerWidth - 32);
  }
  const desktopScale = clamp(availableWidth / 1080, 0.38, 0.9);
  const baseTargetWidth = isDesktopStage ? state.canvasWidth * desktopScale : availableWidth;
  const baseTargetHeight = isDesktopStage ? state.canvasHeight * desktopScale : availableWidth * (state.canvasHeight / state.canvasWidth);
  const targetWidth = isZoomableStage ? baseTargetWidth * canvasViewportZoom : baseTargetWidth;
  const targetHeight = isZoomableStage ? baseTargetHeight * canvasViewportZoom : baseTargetHeight;
  stageElement.style.width = `${targetWidth}px`;
  stageElement.style.height = `${targetHeight}px`;
  stageElement.style.aspectRatio = "auto";
  stageElement.style.background = state.backgroundColor;
  stageElement.style.setProperty("--stage-ratio", `${state.canvasWidth} / ${state.canvasHeight}`);
  stageElement.classList.toggle("is-drawing", interactive && state.drawingEnabled);
  Array.from(stageElement.querySelectorAll(".slot, .text-layer, .sticker-instance, .drawing-preview")).forEach((node) => node.remove());

  const stageRect = stageElement.getBoundingClientRect();
  const computedStage = window.getComputedStyle(stageElement);
  const widthBase = Math.max(stageRect.width, Number.parseFloat(computedStage.width) || 0, 1);
  const heightBase = Math.max(stageRect.height, Number.parseFloat(computedStage.height) || 0, 1);
  const gapPxX = (state.gap / 100) * widthBase * 0.5;
  const gapPxY = (state.gap / 100) * heightBase * 0.5;

  state.templateSlots.forEach((slot, index) => {
    const node = document.querySelector("#slotTemplate").content.firstElementChild.cloneNode(true);
    const left = slot.x * widthBase + gapPxX / 2;
    const top = slot.y * heightBase + gapPxY / 2;
    const width = slot.width * widthBase - gapPxX;
    const height = slot.height * heightBase - gapPxY;
    const slotEdit = getSlotEdit(index);

    node.dataset.slotIndex = String(index);
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.width = `${Math.max(30, width)}px`;
    node.style.height = `${Math.max(30, height)}px`;
    node.style.borderRadius = `${state.radius}px`;
    node.style.border = state.frameBorder.enabled && state.frameBorder.size > 0
      ? `${state.frameBorder.size}px ${state.frameBorder.style || "solid"} ${state.frameBorder.color || "#000000"}`
      : "0";
    node.style.zIndex = String(index + 1);
    node.draggable = interactive && Boolean(state.slotAssignments[index]);
    if (index === state.selectedSlotIndex && state.activeSelectionType === "slot") node.classList.add("is-selected");

    const photo = getPhotoById(state.slotAssignments[index]);
    const img = node.querySelector(".slot__image");
    const placeholder = node.querySelector(".slot__placeholder");

    if (photo) {
      img.src = photo.dataUrl;
      img.alt = photo.name;
      img.draggable = false;
      img.classList.remove("hidden");
      img.style.filter = getFilterCss();
      img.style.transform = slotImageTransform(slotEdit);
      placeholder.classList.add("hidden");
    } else {
      img.classList.add("hidden");
      placeholder.classList.remove("hidden");
      placeholder.textContent = `Slot ${index + 1}`;
    }

    if (interactive) {
      node.addEventListener("click", async () => {
        if (Date.now() < suppressSlotClickUntil) return;
        setState((draft) => {
          draft.selectedSlotIndex = index;
          draft.activeSelectionType = "slot";
        }, { trackHistory: false });
        if (!state.slotAssignments[index]) {
          await chooseImageForEmptySlot(index, {
            source: stageElement === mobileEditorPreview ? "mobile" : "desktop",
          });
        }
      });

      node.addEventListener("dragstart", (event) => {
        if (!photo) return;
        event.dataTransfer?.setData("text/source", "slot");
        event.dataTransfer?.setData("text/slot-index", String(index));
        event.dataTransfer?.setData("text/photo-id", photo.id);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
        suppressSlotClickUntil = Date.now() + 180;
      });
      node.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
          const source = event.dataTransfer.getData("text/source");
          event.dataTransfer.dropEffect = source === "slot" ? "move" : "copy";
        }
      });
      node.addEventListener("drop", (event) => {
        event.preventDefault();
        handleSlotDrop(event, index);
      });

      node.addEventListener("wheel", (event) => {
        if (state.activeSelectionType !== "slot" || state.selectedSlotIndex !== index) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY > 0 ? -0.05 : 0.05;
        setState((draft) => {
          const edit = getSlotEdit(index, draft);
          draft.slotEdits[index] = {
            ...edit,
            zoom: clamp((edit.zoom || 1) + direction, 0.6, 3),
          };
        }, { trackHistory: false });
      }, { passive: false });

      setupSlotGesture(node, index, stageElement);
    }

    if (allowResize && index === state.selectedSlotIndex && state.activeSelectionType === "slot") {
      const resizeHandle = document.createElement("div");
      resizeHandle.className = "slot__resize";
      resizeHandle.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        activeDrag = {
          kind: "slot-resize",
          pointerId: event.pointerId,
          slotIndex: index,
          startX: event.clientX,
          startY: event.clientY,
          startWidth: slot.width,
          startHeight: slot.height,
        };
        resizeHandle.setPointerCapture(event.pointerId);
      });
      resizeHandle.addEventListener("pointermove", (event) => {
        if (!activeDrag || activeDrag.kind !== "slot-resize" || activeDrag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const deltaX = (event.clientX - activeDrag.startX) / widthBase;
        const deltaY = (event.clientY - activeDrag.startY) / heightBase;
        setState((draft) => {
          const current = draft.templateSlots[index];
          const bounds = getResizeBounds(draft.templateSlots, index);
          const { xCandidates: snapCandidatesX, yCandidates: snapCandidatesY } = getResizeSnapCandidates(draft.templateSlots, index);
          const nextWidth = clamp(activeDrag.startWidth + deltaX, 0.14, Math.min(1 - current.x, bounds.maxWidth));
          const nextHeight = clamp(activeDrag.startHeight + deltaY, 0.14, Math.min(1 - current.y, bounds.maxHeight));
          current.width = snapValue(nextWidth, snapCandidatesX);
          current.height = snapValue(nextHeight, snapCandidatesY);
        }, { trackHistory: false, renderMode: "none" });
        const latest = state.templateSlots[index];
        if (latest) {
          node.style.width = `${Math.max(30, latest.width * widthBase - gapPxX)}px`;
          node.style.height = `${Math.max(30, latest.height * heightBase - gapPxY)}px`;
        }
      });
      const finishResize = () => {
        if (!activeDrag || activeDrag.kind !== "slot-resize") return;
        activeDrag = null;
        pushHistory();
        renderAll();
      };
      resizeHandle.addEventListener("pointerup", finishResize);
      resizeHandle.addEventListener("pointercancel", finishResize);
      node.appendChild(resizeHandle);
    }

    stageElement.appendChild(node);
  });

  const drawingLayer = state.drawingLayer?.dataUrl ? state.drawingLayer : (state.drawingDataUrl ? {
    dataUrl: state.drawingDataUrl,
    x: 0.5,
    y: 0.5,
    width: 1,
    height: 1,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  } : null);
  if (drawingLayer?.dataUrl) {
    const drawingPreview = document.createElement("img");
    drawingPreview.className = "drawing-preview";
    drawingPreview.src = drawingLayer.dataUrl;
    drawingPreview.alt = "";
    drawingPreview.style.left = `${drawingLayer.x * 100}%`;
    drawingPreview.style.top = `${drawingLayer.y * 100}%`;
    drawingPreview.style.width = `${drawingLayer.width * 100}%`;
    drawingPreview.style.height = `${drawingLayer.height * 100}%`;
    drawingPreview.style.transform = drawingTransform(drawingLayer);
    if (state.activeSelectionType === "drawing") drawingPreview.classList.add("is-active");
    stageElement.appendChild(drawingPreview);
  }

  state.texts.forEach((text, index) => {
    const node = document.createElement("div");
    node.role = "button";
    node.tabIndex = 0;
    node.className = "text-layer";
    node.dataset.textId = text.id;
    node.textContent = text.text;
    node.style.left = `${text.x * 100}%`;
    node.style.top = `${text.y * 100}%`;
    node.style.transform = textTransform(text);
    node.style.fontSize = `${text.size}px`;
    node.style.color = text.color;
    node.style.fontFamily = text.fontFamily;
    node.style.fontWeight = text.fontWeight || "normal";
    node.style.fontStyle = text.fontStyle || "normal";
    node.style.textDecoration = text.underline ? "underline" : "none";
    node.style.background = text.bgColor === TRANSPARENT_TEXT_BG ? "transparent" : text.bgColor;
    node.style.borderRadius = `${Math.min(999, text.bgRadius ?? 999)}px`;
    node.style.border = text.border?.enabled && text.border?.size > 0
      ? `${text.border.size}px ${text.border.style || "solid"} ${text.border.color || "#ff6b4a"}`
      : "0";
    node.style.zIndex = text.id === state.selectedTextId && state.activeSelectionType === "text" ? "42" : String(30 + index);
    if (text.id === state.selectedTextId && state.activeSelectionType === "text") node.classList.add("is-active");
    if (interactive) {
      setupTextInteractions(node, text.id, stageElement);
      node.addEventListener("wheel", (event) => {
        if (state.selectedTextId !== text.id) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY > 0 ? -2 : 2;
        setState((draft) => {
          const current = draft.texts.find((item) => item.id === text.id);
          if (current) current.size = clamp(current.size + direction, 16, 140);
        }, { trackHistory: false });
      }, { passive: false });
    } else {
      node.disabled = true;
    }
    stageElement.appendChild(node);
  });

  state.stickers.forEach((sticker, index) => {
    const node = document.createElement("div");
    node.className = "sticker-instance";
    node.dataset.stickerId = sticker.id;
    node.textContent = sticker.emoji;
    node.style.left = `${sticker.x * 100}%`;
    node.style.top = `${sticker.y * 100}%`;
    node.style.width = `${sticker.size}px`;
    node.style.height = `${sticker.size}px`;
    node.style.transform = stickerTransform(sticker);
    node.style.fontSize = `${sticker.size}px`;
    node.style.zIndex = sticker.id === state.selectedStickerId && state.activeSelectionType === "sticker" ? "44" : String(36 + index);
    if (sticker.id === state.selectedStickerId && state.activeSelectionType === "sticker") node.classList.add("is-active");
    if (interactive) {
      setupStickerInteractions(node, sticker.id, stageElement);
      node.addEventListener("wheel", (event) => {
        if (state.selectedStickerId !== sticker.id) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.deltaY > 0 ? -3 : 3;
        setState((draft) => {
          const current = draft.stickers.find((item) => item.id === sticker.id);
          if (current) current.size = clamp(current.size + direction, 24, 200);
        }, { trackHistory: false });
      }, { passive: false });
    }
    stageElement.appendChild(node);
  });

  if (interactive) {
    renderSelectionFrame(stageElement);
  }
}

function renderStage() {
  renderStageContents(editorStage, { interactive: true });
  restoreDrawingLayer();
  applySelectionActionsVisibility();
  positionSelectionActions(editorStage, selectionActions);
}

function renderMobileShell() {
  mobileStages.forEach((stage) => {
    const stageView = stage.classList.contains("phone-stage--editor")
      ? "editor"
      : stage.classList.contains("phone-stage--share")
        ? "share"
        : "home";
    stage.classList.toggle("is-active", stageView === mobileView);
  });

  mobileNavButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mobileView === mobileView);
  });

  renderStageContents(mobileEditorPreview, { interactive: mobileView === "editor", allowResize: mobileView === "editor", applySelection: false });
  renderStageContents(mobileSharePreview, { interactive: false });
  restoreMobileDrawingLayer();
  renderMobileToolPanel();
  renderExportPresetUI();
  positionSelectionActions(mobileEditorPreview, mobileSelectionActions);
}

function renderEditorSurfaceOnly() {
  syncInputs();
  renderStage();
  renderStageContents(mobileEditorPreview, { interactive: mobileView === "editor", allowResize: mobileView === "editor", applySelection: false });
  renderStageContents(mobileSharePreview, { interactive: false });
  restoreMobileDrawingLayer();
  renderMobileToolPanel();
  renderExportPresetUI();
  applySelectionActionsVisibility();
  positionSelectionActions(editorStage, selectionActions);
  positionSelectionActions(mobileEditorPreview, mobileSelectionActions);
  syncDeleteLabels();
}

function renderEditorSurfacesOnly() {
  renderStage();
  renderStageContents(mobileEditorPreview, { interactive: mobileView === "editor", allowResize: mobileView === "editor", applySelection: false });
  renderStageContents(mobileSharePreview, { interactive: false });
  restoreMobileDrawingLayer();
  renderExportPresetUI();
  applySelectionActionsVisibility();
  positionSelectionActions(editorStage, selectionActions);
  positionSelectionActions(mobileEditorPreview, mobileSelectionActions);
  syncDeleteLabels();
  scheduleAutosave();
}

function resizeDrawingSurface(canvas, stageElement) {
  if (!canvas || !stageElement) return;
  const rect = stageElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const previous = state.drawingLayer?.dataUrl || state.drawingDataUrl;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (previous) {
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, rect.width, rect.height);
      context.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = previous;
  } else {
    context.clearRect(0, 0, rect.width, rect.height);
  }
}

function restoreDrawingLayer() {
  resizeDrawingSurface(drawingCanvas, editorStage);
}

function restoreMobileDrawingLayer() {
  resizeDrawingSurface(mobileDrawingCanvas, mobileEditorPreview);
}

function renderAll() {
  syncInputs();
  renderTemplates();
  renderPhotoLibrary();
  renderStickerCatalog();
  renderTextLayerList();
  renderSavedProjects();
  renderFilterPresets();
  renderStage();
  renderMobileShell();
  renderDesktopButtonStates();
  syncDeleteLabels();
  updateHistoryButtons();
  scheduleAutosave();
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(cloneState()));
    if (state.projectId) {
      await persistCurrentProject({ silent: true });
      await refreshSavedProjects();
    }
  }, 500);
}

async function exportCompositeBlob(type = "image/png", quality = 0.92, size = null) {
  const canvas = document.createElement("canvas");
  const width = size || state.canvasWidth;
  const height = size ? Math.round((state.canvasHeight / state.canvasWidth) * size) : state.canvasHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = state.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const gapPxX = (state.gap / 100) * width * 0.5;
  const gapPxY = (state.gap / 100) * height * 0.5;

  for (let index = 0; index < state.templateSlots.length; index += 1) {
    const slot = state.templateSlots[index];
    const photo = getPhotoById(state.slotAssignments[index]);
    const slotEdit = getSlotEdit(index);
    const x = slot.x * width + gapPxX / 2;
    const y = slot.y * height + gapPxY / 2;
    const slotWidth = slot.width * width - gapPxX;
    const slotHeight = slot.height * height - gapPxY;

    ctx.save();
    roundedRect(ctx, x, y, slotWidth, slotHeight, state.radius);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, slotWidth, slotHeight);
    if (photo) {
      const image = await loadImage(photo.dataUrl);
      ctx.filter = getFilterCss();
      drawCoverImage(ctx, image, x, y, slotWidth, slotHeight, slotEdit);
      ctx.filter = "none";
    }
    ctx.restore();

    drawFrameBorder(ctx, x, y, slotWidth, slotHeight);
  }

  const drawingLayer = state.drawingLayer?.dataUrl ? state.drawingLayer : (state.drawingDataUrl ? {
    dataUrl: state.drawingDataUrl,
    x: 0.5,
    y: 0.5,
    width: 1,
    height: 1,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  } : null);
  if (drawingLayer?.dataUrl) {
    const drawing = await loadImage(drawingLayer.dataUrl);
    const drawingWidth = (drawingLayer.width || 1) * width;
    const drawingHeight = (drawingLayer.height || 1) * height;
    ctx.save();
    ctx.translate((drawingLayer.x || 0.5) * width, (drawingLayer.y || 0.5) * height);
    ctx.rotate(((drawingLayer.rotation || 0) * Math.PI) / 180);
    ctx.scale(drawingLayer.scaleX || 1, drawingLayer.scaleY || 1);
    ctx.drawImage(drawing, -drawingWidth / 2, -drawingHeight / 2, drawingWidth, drawingHeight);
    ctx.restore();
  }

  state.stickers.forEach((sticker) => {
    ctx.save();
    ctx.font = `${sticker.size * 1.8}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(sticker.x * width, sticker.y * height);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.scale(sticker.scaleX || 1, sticker.scaleY || 1);
    ctx.fillText(sticker.emoji, 0, 0);
    ctx.restore();
  });

  state.texts
    .filter((text) => text.text.trim())
    .forEach((text) => {
      ctx.save();
      ctx.font = `${text.fontStyle === "italic" ? "italic " : ""}${text.fontWeight === "bold" ? "700 " : ""}${text.size * 2}px ${text.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(text.text);
      const textWidth = metrics.width + 48;
      const textHeight = text.size * 2.2;
      const x = text.x * width;
      const y = text.y * height;
      ctx.translate(x, y);
      ctx.rotate(((text.rotation || 0) * Math.PI) / 180);
      ctx.scale(text.scaleX || 1, text.scaleY || 1);
      const textRadius = Math.min(textHeight / 2, text.bgRadius === 999 ? textHeight / 2 : (text.bgRadius ?? 999) * 2);
      if (text.bgColor !== TRANSPARENT_TEXT_BG) {
        ctx.fillStyle = text.bgColor;
        roundedRect(ctx, -textWidth / 2, -textHeight / 2, textWidth, textHeight, textRadius);
        ctx.fill();
      }
      if (text.border?.enabled && text.border?.size > 0) {
        const borderSize = Math.max(1, text.border.size * 2);
        ctx.save();
        ctx.strokeStyle = text.border.color || "#ff6b4a";
        ctx.lineWidth = borderSize;
        if (text.border.style === "dashed") ctx.setLineDash([borderSize * 5, borderSize * 3]);
        if (text.border.style === "dotted") ctx.setLineDash([borderSize, borderSize * 2.3]);
        roundedRect(ctx, -textWidth / 2, -textHeight / 2, textWidth, textHeight, textRadius);
        ctx.stroke();
        if (text.border.style === "double") {
          ctx.setLineDash([]);
          ctx.lineWidth = Math.max(1, borderSize * 0.55);
          roundedRect(ctx, -textWidth / 2 + borderSize * 1.5, -textHeight / 2 + borderSize * 1.5, textWidth - borderSize * 3, textHeight - borderSize * 3, Math.max(0, textRadius - borderSize * 1.5));
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, 0, 4);
      if (text.underline) {
        ctx.strokeStyle = text.color;
        ctx.lineWidth = Math.max(2, text.size * 0.08);
        ctx.beginPath();
        ctx.moveTo(-metrics.width / 2, text.size * 0.72);
        ctx.lineTo(metrics.width / 2, text.size * 0.72);
        ctx.stroke();
      }
      ctx.restore();
    });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      canvas.toBlob(resolve, "image/png", 0.92);
    }, type, quality);
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius || 0, Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawFrameBorder(ctx, x, y, width, height) {
  if (!state.frameBorder.enabled || !state.frameBorder.size) return;
  const sizeScale = Math.max(width / 1080, height / 1080, 0.5);
  const lineWidth = Math.max(1, state.frameBorder.size * sizeScale);
  const style = state.frameBorder.style || "solid";

  ctx.save();
  ctx.strokeStyle = state.frameBorder.color || "#000000";
  ctx.lineWidth = lineWidth;
  if (style === "dashed") ctx.setLineDash([lineWidth * 5, lineWidth * 3]);
  if (style === "dotted") ctx.setLineDash([lineWidth, lineWidth * 2.3]);
  if (style === "double") {
    ctx.lineWidth = Math.max(1, lineWidth * 0.55);
    const innerWidth = Math.max(1, width - lineWidth * 2);
    const innerHeight = Math.max(1, height - lineWidth * 2);
    const secondWidth = Math.max(1, width - lineWidth * 6);
    const secondHeight = Math.max(1, height - lineWidth * 6);
    roundedRect(ctx, x + lineWidth, y + lineWidth, innerWidth, innerHeight, Math.max(0, state.radius - lineWidth));
    ctx.stroke();
    roundedRect(ctx, x + lineWidth * 3, y + lineWidth * 3, secondWidth, secondHeight, Math.max(0, state.radius - lineWidth * 3));
    ctx.stroke();
    ctx.restore();
    return;
  }
  roundedRect(ctx, x + lineWidth / 2, y + lineWidth / 2, width - lineWidth, height - lineWidth, Math.max(0, state.radius - lineWidth / 2));
  ctx.stroke();
  ctx.restore();
}

function drawCoverImage(ctx, image, x, y, width, height, slotEdit) {
  const zoom = slotEdit.zoom || 1;
  const rotation = ((slotEdit.rotation || 0) * Math.PI) / 180;
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  if (sourceRatio > targetRatio) drawHeight = width / sourceRatio;
  else drawWidth = height * sourceRatio;

  drawWidth *= zoom * (slotEdit.scaleX || 1);
  drawHeight *= zoom * (slotEdit.scaleY || 1);

  const drawX = x + (width - drawWidth) / 2 + slotEdit.offsetX * width;
  const drawY = y + (height - drawHeight) / 2 + slotEdit.offsetY * height;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, drawX - (x + width / 2), drawY - (y + height / 2), drawWidth, drawHeight);
  ctx.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function buildProjectRecord() {
  const thumbnailBlob = await exportCompositeBlob("image/jpeg", 0.72, 360);
  return {
    id: state.projectId,
    name: state.projectName,
    updatedAt: Date.now(),
    thumbnail: thumbnailBlob ? await blobToDataUrl(thumbnailBlob) : "",
    data: cloneState(),
  };
}

async function persistCurrentProject({ silent = false } = {}) {
  if (!state.projectId || !state.projectName) return;
  const record = await buildProjectRecord();
  await saveProjectRecord(record);
  if (!silent) window.alert(`Project "${state.projectName}" berhasil disimpan.`);
}

async function refreshSavedProjects() {
  savedProjectsCache = await listProjectRecords();
  renderSavedProjects();
}

async function saveCurrentProject({ forcePrompt = false } = {}) {
  const suggested = state.projectName || `Project ${new Date().toLocaleString("id-ID")}`;
  let nextName = state.projectName;
  if (forcePrompt || !nextName) nextName = window.prompt("Masukkan nama project:", suggested)?.trim();
  if (!nextName) return;
  if (!state.projectId || forcePrompt) state.projectId = uid("project");
  state.projectName = nextName;
  await persistCurrentProject();
  await refreshSavedProjects();
  renderAll();
}

async function renameCurrentProject() {
  if (!state.projectId || !state.projectName) {
    await saveCurrentProject({ forcePrompt: true });
    return;
  }
  const nextName = window.prompt("Nama project baru:", state.projectName)?.trim();
  if (!nextName || nextName === state.projectName) return;
  state.projectName = nextName;
  await persistCurrentProject();
  await refreshSavedProjects();
  renderAll();
}

async function loadMostRecentProject() {
  await refreshSavedProjects();
  const latest = savedProjectsCache[0];
  if (!latest) {
    window.alert("Belum ada project tersimpan.");
    return;
  }
  const record = await getProjectRecord(latest.id);
  if (!record?.data) return;
  applySnapshot(record.data);
  history.length = 0;
  history.push(cloneState());
  future.length = 0;
  updateHistoryButtons();
  window.alert(`Project "${record.name}" berhasil dimuat.`);
}

async function importProjectFile(file) {
  try {
    const text = await file.text();
    const snapshot = normalizeSnapshot(JSON.parse(text));
    snapshot.projectId = null;
    snapshot.projectName = file.name.replace(/\.json$/i, "");
    applySnapshot(snapshot);
    history.length = 0;
    history.push(cloneState());
    future.length = 0;
    updateHistoryButtons();
  } catch (error) {
    console.error(error);
    window.alert("File project tidak valid. Pilih file JSON export dari aplikasi ini.");
  }
}

async function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getSelectedImageFormat() {
  const format = imageFormatInput?.value || "png";
  return ["png", "jpeg", "webp"].includes(format) ? format : "png";
}

function getImageExportOptions(format = getSelectedImageFormat()) {
  const normalized = format === "jpg" ? "jpeg" : format;
  const extension = normalized === "jpeg" ? "jpg" : normalized;
  const mimeType = normalized === "jpeg" ? "image/jpeg" : normalized === "webp" ? "image/webp" : "image/png";
  return {
    format: normalized,
    extension,
    mimeType,
    quality: normalized === "png" ? 0.92 : 0.9,
  };
}

function getOutputFilename(format = getSelectedImageFormat()) {
  const { extension } = getImageExportOptions(format);
  return `${safeFilename(state.projectName, "my-image-editor")}.${extension}`;
}

async function downloadCompositeImage(format = getSelectedImageFormat()) {
  const options = getImageExportOptions(format);
  const blob = await exportCompositeBlob(options.mimeType, options.quality, getExportSize());
  await triggerDownload(blob, getOutputFilename(options.format));
}

async function downloadCompositePng() {
  await downloadCompositeImage("png");
}

async function shareCompositePng() {
  const options = getImageExportOptions("png");
  const blob = await exportCompositeBlob(options.mimeType, options.quality, getExportSize());
  const file = new File([blob], getOutputFilename(options.format), { type: options.mimeType });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: state.projectName || "FunPic",
        text: "Hasil edit dari FunPic",
      });
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
    }
    return;
  }
  await triggerDownload(blob, getOutputFilename(options.format));
}

async function saveCompositeAsDeviceImage({ preferShare = false, format = getSelectedImageFormat() } = {}) {
  const options = getImageExportOptions(format);
  const blob = await exportCompositeBlob(options.mimeType, options.quality, getExportSize());
  const filename = getOutputFilename(options.format);
  const file = new File([blob], filename, { type: options.mimeType });

  if (preferShare && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: state.projectName || "My Image Editor",
        text: "Simpan gambar hasil edit",
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Share untuk simpan gagal, fallback download.", error);
    }
  }

  if (!preferShare && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: `${options.extension.toUpperCase()} Image`, accept: { [options.mimeType]: [`.${options.extension}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("File picker gagal, fallback download.", error);
    }
  }

  await triggerDownload(blob, filename);
}

function applySlotPhoto(slotIndex, photoId) {
  if (!Number.isInteger(slotIndex) || !state.templateSlots[slotIndex]) return;
  if (!photoId || !getPhotoById(photoId)) return;
  if (state.slotAssignments[slotIndex] === photoId && state.selectedSlotIndex === slotIndex) {
    setState((draft) => {
      draft.selectedPhotoId = photoId;
      draft.activeSelectionType = "slot";
    }, { trackHistory: false, renderMode: "editor" });
    return;
  }
  setState((draft) => {
    draft.slotAssignments[slotIndex] = photoId;
    draft.selectedSlotIndex = slotIndex;
    draft.selectedPhotoId = photoId;
    draft.activeSelectionType = "slot";
  });
}

function getResizeBounds(slots, index) {
  const slot = slots[index];
  let maxRight = 1;
  let maxBottom = 1;
  slots.forEach((other, otherIndex) => {
    if (otherIndex === index) return;
    const verticalOverlap = slot.y < other.y + other.height && slot.y + slot.height > other.y;
    const horizontalOverlap = slot.x < other.x + other.width && slot.x + slot.width > other.x;
    if (verticalOverlap && other.x > slot.x) maxRight = Math.min(maxRight, other.x);
    if (horizontalOverlap && other.y > slot.y) maxBottom = Math.min(maxBottom, other.y);
  });
  return {
    maxWidth: Math.max(0.14, maxRight - slot.x),
    maxHeight: Math.max(0.14, maxBottom - slot.y),
  };
}

function snapValue(value, candidates, threshold = 0.025) {
  let snapped = value;
  let best = threshold;
  candidates.forEach((candidate) => {
    const distance = Math.abs(value - candidate);
    if (distance < best) {
      best = distance;
      snapped = candidate;
    }
  });
  return snapped;
}

function getResizeSnapCandidates(slots, index) {
  const slot = slots[index];
  const xCandidates = [1 - slot.x];
  const yCandidates = [1 - slot.y];
  slots.forEach((other, otherIndex) => {
    if (otherIndex === index) return;
    xCandidates.push(other.x - slot.x, other.x + other.width - slot.x);
    yCandidates.push(other.y - slot.y, other.y + other.height - slot.y);
  });
  return {
    xCandidates: xCandidates.filter((value) => value >= 0.14),
    yCandidates: yCandidates.filter((value) => value >= 0.14),
  };
}

function resizeSlotByPercent(slotIndex, dimension, percent, draft = state) {
  const current = draft.templateSlots[slotIndex];
  if (!current) return;
  const bounds = getResizeBounds(draft.templateSlots, slotIndex);
  const { xCandidates, yCandidates } = getResizeSnapCandidates(draft.templateSlots, slotIndex);
  if (dimension === "width") {
    const nextWidth = clamp(percent / 100, 0.14, Math.min(1 - current.x, bounds.maxWidth));
    current.width = snapValue(nextWidth, xCandidates);
  }
  if (dimension === "height") {
    const nextHeight = clamp(percent / 100, 0.14, Math.min(1 - current.y, bounds.maxHeight));
    current.height = snapValue(nextHeight, yCandidates);
  }
}

function applyCanvasRatio(value, draft = state) {
  const ratioMap = {
    "1:1": [1080, 1080],
    "4:5": [1080, 1350],
    "9:16": [1080, 1920],
    "16:9": [1600, 900],
  };
  const next = ratioMap[value];
  if (!next) return;
  [draft.canvasWidth, draft.canvasHeight] = next;
}

function currentCanvasRatioKey() {
  const ratioKey = `${state.canvasWidth}:${state.canvasHeight}`;
  if (state.canvasWidth === state.canvasHeight) return "1:1";
  if (ratioKey === "1080:1350") return "4:5";
  if (ratioKey === "1080:1920") return "9:16";
  if (ratioKey === "1600:900") return "16:9";
  return "custom";
}

function autoLayoutUploadedPhotos(photoEntries, draft = state) {
  if (!photoEntries.length) return;
  draft.templateId = `auto-${photoEntries.length}`;
  draft.templateSlots = templateSlotsForCount(photoEntries.length);
  draft.slotAssignments = {};
  draft.slotEdits = {};
  photoEntries.forEach((photo, index) => {
    draft.slotAssignments[index] = photo.id;
  });
  draft.selectedSlotIndex = 0;
  draft.selectedPhotoId = photoEntries[0]?.id || null;
  draft.activeSelectionType = "slot";
}

function swapSlots(sourceIndex, targetIndex) {
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex)) return;
  if (!state.templateSlots[sourceIndex] || !state.templateSlots[targetIndex]) return;
  if (sourceIndex === targetIndex) return;
  if (state.slotAssignments[sourceIndex] === state.slotAssignments[targetIndex]) return;
  setState((draft) => {
    const sourcePhoto = draft.slotAssignments[sourceIndex];
    draft.slotAssignments[sourceIndex] = draft.slotAssignments[targetIndex];
    draft.slotAssignments[targetIndex] = sourcePhoto;
    draft.selectedSlotIndex = targetIndex;
    draft.activeSelectionType = "slot";
  });
}

function handleSlotDrop(event, targetIndex) {
  suppressSlotClickUntil = Date.now() + 180;
  const source = event.dataTransfer?.getData("text/source");
  if (source === "library") {
    const photoId = event.dataTransfer?.getData("text/photo-id");
    if (photoId) applySlotPhoto(targetIndex, photoId);
    return;
  }
  if (source === "slot") {
    const sourceIndex = Number(event.dataTransfer?.getData("text/slot-index"));
    if (Number.isInteger(sourceIndex) && sourceIndex !== targetIndex) swapSlots(sourceIndex, targetIndex);
  }
}

function setPendingSlotAssignment(slotIndex) {
  pendingSlotAssignment = {
    slotIndex,
    expiresAt: Date.now() + 120000,
  };
}

async function chooseImageForEmptySlot(slotIndex, options = {}) {
  setPendingSlotAssignment(slotIndex);
  setState((draft) => {
    draft.selectedSlotIndex = slotIndex;
    draft.selectedPhotoId = null;
    draft.activeSelectionType = "slot";
  }, { trackHistory: false, renderMode: "editor" });

  if (options.source === "mobile") {
    mobileView = "editor";
    mobileTool = "layer";
    renderMobileShell();
    return;
  }

  photoInput.click();
}

function clearSelection() {
  setState((draft) => {
    draft.activeSelectionType = "";
  }, { trackHistory: false });
}

function deleteCurrentSelection() {
  const selection = getActiveSelection();
  if (!selection) return;
  if (selection.type === "slot") {
    setState((draft) => {
      delete draft.slotAssignments[draft.selectedSlotIndex];
      draft.slotEdits[draft.selectedSlotIndex] = { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    });
    return;
  }
  if (selection.type === "text") {
    const currentText = getCurrentText();
    if (!currentText) return;
    setState((draft) => {
      draft.texts = draft.texts.filter((item) => item.id !== currentText.id);
      draft.selectedTextId = draft.texts[0]?.id || null;
      draft.activeSelectionType = draft.texts.length ? "text" : "slot";
    });
    return;
  }
  if (selection.type === "sticker") {
    const currentSticker = getCurrentSticker();
    if (!currentSticker) return;
    setState((draft) => {
      draft.stickers = draft.stickers.filter((item) => item.id !== currentSticker.id);
      draft.selectedStickerId = draft.stickers[0]?.id || null;
      draft.activeSelectionType = draft.stickers.length ? "sticker" : "slot";
    });
    return;
  }
  if (selection.type === "drawing") {
    clearDrawingAllSurfaces();
    setState((draft) => {
      draft.drawingDataUrl = "";
      draft.drawingLayer = null;
      draft.activeSelectionType = "slot";
    });
  }
}

function confirmDeleteCurrentSelection() {
  const selection = getActiveSelection();
  if (!selection) return;
  const label = getDeleteLabel().toLowerCase();
  if (!window.confirm(`Yakin ${label}?`)) return;
  deleteCurrentSelection();
}

function deleteCurrentTextLayer() {
  const currentText = getCurrentText();
  if (!currentText) return;
  setState((draft) => {
    draft.texts = draft.texts.filter((item) => item.id !== currentText.id);
    draft.selectedTextId = draft.texts[0]?.id || null;
    draft.activeSelectionType = draft.texts.length ? "text" : "slot";
  });
}

function deleteCurrentStickerLayer() {
  const currentSticker = getCurrentSticker();
  if (!currentSticker) return;
  setState((draft) => {
    draft.stickers = draft.stickers.filter((item) => item.id !== currentSticker.id);
    draft.selectedStickerId = draft.stickers[0]?.id || null;
    draft.activeSelectionType = draft.stickers.length ? "sticker" : "slot";
  });
}

function deleteActiveOverlayLayer() {
  if (state.activeSelectionType === "text") {
    deleteCurrentTextLayer();
    return;
  }
  if (state.activeSelectionType === "sticker") {
    deleteCurrentStickerLayer();
    return;
  }
  if (state.activeSelectionType === "drawing") {
    clearDrawingAllSurfaces();
    setState((draft) => {
      draft.drawingDataUrl = "";
      draft.drawingLayer = null;
      draft.activeSelectionType = "slot";
    });
  }
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(a, b) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function editTextLayerInline(textId, targetNode = null) {
  const text = state.texts.find((item) => item.id === textId);
  if (!text) return;
  const node = targetNode || document.querySelector(`.text-layer[data-text-id="${textId}"]`);
  if (!node) return;
  activeDrag = null;
  setState((draft) => {
    draft.selectedTextId = textId;
    draft.activeSelectionType = "text";
  }, { trackHistory: false, renderMode: "none" });
  node.classList.add("is-editing");
  node.contentEditable = "true";
  node.spellcheck = false;
  node.focus({ preventScroll: true });

  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const finish = ({ save = true } = {}) => {
    const nextText = node.textContent.trim();
    node.contentEditable = "false";
    node.classList.remove("is-editing");
    node.removeEventListener("blur", handleBlur);
    node.removeEventListener("keydown", handleKeydown);
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === textId);
      if (!current) return;
      current.text = save && nextText ? nextText : text.text;
      draft.selectedTextId = textId;
      draft.activeSelectionType = "text";
    });
  };

  const handleBlur = () => finish({ save: true });
  const handleKeydown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finish({ save: true });
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish({ save: false });
    }
  };

  node.addEventListener("blur", handleBlur);
  node.addEventListener("keydown", handleKeydown);
}

function openMobileTextEditor(textId) {
  const textNode = mobileEditorPreview?.querySelector(`.text-layer[data-text-id="${textId}"]`);
  if (textNode) {
    editTextLayerInline(textId, textNode);
    return;
  }
  renderEditorSurfacesOnly();
  window.requestAnimationFrame(() => {
    const fallbackNode = mobileEditorPreview?.querySelector(`.text-layer[data-text-id="${textId}"]`);
    if (fallbackNode) editTextLayerInline(textId, fallbackNode);
  });
}

function setupTextInteractions(node, textId, stageElement = editorStage) {
  const pointers = new Map();

  node.addEventListener("pointerdown", (event) => {
    if (state.drawingEnabled) return;
    if (node.isContentEditable) return;
    if (event.detail >= 2) {
      event.preventDefault();
      event.stopPropagation();
      if (event.pointerType === "touch" || stageElement === mobileEditorPreview) {
        openMobileTextEditor(textId);
      } else {
        editTextLayerInline(textId, node);
      }
      return;
    }
    event.preventDefault();
    const text = state.texts.find((item) => item.id === textId);
    if (!text) return;
    const rect = stageElement.getBoundingClientRect();
    pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    node.setPointerCapture(event.pointerId);
    setState((draft) => {
      draft.selectedTextId = textId;
      draft.activeSelectionType = "text";
    }, { trackHistory: false, renderMode: "none" });
    refreshStageSelectionClasses(stageElement);
    applySelectionActionsVisibility();
    renderSelectionFrame(stageElement);
    if (pointers.size === 1) {
      activeDrag = {
        kind: "text-drag",
        targetId: textId,
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left - text.x * rect.width,
        offsetY: event.clientY - rect.top - text.y * rect.height,
      };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      activeDrag = {
        kind: "text-pinch",
        targetId: textId,
        startDistance: distanceBetween(a, b),
        startSize: text.size,
        startAngle: angleBetween(a, b),
        startRotation: text.rotation || 0,
      };
    }
  });

  node.addEventListener("pointermove", (event) => {
    if (node.isContentEditable) return;
    const rect = stageElement.getBoundingClientRect();
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    if (!activeDrag || activeDrag.targetId !== textId) return;
    if (activeDrag.kind === "text-drag" && activeDrag.pointerId === event.pointerId) {
      event.preventDefault();
      const x = (event.clientX - rect.left - activeDrag.offsetX) / rect.width;
      const y = (event.clientY - rect.top - activeDrag.offsetY) / rect.height;
      setState((draft) => {
        const current = draft.texts.find((item) => item.id === textId);
        if (!current) return;
        current.x = clamp(x, 0.05, 0.95);
        current.y = clamp(y, 0.05, 0.95);
      }, { trackHistory: false, renderMode: "none" });
      const current = state.texts.find((item) => item.id === textId);
      if (current) {
        node.style.left = `${current.x * 100}%`;
        node.style.top = `${current.y * 100}%`;
      }
      renderSelectionFrame(stageElement);
    }
    if (activeDrag.kind === "text-pinch" && pointers.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      const ratio = distanceBetween(a, b) / Math.max(1, activeDrag.startDistance);
      const nextAngle = angleBetween(a, b);
      setState((draft) => {
        const current = draft.texts.find((item) => item.id === textId);
        if (!current) return;
        current.size = clamp(activeDrag.startSize * ratio, 16, 140);
        current.rotation = activeDrag.startRotation + (nextAngle - activeDrag.startAngle);
      }, { trackHistory: false, renderMode: "none" });
      const current = state.texts.find((item) => item.id === textId);
      if (current) {
        node.style.fontSize = `${current.size}px`;
        node.style.transform = textTransform(current);
      }
      renderSelectionFrame(stageElement);
    }
  });

  const finish = (event) => {
    if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
    pointers.delete(event.pointerId);
    if (!activeDrag || activeDrag.targetId !== textId) return;
    if (activeDrag.kind === "text-drag" && activeDrag.pointerId !== event.pointerId) return;
    if (pointers.size < 2 && activeDrag.kind === "text-pinch") {
      activeDrag = null;
      pushHistory();
      renderAll();
      return;
    }
    if (pointers.size === 0) {
      activeDrag = null;
      pushHistory();
      renderAll();
    }
  };

  node.addEventListener("pointerup", finish);
  node.addEventListener("pointercancel", finish);
  node.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    editTextLayerInline(textId, node);
  });
}

function setupStickerInteractions(node, stickerId, stageElement = editorStage) {
  const pointers = new Map();

  node.addEventListener("pointerdown", (event) => {
    if (state.drawingEnabled) return;
    event.preventDefault();
    const sticker = state.stickers.find((item) => item.id === stickerId);
    if (!sticker) return;
    const rect = stageElement.getBoundingClientRect();
    pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    node.setPointerCapture(event.pointerId);
    setState((draft) => {
      draft.selectedStickerId = stickerId;
      draft.activeSelectionType = "sticker";
    }, { trackHistory: false, renderMode: "none" });
    refreshStageSelectionClasses(stageElement);
    applySelectionActionsVisibility();
    renderSelectionFrame(stageElement);
    if (pointers.size === 1) {
      activeDrag = {
        kind: "sticker-drag",
        targetId: stickerId,
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left - sticker.x * rect.width,
        offsetY: event.clientY - rect.top - sticker.y * rect.height,
      };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      activeDrag = {
        kind: "sticker-pinch",
        targetId: stickerId,
        startDistance: distanceBetween(a, b),
        startSize: sticker.size,
        startAngle: angleBetween(a, b),
        startRotation: sticker.rotation,
      };
    }
  });

  node.addEventListener("pointermove", (event) => {
    const rect = stageElement.getBoundingClientRect();
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    if (!activeDrag || activeDrag.targetId !== stickerId) return;
    if (activeDrag.kind === "sticker-drag" && activeDrag.pointerId === event.pointerId) {
      event.preventDefault();
      const x = (event.clientX - rect.left - activeDrag.offsetX) / rect.width;
      const y = (event.clientY - rect.top - activeDrag.offsetY) / rect.height;
      setState((draft) => {
        const current = draft.stickers.find((item) => item.id === stickerId);
        if (!current) return;
        current.x = clamp(x, 0.05, 0.95);
        current.y = clamp(y, 0.05, 0.95);
      }, { trackHistory: false, renderMode: "none" });
      const current = state.stickers.find((item) => item.id === stickerId);
      if (current) {
        node.style.left = `${current.x * 100}%`;
        node.style.top = `${current.y * 100}%`;
      }
      renderSelectionFrame(stageElement);
    }
    if (activeDrag.kind === "sticker-pinch" && pointers.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      const ratio = distanceBetween(a, b) / Math.max(1, activeDrag.startDistance);
      const nextAngle = angleBetween(a, b);
      setState((draft) => {
        const current = draft.stickers.find((item) => item.id === stickerId);
        if (!current) return;
        current.size = clamp(activeDrag.startSize * ratio, 24, 220);
        current.rotation = activeDrag.startRotation + (nextAngle - activeDrag.startAngle);
      }, { trackHistory: false, renderMode: "none" });
      const current = state.stickers.find((item) => item.id === stickerId);
      if (current) {
        node.style.fontSize = `${current.size}px`;
        node.style.width = `${current.size}px`;
        node.style.height = `${current.size}px`;
        node.style.transform = stickerTransform(current);
      }
      renderSelectionFrame(stageElement);
    }
  });

  const finish = (event) => {
    if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
    pointers.delete(event.pointerId);
    if (!activeDrag || activeDrag.targetId !== stickerId) return;
    if (activeDrag.kind === "sticker-drag" && activeDrag.pointerId !== event.pointerId) return;
    if (pointers.size < 2 && activeDrag.kind === "sticker-pinch") {
      activeDrag = null;
      pushHistory();
      renderAll();
      return;
    }
    if (pointers.size === 0) {
      activeDrag = null;
      pushHistory();
      renderAll();
    }
  };

  node.addEventListener("pointerup", finish);
  node.addEventListener("pointercancel", finish);
  node.addEventListener("dblclick", () => deleteCurrentSelection());
}

function setupSlotGesture(node, slotIndex, stageElement = editorStage) {
  const pointers = new Map();
  let longPressTimer = null;
  const clearLongPress = () => {
    if (!longPressTimer) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  node.addEventListener("pointerdown", (event) => {
    setState((draft) => {
      draft.selectedSlotIndex = slotIndex;
      draft.selectedPhotoId = draft.slotAssignments[slotIndex] || null;
      draft.activeSelectionType = "slot";
    }, { trackHistory: false, renderMode: "none" });
    refreshStageSelectionClasses(stageElement);
    syncInputs();

    const photo = getPhotoById(state.slotAssignments[slotIndex]);
    if (!photo) return;
    event.preventDefault();
    const rect = stageElement.getBoundingClientRect();
    pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    node.setPointerCapture(event.pointerId);
    if (pointers.size === 1 && event.pointerType === "touch") {
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        if (pointers.size !== 1 || !state.slotAssignments[slotIndex]) return;
        setState((draft) => {
          draft.selectedSlotIndex = slotIndex;
          draft.selectedPhotoId = draft.slotAssignments[slotIndex] || null;
          draft.activeSelectionType = "slot";
        }, { trackHistory: false, renderMode: "all" });
        if (window.confirm(`Hapus foto dari Frame ${slotIndex + 1}?`)) {
          deleteCurrentSelection();
        }
      }, 650);
    } else {
      clearLongPress();
    }
    if (pointers.size === 1) {
      const edit = getSlotEdit(slotIndex);
      activeDrag = {
        kind: "slot-pan",
        slotIndex,
        pointerId: event.pointerId,
        startOffsetX: edit.offsetX,
        startOffsetY: edit.offsetY,
        startX: event.clientX,
        startY: event.clientY,
      };
    }
    if (pointers.size === 2) {
      clearLongPress();
      const [a, b] = [...pointers.values()];
      activeDrag = {
        kind: "slot-pinch",
        slotIndex,
        startDistance: distanceBetween(a, b),
        startZoom: getSlotEdit(slotIndex).zoom,
        startAngle: angleBetween(a, b),
        startRotation: getSlotEdit(slotIndex).rotation || 0,
      };
    }
  });

  node.addEventListener("pointermove", (event) => {
    const rect = stageElement.getBoundingClientRect();
    clearLongPress();
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (!activeDrag || activeDrag.slotIndex !== slotIndex) return;
    if (activeDrag.kind === "slot-pan" && activeDrag.pointerId === event.pointerId) {
      event.preventDefault();
      const deltaX = (event.clientX - activeDrag.startX) / rect.width;
      const deltaY = (event.clientY - activeDrag.startY) / rect.height;
      setState((draft) => {
        draft.slotEdits[slotIndex] = {
          ...getSlotEdit(slotIndex, draft),
          offsetX: clamp(activeDrag.startOffsetX + deltaX, -0.6, 0.6),
          offsetY: clamp(activeDrag.startOffsetY + deltaY, -0.6, 0.6),
        };
      }, { trackHistory: false, renderMode: "none" });
      const latestEdit = getSlotEdit(slotIndex);
      const imageNode = node.querySelector(".slot__image");
      if (imageNode) {
        imageNode.style.transform = slotImageTransform(latestEdit);
      }
    }
    if (activeDrag.kind === "slot-pinch" && pointers.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      const ratio = distanceBetween(a, b) / Math.max(1, activeDrag.startDistance);
      const nextAngle = angleBetween(a, b);
      setState((draft) => {
        draft.slotEdits[slotIndex] = {
          ...getSlotEdit(slotIndex, draft),
          zoom: clamp(activeDrag.startZoom * ratio, 0.6, 3),
          rotation: activeDrag.startRotation + (nextAngle - activeDrag.startAngle),
        };
      }, { trackHistory: false, renderMode: "none" });
      const latestEdit = getSlotEdit(slotIndex);
      const imageNode = node.querySelector(".slot__image");
      if (imageNode) {
        imageNode.style.transform = slotImageTransform(latestEdit);
      }
    }
  });

  const finish = (event) => {
    clearLongPress();
    if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
    pointers.delete(event.pointerId);
    if (!activeDrag || activeDrag.slotIndex !== slotIndex) return;
    if (activeDrag.kind === "slot-pan" && activeDrag.pointerId !== event.pointerId) return;
    if (pointers.size < 2 && activeDrag.kind === "slot-pinch") {
      activeDrag = null;
      pushHistory();
      renderAll();
      return;
    }
    if (pointers.size === 0) {
      activeDrag = null;
      pushHistory();
      renderAll();
    }
  };

  node.addEventListener("pointerup", finish);
  node.addEventListener("pointercancel", finish);
}

function handleGlobalTransformDrag(event) {
  if (!activeDrag || !activeDrag.stageElement) return;
  if (activeDrag.pointerId !== undefined && event.pointerId !== undefined && activeDrag.pointerId !== event.pointerId) return;
  const stageRect = activeDrag.stageElement.getBoundingClientRect();
  const pointer = { x: event.clientX - stageRect.left, y: event.clientY - stageRect.top };

  if (activeDrag.kind === "layer-drag") {
    event.preventDefault();
    const movedDistance = Math.hypot(event.clientX - activeDrag.startClientX, event.clientY - activeDrag.startClientY);
    if (!activeDrag.moved && movedDistance < 5) return;
    activeDrag.moved = true;
    const nextX = clamp((event.clientX - stageRect.left - activeDrag.offsetX) / Math.max(1, stageRect.width), 0.04, 0.96);
    const nextY = clamp((event.clientY - stageRect.top - activeDrag.offsetY) / Math.max(1, stageRect.height), 0.04, 0.96);
    setState((draft) => {
      const current = activeDrag.type === "drawing"
        ? draft.drawingLayer
        : (activeDrag.type === "text" ? draft.texts : draft.stickers).find((item) => item.id === activeDrag.targetId);
      if (!current) return;
      current.x = nextX;
      current.y = nextY;
    }, { trackHistory: false, renderMode: "none" });
    const nodeSelector = activeDrag.type === "text"
      ? `.text-layer[data-text-id="${activeDrag.targetId}"]`
      : activeDrag.type === "sticker"
        ? `.sticker-instance[data-sticker-id="${activeDrag.targetId}"]`
        : ".drawing-preview";
    const node = activeDrag.stageElement.querySelector(nodeSelector);
    if (node) {
      node.style.left = `${nextX * 100}%`;
      node.style.top = `${nextY * 100}%`;
    }
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "global-slot-resize") {
    event.preventDefault();
    const slotIndex = activeDrag.slotIndex;
    const deltaX = (event.clientX - activeDrag.startX) / Math.max(1, stageRect.width);
    const deltaY = (event.clientY - activeDrag.startY) / Math.max(1, stageRect.height);
    setState((draft) => {
      const current = draft.templateSlots[slotIndex];
      if (!current) return;
      const bounds = getResizeBounds(draft.templateSlots, slotIndex);
      const { xCandidates, yCandidates } = getResizeSnapCandidates(draft.templateSlots, slotIndex);
      const nextWidth = clamp(activeDrag.startWidth + deltaX, 0.14, Math.min(1 - current.x, bounds.maxWidth));
      const nextHeight = clamp(activeDrag.startHeight + deltaY, 0.14, Math.min(1 - current.y, bounds.maxHeight));
      current.width = snapValue(nextWidth, xCandidates);
      current.height = snapValue(nextHeight, yCandidates);
    }, { trackHistory: false, renderMode: "none" });
    const latest = state.templateSlots[slotIndex];
    if (latest && activeDrag.slotNode) {
      const gapPxX = (state.gap / 100) * stageRect.width * 0.5;
      const gapPxY = (state.gap / 100) * stageRect.height * 0.5;
      activeDrag.slotNode.style.width = `${Math.max(30, latest.width * stageRect.width - gapPxX)}px`;
      activeDrag.slotNode.style.height = `${Math.max(30, latest.height * stageRect.height - gapPxY)}px`;
    }
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind.endsWith("-stretch-x-handle") || activeDrag.kind.endsWith("-stretch-y-handle")) {
    event.preventDefault();
    const axis = activeDrag.kind.includes("-stretch-x-") ? "x" : "y";
    const pointerDistance = axis === "x"
      ? Math.abs(pointer.x - activeDrag.center.x)
      : Math.abs(pointer.y - activeDrag.center.y);
    const startDistance = Math.max(1, axis === "x"
      ? Math.abs(activeDrag.startPointer.x - activeDrag.center.x)
      : Math.abs(activeDrag.startPointer.y - activeDrag.center.y));
    const ratio = pointerDistance / startDistance;
    const nextScale = clamp((axis === "x" ? activeDrag.startScaleX : activeDrag.startScaleY) * ratio, 0.25, 3.5);

    setState((draft) => {
      if (activeDrag.kind.startsWith("text-")) {
        const current = draft.texts.find((item) => item.id === activeDrag.targetId);
        if (current) current[axis === "x" ? "scaleX" : "scaleY"] = nextScale;
      }
      if (activeDrag.kind.startsWith("sticker-")) {
        const current = draft.stickers.find((item) => item.id === activeDrag.targetId);
        if (current) current[axis === "x" ? "scaleX" : "scaleY"] = nextScale;
      }
      if (activeDrag.kind.startsWith("slot-")) {
        const edit = getSlotEdit(activeDrag.targetId, draft);
        draft.slotEdits[activeDrag.targetId] = {
          ...edit,
          [axis === "x" ? "scaleX" : "scaleY"]: nextScale,
        };
      }
      if (activeDrag.kind.startsWith("drawing-") && draft.drawingLayer) {
        draft.drawingLayer[axis === "x" ? "scaleX" : "scaleY"] = nextScale;
      }
    }, { trackHistory: false, renderMode: "none" });

    if (activeDrag.kind.startsWith("text-")) {
      const node = activeDrag.stageElement.querySelector(`.text-layer[data-text-id="${activeDrag.targetId}"]`);
      const current = state.texts.find((item) => item.id === activeDrag.targetId);
      if (node && current) node.style.transform = textTransform(current);
    }
    if (activeDrag.kind.startsWith("sticker-")) {
      const node = activeDrag.stageElement.querySelector(`.sticker-instance[data-sticker-id="${activeDrag.targetId}"]`);
      const current = state.stickers.find((item) => item.id === activeDrag.targetId);
      if (node && current) node.style.transform = stickerTransform(current);
    }
    if (activeDrag.kind.startsWith("slot-")) {
      const node = activeDrag.stageElement.querySelector(`.slot[data-slot-index="${activeDrag.targetId}"] .slot__image`);
      const latestEdit = getSlotEdit(activeDrag.targetId);
      if (node) node.style.transform = slotImageTransform(latestEdit);
    }
    if (activeDrag.kind.startsWith("drawing-")) {
      const node = activeDrag.stageElement.querySelector(".drawing-preview");
      if (node && state.drawingLayer) node.style.transform = drawingTransform(state.drawingLayer);
    }
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "text-scale-handle") {
    event.preventDefault();
    const ratio = distanceBetween(activeDrag.center, pointer) / Math.max(1, activeDrag.startDistance);
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === activeDrag.targetId);
      if (!current) return;
      current.size = clamp(activeDrag.startSize * ratio, 16, 160);
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(`.text-layer[data-text-id="${activeDrag.targetId}"]`);
    const current = state.texts.find((item) => item.id === activeDrag.targetId);
    if (node && current) node.style.fontSize = `${current.size}px`;
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "text-rotate-handle") {
    event.preventDefault();
    const nextAngle = angleBetween(activeDrag.center, pointer);
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === activeDrag.targetId);
      if (!current) return;
      current.rotation = activeDrag.startRotation + (nextAngle - activeDrag.startAngle);
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(`.text-layer[data-text-id="${activeDrag.targetId}"]`);
    const current = state.texts.find((item) => item.id === activeDrag.targetId);
    if (node && current) node.style.transform = textTransform(current);
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "sticker-scale-handle") {
    event.preventDefault();
    const ratio = distanceBetween(activeDrag.center, pointer) / Math.max(1, activeDrag.startDistance);
    setState((draft) => {
      const current = draft.stickers.find((item) => item.id === activeDrag.targetId);
      if (!current) return;
      current.size = clamp(activeDrag.startSize * ratio, 24, 220);
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(`.sticker-instance[data-sticker-id="${activeDrag.targetId}"]`);
    const current = state.stickers.find((item) => item.id === activeDrag.targetId);
    if (node && current) {
      node.style.fontSize = `${current.size}px`;
      node.style.width = `${current.size}px`;
      node.style.height = `${current.size}px`;
    }
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "sticker-rotate-handle") {
    event.preventDefault();
    const nextAngle = angleBetween(activeDrag.center, pointer);
    setState((draft) => {
      const current = draft.stickers.find((item) => item.id === activeDrag.targetId);
      if (!current) return;
      current.rotation = activeDrag.startRotation + (nextAngle - activeDrag.startAngle);
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(`.sticker-instance[data-sticker-id="${activeDrag.targetId}"]`);
    const current = state.stickers.find((item) => item.id === activeDrag.targetId);
    if (node && current) node.style.transform = stickerTransform(current);
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "slot-scale-handle") {
    event.preventDefault();
    const ratio = distanceBetween(activeDrag.center, pointer) / Math.max(1, activeDrag.startDistance);
    setState((draft) => {
      const edit = getSlotEdit(activeDrag.targetId, draft);
      draft.slotEdits[activeDrag.targetId] = {
        ...edit,
        zoom: clamp(activeDrag.startSize * ratio, 0.6, 3),
      };
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(`.slot[data-slot-index="${activeDrag.targetId}"] .slot__image`);
    const latestEdit = getSlotEdit(activeDrag.targetId);
    if (node) node.style.transform = slotImageTransform(latestEdit);
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "slot-rotate-handle") {
    event.preventDefault();
    const nextAngle = angleBetween(activeDrag.center, pointer);
    setState((draft) => {
      const edit = getSlotEdit(activeDrag.targetId, draft);
      draft.slotEdits[activeDrag.targetId] = {
        ...edit,
        rotation: activeDrag.startRotation + (nextAngle - activeDrag.startAngle),
      };
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(`.slot[data-slot-index="${activeDrag.targetId}"] .slot__image`);
    const latestEdit = getSlotEdit(activeDrag.targetId);
    if (node) node.style.transform = slotImageTransform(latestEdit);
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "drawing-scale-handle") {
    event.preventDefault();
    const ratio = distanceBetween(activeDrag.center, pointer) / Math.max(1, activeDrag.startDistance);
    const nextScale = clamp(activeDrag.startScaleX * ratio, 0.2, 4);
    setState((draft) => {
      if (!draft.drawingLayer) return;
      draft.drawingLayer.scaleX = nextScale;
      draft.drawingLayer.scaleY = clamp(activeDrag.startScaleY * ratio, 0.2, 4);
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(".drawing-preview");
    if (node && state.drawingLayer) node.style.transform = drawingTransform(state.drawingLayer);
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
    return;
  }

  if (activeDrag.kind === "drawing-rotate-handle") {
    event.preventDefault();
    const nextAngle = angleBetween(activeDrag.center, pointer);
    setState((draft) => {
      if (!draft.drawingLayer) return;
      draft.drawingLayer.rotation = activeDrag.startRotation + (nextAngle - activeDrag.startAngle);
    }, { trackHistory: false, renderMode: "none" });
    const node = activeDrag.stageElement.querySelector(".drawing-preview");
    if (node && state.drawingLayer) node.style.transform = drawingTransform(state.drawingLayer);
    renderSelectionFrame(activeDrag.stageElement);
    positionSelectionActions(activeDrag.stageElement, activeDrag.stageElement === editorStage ? selectionActions : mobileSelectionActions);
  }
}

function finishGlobalTransformDrag() {
  if (!activeDrag) return;
  if (!String(activeDrag.kind).endsWith("-handle") && activeDrag.kind !== "layer-drag" && activeDrag.kind !== "global-slot-resize") return;
  const finishedDrag = activeDrag;
  if (activeDrag.stageElement?.hasPointerCapture?.(activeDrag.pointerId)) {
    activeDrag.stageElement.releasePointerCapture(activeDrag.pointerId);
  }
  activeDrag = null;
  if (finishedDrag.kind === "layer-drag" && finishedDrag.type === "text" && !finishedDrag.moved) {
    const isMobileTextTap = finishedDrag.pointerType === "touch" || finishedDrag.stageElement === mobileEditorPreview;
    if (isMobileTextTap) {
      openMobileTextEditor(finishedDrag.targetId);
    } else {
      editTextLayerInline(finishedDrag.targetId, finishedDrag.layerNode);
    }
    return;
  }
  pushHistory();
  renderAll();
}

function startStagePointerInteraction(stageElement, event) {
  if (!stageElement || state.drawingEnabled) return;
  if (event.target?.isContentEditable || event.target?.closest?.(".text-layer.is-editing")) return;
  if (event.target.closest(".selection-actions, .mobile-controls, .desktop-right-panel, .mobile-tabs")) return;

  const resizeTarget = event.target.closest(".slot__resize");
  if (resizeTarget) {
    const slotNode = resizeTarget.closest(".slot");
    const slotIndex = Number(slotNode?.dataset.slotIndex);
    const slot = state.templateSlots[slotIndex];
    if (!slot || !Number.isInteger(slotIndex)) return;
    event.preventDefault();
    event.stopPropagation();
    stageElement.setPointerCapture?.(event.pointerId);
    activeDrag = {
      kind: "global-slot-resize",
      pointerId: event.pointerId,
      stageElement,
      slotNode,
      slotIndex,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: slot.width,
      startHeight: slot.height,
    };
    return;
  }

  const textNode = event.target.closest(".text-layer");
  const stickerNode = event.target.closest(".sticker-instance");
  const drawingNode = event.target.closest(".drawing-preview");
  const layerNode = textNode || stickerNode || drawingNode;
  if (!layerNode) {
    if (!event.target.closest(".slot, .selection-frame, .transform-handle")) {
      clearSelection();
    }
    return;
  }

  const type = textNode ? "text" : stickerNode ? "sticker" : "drawing";
  const id = textNode ? textNode.dataset.textId : stickerNode ? stickerNode.dataset.stickerId : "drawing-layer";
  if (type === "text" && event.detail >= 2) {
    event.preventDefault();
    event.stopPropagation();
    if (event.pointerType === "touch" || stageElement === mobileEditorPreview) {
      openMobileTextEditor(id);
    } else {
      editTextLayerInline(id, textNode);
    }
    return;
  }
  const item = type === "text"
    ? state.texts.find((entry) => entry.id === id)
    : type === "sticker"
      ? state.stickers.find((entry) => entry.id === id)
      : state.drawingLayer;
  if (!item) return;

  event.preventDefault();
  event.stopPropagation();
  stageElement.setPointerCapture?.(event.pointerId);
  const rect = stageElement.getBoundingClientRect();
  setState((draft) => {
    draft.activeSelectionType = type;
    if (type === "text") draft.selectedTextId = id;
    if (type === "sticker") draft.selectedStickerId = id;
  }, { trackHistory: false, renderMode: "none" });
  refreshStageSelectionClasses(stageElement);
  applySelectionActionsVisibility();

  activeDrag = {
    kind: "layer-drag",
    pointerId: event.pointerId,
    stageElement,
    layerNode,
    pointerType: event.pointerType || "mouse",
    type,
    targetId: id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
    offsetX: event.clientX - rect.left - item.x * rect.width,
    offsetY: event.clientY - rect.top - item.y * rect.height,
  };
  renderSelectionFrame(stageElement);
}

function setupDrawingSurface(canvas) {
  if (!canvas) return;

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.drawingEnabled) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = state.brush.eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = state.brush.eraser ? "rgba(0,0,0,1)" : state.brush.color;
    ctx.lineWidth = state.brush.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawStates.set(canvas, {
      pointerId: event.pointerId,
      prevX: event.clientX - rect.left,
      prevY: event.clientY - rect.top,
    });
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    const drawState = drawStates.get(canvas);
    if (!state.drawingEnabled || !drawState || drawState.pointerId !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(drawState.prevX, drawState.prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawState.prevX = x;
    drawState.prevY = y;
  });

  const finish = (event) => {
    const drawState = drawStates.get(canvas);
    if (!drawState || drawState.pointerId !== event.pointerId) return;
    const dataUrl = canvas.toDataURL("image/png");
    state.drawingDataUrl = dataUrl;
    state.drawingLayer = {
      id: "drawing-layer",
      x: state.drawingLayer?.x ?? 0.5,
      y: state.drawingLayer?.y ?? 0.5,
      width: state.drawingLayer?.width ?? 1,
      height: state.drawingLayer?.height ?? 1,
      rotation: state.drawingLayer?.rotation ?? 0,
      scaleX: state.drawingLayer?.scaleX ?? 1,
      scaleY: state.drawingLayer?.scaleY ?? 1,
      dataUrl,
    };
    state.activeSelectionType = "drawing";
    drawStates.delete(canvas);
    pushHistory();
    renderAll();
  };

  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
}

function clearDrawingAllSurfaces() {
  const clearSurface = (canvas) => {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawStates.delete(canvas);
  };
  clearSurface(drawingCanvas);
  clearSurface(mobileDrawingCanvas);
}

function populateFonts() {
  const options = fontChoices.map((font) => {
    const option = document.createElement("option");
    option.value = font;
    option.textContent = font;
    return option;
  });
  textFontInput.replaceChildren(...options.map((item) => item.cloneNode(true)));
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList).filter((file) => file.type.startsWith("image/")).slice(0, 8);
  if (!files.length) return [];
  const photoEntries = await Promise.all(
    files.map(async (file) => ({
      id: uid("photo"),
      name: file.name,
      dataUrl: await fileToDataUrl(file),
    })),
  );
  setState((draft) => {
    draft.photos = [...draft.photos, ...photoEntries];
    draft.selectedPhotoId = photoEntries[0]?.id || draft.selectedPhotoId;
    if (!pendingSlotAssignment) autoLayoutUploadedPhotos(photoEntries, draft);
  });
  return photoEntries;
}

function setupMobilePullToRefresh() {
  if (!mobileShells) return;
  let pull = null;
  const isEditableTarget = (target) => Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
  const canStartPull = (event) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return false;
    if (event.touches.length !== 1) return false;
    if (isEditableTarget(event.target)) return false;
    if (event.target?.closest?.(".editor-stage, .selection-actions, .transform-frame, .slot, .text-layer, .sticker-instance")) return false;
    const scrollable = event.target?.closest?.(".mobile-controls, .phone-stage, .mobile-share-options");
    if (scrollable && scrollable.scrollTop > 0) return false;
    return window.scrollY <= 2 && document.documentElement.scrollTop <= 2;
  };
  const refreshMobileView = () => {
    mobileShells.classList.add("is-refreshing");
    refreshSavedProjects()
      .catch(console.error)
      .finally(() => {
        renderAll();
        window.setTimeout(() => mobileShells.classList.remove("is-refreshing"), 350);
      });
  };

  window.addEventListener("touchstart", (event) => {
    if (!canStartPull(event)) return;
    pull = { startY: event.touches[0].clientY, triggered: false };
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    if (!pull || event.touches.length !== 1) return;
    const deltaY = event.touches[0].clientY - pull.startY;
    if (deltaY < 84 || pull.triggered) return;
    pull.triggered = true;
    event.preventDefault();
    refreshMobileView();
  }, { passive: false });

  window.addEventListener("touchend", () => { pull = null; }, { passive: true });
  window.addEventListener("touchcancel", () => { pull = null; }, { passive: true });
}

function isMobileControlEditing() {
  const active = document.activeElement;
  return Boolean(active?.closest?.("#mobileControls") && active.matches?.("input, textarea, select"));
}

function isMobileInlineTextEditing() {
  return Boolean(document.activeElement?.closest?.("#mobileEditorPreview .text-layer.is-editing"));
}

function setupEventListeners() {
  window.addEventListener("pointermove", (event) => {
    if (activeRightbarResize) {
      event.preventDefault();
      const delta = activeRightbarResize.startX - event.clientX;
      rightbarWidth = clamp(activeRightbarResize.startWidth + delta, 260, 560);
      rightbarCollapsed = false;
      applyRightbarLayout({ render: true });
      return;
    }
    if (!activeDrag || (!String(activeDrag.kind).endsWith("-handle") && activeDrag.kind !== "layer-drag" && activeDrag.kind !== "global-slot-resize")) return;
    handleGlobalTransformDrag(event);
  });
  window.addEventListener("pointerup", () => {
    if (activeRightbarResize) {
      activeRightbarResize = null;
      rightbarResizeHandle?.classList.remove("is-dragging");
      applyRightbarLayout({ render: true });
      return;
    }
    finishGlobalTransformDrag();
  });
  window.addEventListener("pointercancel", () => {
    if (activeRightbarResize) {
      activeRightbarResize = null;
      rightbarResizeHandle?.classList.remove("is-dragging");
      applyRightbarLayout({ render: true });
      return;
    }
    finishGlobalTransformDrag();
  });
  window.addEventListener("keydown", (event) => {
    if (!["Delete", "Backspace"].includes(event.key)) return;
    const target = event.target;
    if (target?.matches?.("input, textarea, select, [contenteditable='true']")) return;
    if (!getActiveSelection()) return;
    event.preventDefault();
    confirmDeleteCurrentSelection();
  });
  desktopCanvasZone?.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (event.target?.closest?.(".slot, .text-layer, .sticker-instance, .selection-actions, .transform-frame")) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.1 : 0.1;
    applyCanvasViewportZoom(canvasViewportZoom + direction);
  }, { passive: false });

  editorStage?.addEventListener("pointerdown", (event) => startStagePointerInteraction(editorStage, event), { capture: true });
  mobileEditorPreview?.addEventListener("pointerdown", (event) => startStagePointerInteraction(mobileEditorPreview, event), { capture: true });

  photoInput.addEventListener("change", async (event) => {
    const uploaded = await handleFiles(event.target.files);
    if (pendingSlotAssignment) {
      const pending = pendingSlotAssignment;
      pendingSlotAssignment = null;
      if (Date.now() <= pending.expiresAt && uploaded[0]) {
        applySlotPhoto(pending.slotIndex, uploaded[0].id);
      }
    }
    photoInput.value = "";
  });

  cameraButton.addEventListener("click", () => {
    if (!cameraInput) {
      cameraInput = document.createElement("input");
      cameraInput.type = "file";
      cameraInput.accept = "image/*";
      cameraInput.capture = "environment";
      cameraInput.multiple = true;
      cameraInput.addEventListener("change", async (event) => {
        await handleFiles(event.target.files);
        cameraInput.value = "";
      });
    }
    cameraInput.click();
  });

  refreshProjectsButton.addEventListener("click", () => refreshSavedProjects().catch(console.error));
  mobileRefreshProjectsButton?.addEventListener("click", () => refreshSavedProjects().catch(console.error));
  selectionCancelButton?.addEventListener("click", clearSelection);
  selectionDeleteButton?.addEventListener("click", confirmDeleteCurrentSelection);
  mobileSelectionCancelButton?.addEventListener("click", clearSelection);
  mobileSelectionDeleteButton?.addEventListener("click", confirmDeleteCurrentSelection);
  mobileUploadCard?.addEventListener("click", () => {
    photoInput.click();
  });
  mobileCameraButton?.addEventListener("click", () => {
    cameraButton.click();
  });
  mobileClearProjectButton?.addEventListener("click", () => {
    clearProjectButton.click();
  });
  mobileStatusButton?.addEventListener("click", showProjectStatus);
  mobileSettingsButton?.addEventListener("click", openSettingsView);
  mobileNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      mobileView = button.dataset.mobileView || "home";
      renderAll();
    });
  });
  mobileToolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      mobileTool = button.dataset.mobileTool || "sticker";
      if (mobileTool === "pointer") {
        setState((draft) => { draft.drawingEnabled = false; }, { trackHistory: false, renderMode: "editor" });
      }
      if (mobileTool === "draw") {
        setState((draft) => { draft.drawingEnabled = true; }, { trackHistory: false, renderMode: "editor" });
      }
      renderMobileShell();
    });
  });
  exportPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      exportPreset = button.dataset.exportPreset || "hd";
      renderMobileShell();
    });
  });
  mobileQualityToggleButton?.addEventListener("click", () => {
    exportPreset = exportPreset === "hd" ? "standard" : exportPreset === "standard" ? "web" : "hd";
    renderMobileShell();
  });
  shareTargetButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await handleShareTarget(button.dataset.shareTarget || "system");
      } catch (error) {
        console.error(error);
        window.alert("Gagal membagikan gambar. Coba lagi atau pilih Simpan.");
      }
    });
  });
  desktopToolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeDesktopTool = button.dataset.desktopTool || "media";
      if (activeDesktopTool === "pointer") {
        setState((draft) => { draft.drawingEnabled = false; }, { trackHistory: false, renderMode: "editor" });
      }
      if (activeDesktopTool === "draw") {
        setState((draft) => { draft.drawingEnabled = true; }, { trackHistory: false, renderMode: "editor" });
      }
      activePanelTab =
        activeDesktopTool === "filter" ? "filter" : activeDesktopTool === "layer" || activeDesktopTool === "text" ? "layer" : "props";
      scrollDesktopSection(activeDesktopTool);
      renderDesktopButtonStates();
    });
  });
  desktopTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activePanelTab = button.dataset.panelTab || "props";
      scrollDesktopSection(activePanelTab);
      renderDesktopButtonStates();
    });
  });
  rightbarToggleButton?.addEventListener("click", () => {
    rightbarCollapsed = !rightbarCollapsed;
    applyRightbarLayout({ render: true });
  });
  rightbarResizeHandle?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    rightbarCollapsed = false;
    activeRightbarResize = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: rightbarWidth,
    };
    rightbarResizeHandle.classList.add("is-dragging");
    rightbarResizeHandle.setPointerCapture(event.pointerId);
    applyRightbarLayout({ render: true });
  });
  canvasZoomOutButton?.addEventListener("click", () => {
    applyCanvasViewportZoom(canvasViewportZoom - 0.1);
  });
  canvasZoomInButton?.addEventListener("click", () => {
    applyCanvasViewportZoom(canvasViewportZoom + 0.1);
  });
  canvasZoomResetButton?.addEventListener("click", () => {
    applyCanvasViewportZoom(1);
  });
  mobileEditorBackButton?.addEventListener("click", () => {
    mobileView = "home";
    renderAll();
  });
  mobileShareBackButton?.addEventListener("click", () => {
    mobileView = "editor";
    renderAll();
  });
  mobileEditorUndoButton?.addEventListener("click", () => {
    undoButton.click();
  });
  mobileEditorExportButton?.addEventListener("click", async () => {
    try {
      await shareCompositePng();
    } catch (error) {
      console.error(error);
      window.alert("Export gagal. Coba lagi.");
    }
  });

  clearProjectButton.addEventListener("click", () => {
    if (!window.confirm("Reset semua isi project ini?")) return;
    applySnapshot(createDefaultState());
    history.length = 0;
    history.push(cloneState());
    future.length = 0;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    renderAll();
  });

  brightnessInput.addEventListener("input", (event) => {
    setState((draft) => { draft.filter.brightness = Number(event.target.value); }, { trackHistory: false });
  });
  contrastInput.addEventListener("input", (event) => {
    setState((draft) => { draft.filter.contrast = Number(event.target.value); }, { trackHistory: false });
  });
  saturateInput.addEventListener("input", (event) => {
    setState((draft) => { draft.filter.saturate = Number(event.target.value); }, { trackHistory: false });
  });
  blurInput.addEventListener("input", (event) => {
    setState((draft) => { draft.filter.blur = Number(event.target.value); }, { trackHistory: false });
  });
  resetFilterButton.addEventListener("click", () => {
    setState((draft) => { draft.filter = { preset: "normal", brightness: 100, contrast: 100, saturate: 100, blur: 0 }; });
  });

  backgroundColorInput.addEventListener("input", (event) => {
    setState((draft) => { draft.backgroundColor = event.target.value; }, { trackHistory: false });
  });
  gapInput.addEventListener("input", (event) => {
    setState((draft) => { draft.gap = Number(event.target.value); }, { trackHistory: false });
  });
  radiusInput.addEventListener("input", (event) => {
    setState((draft) => { draft.radius = Number(event.target.value); }, { trackHistory: false });
  });
  frameBorderEnabledInput.addEventListener("change", (event) => {
    setState((draft) => { draft.frameBorder.enabled = event.target.checked; }, { trackHistory: false });
  });
  frameBorderColorInput.addEventListener("input", (event) => {
    setState((draft) => { draft.frameBorder.color = event.target.value; }, { trackHistory: false });
  });
  frameBorderSizeInput.addEventListener("input", (event) => {
    setState((draft) => { draft.frameBorder.size = Number(event.target.value); }, { trackHistory: false });
  });
  frameBorderStyleInput.addEventListener("change", (event) => {
    setState((draft) => { draft.frameBorder.style = event.target.value; }, { trackHistory: false });
  });
  canvasWidthInput.addEventListener("input", (event) => {
    setState((draft) => { draft.canvasWidth = Number(event.target.value); }, { trackHistory: false });
  });
  canvasHeightInput.addEventListener("input", (event) => {
    setState((draft) => { draft.canvasHeight = Number(event.target.value); }, { trackHistory: false });
  });
  canvasRatioInput.addEventListener("change", (event) => {
    setState((draft) => {
      applyCanvasRatio(event.target.value, draft);
    }, { trackHistory: false });
  });
  slotWidthInput.addEventListener("input", (event) => {
    setState((draft) => {
      resizeSlotByPercent(draft.selectedSlotIndex, "width", Number(event.target.value), draft);
    }, { trackHistory: false });
  });
  slotHeightInput.addEventListener("input", (event) => {
    setState((draft) => {
      resizeSlotByPercent(draft.selectedSlotIndex, "height", Number(event.target.value), draft);
    }, { trackHistory: false });
  });

  slotZoomInput.addEventListener("input", (event) => {
    setState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = {
        ...getSlotEdit(draft.selectedSlotIndex, draft),
        zoom: Number(event.target.value) / 100,
      };
    }, { trackHistory: false });
  });
  slotOffsetXInput.addEventListener("input", (event) => {
    setState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = {
        ...getSlotEdit(draft.selectedSlotIndex, draft),
        offsetX: Number(event.target.value) / 100,
      };
    }, { trackHistory: false });
  });
  slotOffsetYInput.addEventListener("input", (event) => {
    setState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = {
        ...getSlotEdit(draft.selectedSlotIndex, draft),
        offsetY: Number(event.target.value) / 100,
      };
    }, { trackHistory: false });
  });
  resetSlotButton.addEventListener("click", () => {
    setState((draft) => {
      draft.slotEdits[draft.selectedSlotIndex] = { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    });
  });

  addTextLayerButton.addEventListener("click", () => {
    addTextLayer();
  });
  deleteTextLayerButton.addEventListener("click", deleteActiveOverlayLayer);
  textLayerInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.text = event.target.value;
    }, { trackHistory: false });
  });
  textSizeInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.size = Number(event.target.value);
    }, { trackHistory: false });
  });
  textRotationInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.rotation = Number(event.target.value);
    }, { trackHistory: false });
  });
  textColorInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.color = event.target.value;
    }, { trackHistory: false });
  });
  textFontInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.fontFamily = event.target.value;
    });
  });
  textNormalButton.addEventListener("click", () => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.fontWeight = "normal";
      current.fontStyle = "normal";
      current.underline = false;
    });
  });
  textBoldInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.fontWeight = event.target.checked ? "bold" : "normal";
    }, { trackHistory: false });
  });
  textItalicInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.fontStyle = event.target.checked ? "italic" : "normal";
    }, { trackHistory: false });
  });
  textUnderlineInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.underline = event.target.checked;
    }, { trackHistory: false });
  });
  textBorderEnabledInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: event.target.checked, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.enabled = event.target.checked;
    }, { trackHistory: false });
  });
  textBorderColorInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: true, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.color = event.target.value;
    }, { trackHistory: false });
  });
  textBorderSizeInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: Number(event.target.value) > 0, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.size = Number(event.target.value);
      current.border.enabled = current.border.size > 0 && current.border.enabled !== false;
    }, { trackHistory: false });
  });
  textBorderStyleInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.border = { enabled: true, size: 2, color: "#ff6b4a", style: "solid", ...(current.border || {}) };
      current.border.style = event.target.value;
    }, { trackHistory: false });
  });
  textBgColorInput.addEventListener("input", (event) => {
    const color = event.target.value;
    textBgColorValue.value = color;
    syncColorPreview();
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgColor = color;
    }, { trackHistory: false });
  });
  textBgTransparentInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (!current) return;
      current.bgColor = event.target.checked ? TRANSPARENT_TEXT_BG : colorForInputValue(textBgColorInput.value || "#000000");
    }, { trackHistory: false });
  });
  textBgRoundedInput.addEventListener("change", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgRadius = event.target.checked ? 999 : 0;
    }, { trackHistory: false });
  });
  textBgRadiusInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgRadius = Number(event.target.value);
    }, { trackHistory: false });
  });
  textBgColorValue.addEventListener("input", (event) => {
    const normalized = normalizeTextBgColor(event.target.value);
    if (normalized !== TRANSPARENT_TEXT_BG) textBgColorInput.value = colorForInputValue(normalized);
    syncColorPreview();
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.bgColor = normalized;
    }, { trackHistory: false });
  });
  textPosXInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.x = Number(event.target.value) / 100;
    }, { trackHistory: false });
  });
  textPosYInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.texts.find((item) => item.id === draft.selectedTextId);
      if (current) current.y = Number(event.target.value) / 100;
    }, { trackHistory: false });
  });

  stickerSizeInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.stickers.find((item) => item.id === draft.selectedStickerId);
      if (current) current.size = Number(event.target.value);
    }, { trackHistory: false });
  });
  stickerRotationInput.addEventListener("input", (event) => {
    setState((draft) => {
      const current = draft.stickers.find((item) => item.id === draft.selectedStickerId);
      if (current) current.rotation = Number(event.target.value);
    }, { trackHistory: false });
  });
  deleteStickerButton.addEventListener("click", deleteCurrentStickerLayer);

  drawToggle.addEventListener("change", (event) => {
    setState((draft) => { draft.drawingEnabled = event.target.checked; }, { trackHistory: false });
    activeDesktopTool = event.target.checked ? "draw" : "pointer";
    renderDesktopButtonStates();
  });
  brushColorInput.addEventListener("input", (event) => {
    setState((draft) => { draft.brush.color = event.target.value; }, { trackHistory: false });
  });
  brushSizeInput.addEventListener("input", (event) => {
    setState((draft) => { draft.brush.size = Number(event.target.value); }, { trackHistory: false });
  });
  eraserToggle?.addEventListener("change", (event) => {
    setState((draft) => { draft.brush.eraser = event.target.checked; }, { trackHistory: false });
  });
  clearDrawingButton.addEventListener("click", () => {
    clearDrawingAllSurfaces();
    setState((draft) => {
      draft.drawingDataUrl = "";
      draft.drawingLayer = null;
      draft.activeSelectionType = "slot";
    });
  });

  saveButton.addEventListener("click", async () => {
    await saveCurrentProject({ forcePrompt: !state.projectId });
  });
  saveAsButton.addEventListener("click", async () => {
    await saveCompositeAsDeviceImage({ preferShare: matchMedia("(max-width: 760px)").matches });
  });
  renameProjectButton.addEventListener("click", async () => {
    await renameCurrentProject();
  });
  loadProjectButton.addEventListener("click", async () => {
    await loadMostRecentProject();
  });
  importProjectButton.addEventListener("click", () => {
    projectImportInput.click();
  });
  projectImportInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importProjectFile(file);
    projectImportInput.value = "";
  });
  downloadProjectButton.addEventListener("click", async () => {
    const blob = new Blob([JSON.stringify(cloneState(), null, 2)], { type: "application/json" });
    await triggerDownload(blob, `${state.projectName || "funpic-project"}.json`);
  });
  saveImageButton?.addEventListener("click", () => saveCompositeAsDeviceImage({ preferShare: matchMedia("(max-width: 760px)").matches }));
  exportPngButton.addEventListener("click", downloadCompositePng);
  shareButton.addEventListener("click", shareCompositePng);
  mobileSaveGalleryButton?.addEventListener("click", () => saveCompositeAsDeviceImage({ preferShare: true }));
  mobileSavePlatformButton?.addEventListener("click", () => saveCompositeAsDeviceImage({ preferShare: true }));

  undoButton?.addEventListener("click", () => {
    if (history.length <= 1) return;
    const current = history.pop();
    future.push(current);
    applySnapshot(clone(history[history.length - 1]));
  });
  redoButton?.addEventListener("click", () => {
    if (!future.length) return;
    const snapshot = future.pop();
    history.push(clone(snapshot));
    applySnapshot(clone(snapshot));
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installAppButton.classList.remove("hidden");
  });
  installAppButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installAppButton.classList.add("hidden");
  });
  window.addEventListener("resize", () => {
    if (matchMedia("(max-width: 760px)").matches) {
      if (isMobileInlineTextEditing()) return;
      if (isMobileControlEditing()) {
        window.requestAnimationFrame(renderEditorSurfacesOnly);
        return;
      }
    }
    renderAll();
  });
}

function registerServiceWorker() {
  if (import.meta.env.DEV && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (navigator.serviceWorker.controller && !sessionStorage.getItem("dev-sw-reset")) {
          sessionStorage.setItem("dev-sw-reset", "1");
          window.location.reload();
          return;
        }
        sessionStorage.removeItem("dev-sw-reset");
      })
      .catch((error) => console.error("SW unregister gagal", error));
    return;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.error("SW register gagal", error));
  }
}

async function bootstrap() {
  initViewFromQuery();
  applyRightbarLayout();
  applyCanvasViewportZoom(canvasViewportZoom, { render: false });
  populateFonts();
  setupDrawingSurface(drawingCanvas);
  setupDrawingSurface(mobileDrawingCanvas);
  setupMobilePullToRefresh();
  setupEventListeners();

  const draft = localStorage.getItem(DRAFT_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (draft) {
    try {
      applySnapshot(JSON.parse(draft));
    } catch (error) {
      console.error(error);
      renderAll();
    }
  } else {
    renderAll();
  }

  history.length = 0;
  history.push(cloneState());
  future.length = 0;
  updateHistoryButtons();
  await refreshSavedProjects();
  registerServiceWorker();
}

bootstrap().catch((error) => {
  console.error(error);
  renderAll();
});
