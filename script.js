const tools = document.querySelectorAll(".tool");
const canvasViewport = document.querySelector(".canvas-viewport");
const canvasWorld = document.querySelector("#canvas-world");
const gridLayer = document.querySelector(".grid-layer");
const layersPanel = document.querySelector(".layers");
const bringToFrontBtn = document.getElementById("bringToFront");
const sendToBackBtn = document.getElementById("sendToBack");
const contextMenu = document.getElementById("context-menu");

let elements = [];
let currentTool = "select";
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentElement = null;
let selectedElement = null;
let offsetX = 0;
let offsetY = 0;
let isResizing = false;
let resizeDir = null;
let panX = 0;
let panY = 0;
let scale = 1;
let isPanning = false;
let isRotating = false;
let rotateStartAngle = 0;
let rotateStartValue = 0;
let panStart = { x: 0, y: 0 };
const BASE_GRID_SIZE = 100;
const WORLD_SIZE = 10000;
let isSpacePressed = false;
let isEditingText = false;
let dragStart = { x: 0, y: 0 };
let hasMoved = false;
let selectedLayerId = null;
let layers = [];
let clipboardElement = null;

const STORAGE_KEY = "canvas-elements";

canvasWorld.style.width = WORLD_SIZE + "px";
canvasWorld.style.height = WORLD_SIZE + "px";

canvasViewport.scrollLeft = WORLD_SIZE / 2;
canvasViewport.scrollTop = WORLD_SIZE / 2;

function getWorldPoint(e) {
  const rect = canvasViewport.getBoundingClientRect();

  const screenX = e.clientX - rect.left + canvasViewport.scrollLeft;
  const screenY = e.clientY - rect.top + canvasViewport.scrollTop;

  return {
    x: screenX / scale,
    y: screenY / scale,
  };
}

function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  elements = JSON.parse(saved);

  canvasWorld.innerHTML = "";
  elements.forEach((data) => {
    createElementFromData(data);
  });

  updateLayersPanel();
}

function exportJSON() {
  const data = {
    version: 1,
    scale,
    elements,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "design.json";
  a.click();

  URL.revokeObjectURL(url);
}

function exportHTML() {
  const body = elements.map(elementToHTML).join("\n");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <title>Exported Design</title>
    </head>
    <body style="margin:0; position:relative; width:${WORLD_SIZE}px; height:${WORLD_SIZE}px; background-color:#1e1e1e;">
    ${body}
    </body>
    </html>
`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "design.html";
  a.click();

  URL.revokeObjectURL(url);
}

function elementToHTML(el) {
  let style = `
    position:absolute;
    left:${el.x}px;
    top:${el.y}px;
    width:${el.width}px;
    height:${el.height}px;
  `;

  if (el.type === "rectangle" || el.type === "circle") {
    style += `
      background:${el.fill || "#d9d9d9"};
      border-radius:${el.type === "circle" ? "50%" : el.borderRadius || "0px"};
    `;
  }

  if (el.type === "text") {
    style += `
      color:${el.fill || "#000"};
      font-size:${el.fontSize || 16}px;
      background:transparent;
    `;
  }

  return `<div style="${style}">${el.text || ""}</div>`;
}

function updateLayersPanel() {
  layersPanel.innerHTML = "";

  const sortedElements = [...elements].reverse();

  sortedElements.forEach((element, index) => {
    const layerDiv = document.createElement("div");
    layerDiv.className = `layer ${selectedLayerId === element.id ? "active" : ""}`;
    layerDiv.dataset.id = element.id;

    const displayName =
      element.type === "text" && element.text
        ? element.text.substring(0, 15) +
          (element.text.length > 15 ? "..." : "")
        : element.type.charAt(0).toUpperCase() + element.type.slice(1);

    layerDiv.innerHTML = `
      <div class="layer-content">
        <span class="layer-name">${displayName}</span>
        <span class="layer-type">${element.type}</span>
      </div>
      <div class="layer-icons">
        <div class="lock">
          <i class="ri-lock-${element.locked ? "line" : "unlock-line"}"></i>
        </div>
        <div class="eye">
          <i class="ri-eye-${element.visible ? "line" : "off-line"}"></i>
        </div>
      </div>
    `;

    layerDiv.addEventListener("click", (e) => {
      if (e.target.closest(".lock") || e.target.closest(".eye")) {
        return;
      }

      selectLayer(element.id);
    });

    const lockIcon = layerDiv.querySelector(".lock i");
    lockIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLock(element.id);
    });

    const eyeIcon = layerDiv.querySelector(".eye i");
    eyeIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleVisibility(element.id);
    });

    layersPanel.appendChild(layerDiv);
  });
}

function selectLayer(layerId) {
  if (selectedElement) {
    selectedElement.style.outline = "";
    removeResizeHandles();
  }

  const element = elements.find((el) => el.id === layerId);
  if (!element || element.locked) return;

  selectedLayerId = layerId;
  selectedElement = canvasWorld.querySelector(`[data-id="${layerId}"]`);

  if (selectedElement && !element.locked) {
    selectedElement.style.outline = "2px solid blue";
    addResizeHandles(selectedElement);
  }

  updateLayersPanel();
}

function toggleLock(layerId) {
  const element = elements.find((el) => el.id === layerId);
  if (!element) return;
  if (element.locked && selectedLayerId === layerId) {
    selectedElement = null;
    selectedLayerId = null;
    removeResizeHandles();
  }

  element.locked = !element.locked;

  const domElement = canvasWorld.querySelector(`[data-id="${layerId}"]`);
  if (domElement) {
    if (element.locked) {
      domElement.style.pointerEvents = "none";
      if (selectedElement === domElement) {
        domElement.style.outline = "";
        removeResizeHandles();
        selectedElement = null;
      }
    } else {
      domElement.style.pointerEvents = "auto";
    }
  }

  updateLayersPanel();
}

function toggleVisibility(layerId) {
  const element = elements.find((el) => el.id === layerId);
  if (!element) return;

  element.visible = !element.visible;

  const domElement = canvasWorld.querySelector(`[data-id="${layerId}"]`);
  if (domElement) {
    domElement.style.display = element.visible ? "block" : "none";
  }

  updateLayersPanel();
}

function normalizeZIndex() {
  elements.forEach((el, index) => {
    el.zIndex = index + 1;
    const dom = canvasWorld.querySelector(`[data-id="${el.id}"]`);
    if (dom) dom.style.zIndex = el.zIndex;
  });
}

function bringToFront(layerId) {
  const elementIndex = elements.findIndex((el) => el.id === layerId);
  if (elementIndex === -1) return;

  const [element] = elements.splice(elementIndex, 1);
  elements.push(element);

  normalizeZIndex();
  updateLayersPanel();
  saveToLocalStorage();
}

function sendToBack(layerId) {
  const elementIndex = elements.findIndex((el) => el.id === layerId);
  if (elementIndex === -1) return;

  const [element] = elements.splice(elementIndex, 1);
  elements.unshift(element);

  normalizeZIndex();
  updateLayersPanel();
  saveToLocalStorage();
}

function createElementFromData(data) {
  const el = document.createElement("div");

  el.classList.add("element");
  el.dataset.id = data.id;
  el.dataset.type = data.type;
  el.style.position = "absolute";

  if (data.type === "text") {
    el.contentEditable = false;
    el.style.minWidth = "50px";
    el.style.minHeight = "20px";
    el.style.padding = "2px";
    el.style.background = "transparent";
  }

  canvasWorld.appendChild(el);
  renderElement(data);

  return el;
}

window.addEventListener("keydown", (e) => {
  if (!selectedLayerId) return;
  if (isEditingText) return;

  if ((e.ctrlKey || e.metaKey) && e.key === "]") {
    e.preventDefault();
    bringToFront(selectedLayerId);
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "[") {
    e.preventDefault();
    sendToBack(selectedLayerId);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "c") {
    if (!selectedElement) return;

    const data = getElementData(selectedElement);
    if (!data) return;
    clipboardElement = { ...data };
    saveToLocalStorage();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "v") {
    if (!clipboardElement) return;

    const newData = {
      ...clipboardElement,
      id: crypto.randomUUID(),
      x: clipboardElement.x + 20,
      y: clipboardElement.y + 20,
    };

    elements.push(newData);
    createElementFromData(newData);
    saveToLocalStorage();
  }
});

if (bringToFrontBtn) {
  bringToFrontBtn.addEventListener("click", () => {
    if (selectedLayerId) bringToFront(selectedLayerId);
  });
}

if (sendToBackBtn) {
  sendToBackBtn.addEventListener("click", () => {
    if (selectedLayerId) sendToBack(selectedLayerId);
  });
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Delete" && selectedLayerId) {
    elements = elements.filter((el) => el.id !== selectedLayerId);
    const domElement = canvasWorld.querySelector(
      `[data-id="${selectedLayerId}"]`,
    );
    if (domElement) domElement.remove();
    selectedLayerId = null;
    selectedElement = null;
    clearPropertiesPanel();
    updateLayersPanel();
    saveToLocalStorage();
  }
});
function createElementData(type, x, y) {
  return {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    opacity: 1,
    rotation: 0,
    fill: type === "text" ? "transparent" : "#d9d9d9",
    stroke: null,
    strokeWidth: 0,
    borderRadius: type === "circle" ? "50%" : 0,
    text: type === "text" ? "Enter your text" : null,
    fontSize: type === "text" ? 16 : null,

    zIndex: elements.length + 1,
    visible: true,
    locked: false,
  };
}

function updateGrid() {
  const gridSize = BASE_GRID_SIZE * scale;

  const offsetX = canvasViewport.scrollLeft % gridSize;
  const offsetY = canvasViewport.scrollTop % gridSize;

  gridLayer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  gridLayer.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
}
function renderElement(data) {
  const el = canvasWorld.querySelector(`[data-id="${data.id}"]`);
  if (!el) return;

  el.style.left = data.x + "px";
  el.style.top = data.y + "px";
  el.style.width = data.width + "px";
  el.style.height = data.height + "px";
  el.style.zIndex = data.zIndex;
  el.style.boxSizing = "border-box";

  el.style.display = data.visible ? "block" : "none";

  el.style.opacity = data.opacity ?? 1;
  el.style.backgroundColor = data.fill;
  el.style.color = data.color;
  el.style.borderRadius =
    typeof data.borderRadius === "number"
      ? data.borderRadius + "px"
      : data.borderRadius || "0px";

  if (data.stroke && data.strokeWidth > 0) {
    el.style.border = `${data.strokeWidth}px solid ${data.stroke}`;
  } else {
    el.style.border = "none";
  }
  if (data.zIndex !== undefined) {
    el.style.zIndex = data.zIndex;
  }

  el.style.transform = `rotate(${data.rotation || 0}deg)`;
  el.style.transformOrigin = "center center";

  if (data.type === "text") {
    el.innerText = data.text ?? "";
    el.style.fontSize = (data.fontSize ?? 16) + "px";
  }
  saveToLocalStorage();
}

function getElementData(domEl) {
  if (!domEl) return null;
  const el = domEl.closest(".element");
  if (!el || !el.dataset.id) return null;
  return elements.find((elData) => elData.id === el.dataset.id);
}

//------------Find Elem-------------------
function getSelectedData() {
  if (!selectedLayerId) return null;
  return elements.find((el) => el.id === selectedLayerId);
}

// Tool selection
tools.forEach((tool) => {
  tool.addEventListener("click", () => {
    tools.forEach((t) => t.classList.remove("active"));
    tool.classList.add("active");
    currentTool = tool.id;
    if (selectedElement) {
      selectedElement.style.outline = "";
      removeResizeHandles();
      selectedElement = null;
    }
  });
});

function setTool(toolId) {
  currentTool = toolId;

  tools.forEach((t) => t.classList.remove("active"));
  const btn = document.getElementById(toolId);
  if (btn) btn.classList.add("active");
}

//---------------DRAW-----------------
canvasViewport.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const { x, y } = getWorldPoint(e);

  if (
    currentTool === "select" &&
    e.target.classList.contains("rotate-handle")
  ) {
    e.preventDefault();

    isRotating = true;
    selectedElement = e.target.parentElement;
    const data = getElementData(selectedElement);
    if (!data) return;

    const centerX = data.x + data.width / 2;
    const centerY = data.y + data.height / 2;

    const { x: wx, y: wy } = getWorldPoint(e);

    rotateStartAngle = Math.atan2(wy - centerY, wx - centerX);
    rotateStartValue = data.rotation || 0;

    rotateStartValue = data.rotation;

    return;
  }

  //------------Panning---------------
  if (isSpacePressed && e.button === 0) {
    e.preventDefault();
    if (isEditingText) return;
    isPanning = true;
    panStart.x = e.clientX;
    panStart.y = e.clientY;
    canvasViewport.style.cursor = "grabbing";
    return;
  }

  //---------Resize-------------------

  if (
    currentTool === "select" &&
    e.target.classList.contains("resize-handle")
  ) {
    isResizing = true;
    resizeDir = e.target.dataset.dir;
    selectedElement = e.target.parentElement;

    const data = getElementData(selectedElement);
    if (!data) return;

    selectedElement._resizeStart = {
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      mouseX: x,
      mouseY: y,
    };

    isDrawing = false;
    return;
  }

  // -------------RECTANGLE-----------------
  if (currentTool === "rectangle") {
    isDrawing = true;
    startX = x;
    startY = y;

    const data = createElementData("rectangle", x, y);
    elements.push(data);

    let rect = document.createElement("div");
    rect.classList.add("element");
    rect.dataset.id = data.id;
    rect.style.width = "0px";
    rect.style.height = "0px";
    rect.style.backgroundColor = "#d9d9d9";
    rect.style.position = "absolute";
    rect.style.top = y + "px";
    rect.style.left = x + "px";
    rect.dataset.type = "rectangle";

    canvasWorld.appendChild(rect);

    currentElement = rect;
    updateLayersPanel();
    selectLayer(data.id);
    updatePropertiesPanel();
  }
  //-----------------CIRCLE-------------------
  if (currentTool === "circle") {
    isDrawing = true;
    startX = x;
    startY = y;
    const data = createElementData("circle", x, y);
    elements.push(data);

    let circle = document.createElement("div");
    circle.dataset.id = data.id;
    circle.style.width = "0px";
    circle.style.height = "0px";
    circle.style.backgroundColor = "#d9d9d9";
    circle.style.borderRadius = "50%";
    circle.style.position = "absolute";
    circle.style.top = y + "px";
    circle.style.left = x + "px";
    circle.classList.add("element");
    circle.dataset.type = "circle";

    canvasWorld.appendChild(circle);

    currentElement = circle;
    updateLayersPanel();
    selectLayer(data.id);
  }

  //-----------------TEXT-------------------------------------
  if (currentTool === "text") {
    const data = createElementData("text", x, y);
    data.width = 100;
    data.height = 30;
    elements.push(data);
    updateLayersPanel();
    selectLayer(data.id);

    let textDiv = document.createElement("div");
    textDiv.dataset.id = data.id;
    textDiv.classList.add("element");
    textDiv.dataset.type = "text";
    textDiv.style.position = "absolute";
    textDiv.style.top = y + "px";
    textDiv.style.left = x + "px";
    textDiv.style.minWidth = "50px";
    textDiv.style.minHeight = "20px";
    textDiv.style.color = "#d9d9d9";
    textDiv.style.fontSize = "16px";
    textDiv.style.padding = "2px";
    textDiv.style.background = "transparent";
    textDiv.innerText = "Enter your text";
    textDiv.style.pointerEvents = "auto";
    textDiv.contentEditable = false;
    textDiv.focus();
    isEditingText = false;

    canvasWorld.appendChild(textDiv);

    currentElement = textDiv;
    updateLayersPanel();
    selectLayer(data.id);
    currentTool = "select";
    tools.forEach((t) => t.classList.remove("active"));
    document.getElementById("select").classList.add("active");

    textDiv.addEventListener("blur", () => {
      textDiv.contentEditable = false;
      isEditingText = false;
      const data = getElementData(textDiv);
      if (!data) return;

      data.text = textDiv.innerText;
      data.width = textDiv.offsetWidth;
      data.height = textDiv.offsetHeight;

      renderElement(data);

      currentTool = "select";
      tools.forEach((t) => t.classList.remove("active"));
      document.getElementById("select").classList.add("active");
    });
    textDiv.addEventListener("focus", () => {
      isEditingText = true;
    });

    textDiv.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        textDiv.blur();
      }
    });
    renderElement(data);
  }

  // -----------------Select tool------------
  else if (currentTool === "select") {
    if (isEditingText && e.target.dataset.type === "text") {
      e.target.contentEditable = false;
      isEditingText = false;
    }
    if (e.target.classList.contains("element")) {
      const isdata = getElementData(e.target);
      if (!isdata || isdata.locked) return;

      if (selectedElement) {
        selectedElement.style.outline = "";
        removeResizeHandles();
      }

      selectedElement = e.target;
      selectedElement.style.outline = "2px solid blue";
      addResizeHandles(selectedElement);

      const data = getElementData(selectedElement);
      if (!data) return;

      offsetX = x - data.x;
      offsetY = y - data.y;
      selectLayer(data.id);

      isDrawing = true;
    } else {
      if (selectedElement) {
        selectedElement.style.outline = "";
        removeResizeHandles();
        selectedElement = null;
        selectedLayerId = null;
        updateLayersPanel();
        clearPropertiesPanel();
      }
    }
    updatePropertiesPanel();
  }
});

//----------Mouse - Resize(Drag)------------------
canvasViewport.addEventListener("mousemove", (e) => {
  const { x, y } = getWorldPoint(e);

  // ------------- rectangle-------------
  if (isDrawing && currentTool === "rectangle" && currentElement) {
    const data = getElementData(currentElement);

    data.width = Math.max(0, x - startX);
    data.height = Math.max(0, y - startY);
    if (x < startX) {
      data.x = x;
      data.width = startX - x;
    } else {
      data.x = startX;
    }

    if (y < startY) {
      data.y = y;
      data.height = startY - y;
    } else {
      data.y = startY;
    }

    renderElement(data);
    updatePropertiesPanel();
  }
  if (isDrawing && currentTool === "circle" && currentElement) {
    const data = getElementData(currentElement);

    data.width = Math.max(0, x - startX);
    data.height = Math.max(0, y - startY);
    if (x < startX) {
      data.x = x;
      data.width = startX - x;
    } else {
      data.x = startX;
    }

    if (y < startY) {
      data.y = y;
      data.height = startY - y;
    } else {
      data.y = startY;
    }

    renderElement(data);
    updatePropertiesPanel();
  }
  // ------------element-----------
  if (isDrawing && currentTool === "select" && selectedElement && !isResizing) {
    const data = getElementData(selectedElement);
    if (!data || data.locked) return;
    data.x = x - offsetX;
    data.y = y - offsetY;
    renderElement(data);
  }

  //------------Resize-----------------
  if (isResizing && selectedElement) {
    const data = getElementData(selectedElement);
    if (!data) return;

    const start = selectedElement._resizeStart;

    let dx = x - start.mouseX;
    let dy = y - start.mouseY;

    if (resizeDir.includes("e")) {
      data.width = start.width + dx;
    }

    if (resizeDir.includes("s")) {
      data.height = start.height + dy;
    }

    if (resizeDir.includes("w")) {
      data.width = start.width - dx;
      data.x = start.x + dx;
    }

    if (resizeDir.includes("n")) {
      data.height = start.height - dy;
      data.y = start.y + dy;
    }

    data.width = Math.max(20, data.width);
    data.height = Math.max(20, data.height);

    renderElement(data);
    updatePropertiesPanel();
  }
  //---------------rotate-----------
  if (isRotating && selectedElement) {
    const data = getElementData(selectedElement);
    if (!data) return;

    const centerX = data.x + data.width / 2;
    const centerY = data.y + data.height / 2;

    const { x: wx, y: wy } = getWorldPoint(e);

    const currentAngle = Math.atan2(wy - centerY, wx - centerX);
    const delta = currentAngle - rotateStartAngle;

    data.rotation = rotateStartValue + (delta * 180) / Math.PI;
    renderElement(data);
    updatePropertiesPanel();
  }

  //-----------Panning-----------

  if (isPanning) {
    canvasViewport.scrollLeft -= e.clientX - panStart.x;
    canvasViewport.scrollTop -= e.clientY - panStart.y;

    panStart.x = e.clientX;
    panStart.y = e.clientY;
    updateGrid();
  }
});

canvasViewport.addEventListener("dblclick", (e) => {
  if (
    currentTool === "select" &&
    e.target.classList.contains("element") &&
    e.target.dataset.type === "text"
  ) {
    const textEl = e.target;

    textEl.contentEditable = true;
    textEl.focus();
    isEditingText = true;

    const range = document.createRange();
    range.selectNodeContents(textEl);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
});

// -----------Stop------------------
canvasViewport.addEventListener("mouseup", () => {
  if (
    isDrawing &&
    (currentTool === "rectangle" ||
      currentTool === "circle" ||
      currentTool === "text") &&
    !isEditingText
  ) {
    currentTool = "select";
    tools.forEach((t) => t.classList.remove("active"));
    document.getElementById("select").classList.add("active");
  }

  isDrawing = false;
  currentElement = null;
  isResizing = false;
  isPanning = false;
  isRotating = false;
  canvasViewport.style.cursor = isSpacePressed ? "grab" : "default";
  saveToLocalStorage();
});

function addResizeHandles(element) {
  removeResizeHandles();
  const data = getElementData(element);
  if (!data || data.locked) return;
  const positions = ["nw", "ne", "se", "sw"];
  positions.forEach((pos) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle ${pos}`;
    handle.dataset.dir = pos;
    element.appendChild(handle);
  });

  const rotateHandle = document.createElement("div");
  rotateHandle.className = "rotate-handle";
  element.appendChild(rotateHandle);
}

function removeResizeHandles() {
  document.querySelectorAll(".resize-handle").forEach((h) => h.remove());
  document.querySelectorAll(".rotate-handle").forEach((h) => h.remove());
}

canvasViewport.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey) return;

    e.preventDefault();

    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const zoom = 1 + direction * zoomIntensity;

    const rect = canvasViewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX + canvasViewport.scrollLeft) / scale;
    const worldY = (mouseY + canvasViewport.scrollTop) / scale;

    scale *= zoom;
    scale = Math.min(Math.max(scale, 0.2), 4);

    canvasViewport.scrollLeft = worldX * scale - mouseX;
    canvasViewport.scrollTop = worldY * scale - mouseY;

    canvasWorld.style.transform = `scale(${scale})`;
    canvasWorld.style.transformOrigin = "0 0";
    updateGrid();
  },
  { passive: false },
);

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (isEditingText) return;
    e.preventDefault();
    isSpacePressed = true;
    canvasViewport.style.cursor = "grab";
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    if (isEditingText) return;
    e.preventDefault();
    isSpacePressed = false;
    canvasViewport.style.cursor = "default";
  }
});

function updatePropertiesPanel() {
  const data = getSelectedData();
  if (!data || !selectedElement) {
    clearPropertiesPanel();
    return;
  }
  document.querySelector(".properties-panel").style.display = "flex";

  document.getElementById("input-x").value = Math.round(data.x);
  document.getElementById("input-y").value = Math.round(data.y);

  document.getElementById("input-w").value = Math.round(data.width);
  document.getElementById("input-h").value = Math.round(data.height);

  document.getElementById("fill-value").innerText = data.fill || "none";
  document.getElementById("color-value").innerText = data.color || "none";
  document.getElementById("stroke-value").innerText = data.stroke || "none";
  document.getElementById("input-font").value = data.fontSize ?? 16;
  document.getElementById("corner-radius").value =
    typeof data.borderRadius === "number" ? data.borderRadius : 0;

  document.getElementById("selected-item").innerText =
    selectedElement.dataset.type || "";
  document.getElementById("input-rotate").value = Math.round(
    data.rotation || 0,
  );

  const el = canvasWorld.querySelector(`[data-id="${data.id}"]`);

  document.getElementById("input-opacity").value = Math.round(
    (el.style.opacity || 1) * 100,
  );

  if (data.type === "text") {
    document.getElementById("input-font").value =
      parseInt(el.style.fontSize) || 16;
  }
  if (data.fill && document.getElementById("input-fill")) {
    document.getElementById("input-fill").value = data.fill;
  }
  if (data.color && document.getElementById("input-color")) {
    document.getElementById("input-color").value = data.color;
  }
  if (document.getElementById("input-stroke")) {
    document.getElementById("input-stroke").value = data.stroke || "#000000";
  }

  if (document.getElementById("input-stroke-width")) {
    document.getElementById("input-stroke-width").value = data.strokeWidth || 0;
  }
}

function clearPropertiesPanel() {
  document.querySelector(".properties-panel").style.display = "none";
}

document.getElementById("input-x").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.x = Number(e.target.value);
  renderElement(data);
});

document.getElementById("input-y").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.y = Number(e.target.value);
  renderElement(data);
});
document.getElementById("input-w").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.width = Number(e.target.value);
  renderElement(data);
});

document.getElementById("input-h").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.height = Number(e.target.value);
  renderElement(data);
});

document.getElementById("input-opacity").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.opacity = e.target.value / 100;
  renderElement(data);
});

document.getElementById("input-font").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data || data.type !== "text") return;

  data.fontSize = Number(e.target.value);
  renderElement(data);
});

document.getElementById("corner-radius").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.borderRadius = e.target.value + "px";
  renderElement(data);
});

document.getElementById("input-fill").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.fill = e.target.value;
  document.getElementById("fill-value").innerText = e.target.value;
  renderElement(data);
});
document.getElementById("input-color").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.color = e.target.value;
  document.getElementById("color-value").innerText = e.target.value;
  renderElement(data);
});
document.getElementById("input-stroke").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.stroke = e.target.value;
  document.getElementById("stroke-value").innerText = e.target.value;
  renderElement(data);
});

document.getElementById("input-stroke-width").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.strokeWidth = Number(e.target.value);
  renderElement(data);
});

document.getElementById("input-rotate").addEventListener("input", (e) => {
  const data = getSelectedData();
  if (!data) return;

  data.rotation = Number(e.target.value);
  renderElement(data);
});

//------------Right Click------------

canvasViewport.addEventListener("contextmenu", (e) => {
  e.preventDefault();

  if (!selectedElement) return;

  contextMenu.style.display = "block";
  contextMenu.style.left = e.clientX + "px";
  contextMenu.style.top = e.clientY + "px";
});
window.addEventListener("click", () => {
  contextMenu.style.display = "none";
});

contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (!selectedElement) return;

  const data = getElementData(selectedElement);
  if (!data) return;

  if (action === "copy") {
    clipboardElement = structuredClone(data);
  }

  if (action === "paste" && clipboardElement) {
    const newData = {
      ...clipboardElement,
      id: crypto.randomUUID(),
      x: clipboardElement.x + 30,
      y: clipboardElement.y + 30,
    };

    elements.push(newData);
    createElementFromData(newData);
  }

  if (action === "front") {
    bringToFront(data.id);
  }

  if (action === "back") {
    sendToBack(data.id);
  }
  if (action === "delete") {
    elements = elements.filter((el) => el.id !== selectedLayerId);
    const domElement = canvasWorld.querySelector(
      `[data-id="${selectedLayerId}"]`,
    );
    if (domElement) domElement.remove();
    selectedLayerId = null;
    selectedElement = null;
    clearPropertiesPanel();
    updateLayersPanel();
    saveToLocalStorage();
  }

  contextMenu.style.display = "none";
});
document.getElementById("save").addEventListener("click", () => {
  saveToLocalStorage();
  alert("Canvas saved");
});
document.getElementById("export-json").addEventListener("click", exportJSON);
document.getElementById("export-html").addEventListener("click", exportHTML);

window.addEventListener("keydown", (e) => {
  if (isEditingText) return;

  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (e.ctrlKey || e.metaKey) return;

  switch (e.key.toLowerCase()) {
    case "v":
      setTool("select");
      break;

    case "r":
      setTool("rectangle");
      break;

    case "o":
      setTool("circle");
      break;

    case "t":
      setTool("text");
      break;
  }
});

updateGrid();
updateLayersPanel();
loadFromLocalStorage();
