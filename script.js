const tools = document.querySelectorAll(".tool");
const canvasViewport = document.querySelector(".canvas-viewport");
const canvasWorld = document.querySelector("#canvas-world");
const gridLayer = document.querySelector(".grid-layer");

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
let panStart = { x: 0, y: 0 };
const BASE_GRID_SIZE = 100;
const WORLD_SIZE = 10000;
let isSpacePressed = false;
let isEditingText = false;
let dragStart = { x: 0, y: 0 };
let hasMoved = false;

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

function createElementData(type, x, y) {
  return {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    text: type === "text" ? "" : null,
  };
}

function updateGrid() {
  const gridSize = BASE_GRID_SIZE * scale;

  const offsetX = canvasViewport.scrollLeft % gridSize;
  const offsetY = canvasViewport.scrollTop % gridSize;

  gridLayer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  gridLayer.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
}

function renderElement(elData) {
  const el = document.querySelector(`[data-id="${elData.id}"]`);
  if (!el) return;

  el.style.left = elData.x + "px";
  el.style.top = elData.y + "px";
  el.style.width = elData.width + "px";
  el.style.height = elData.height + "px";
}

function getElementData(domEl) {
  if (!domEl || !domEl.dataset.id) return null;
  return elements.find((el) => el.id === domEl.dataset.id);
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

//---------------DRAW-----------------
canvasViewport.addEventListener("mousedown", (e) => {
  const { x, y } = getWorldPoint(e);

  //------------Panning---------------\
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
    renderElement(data);
  }

  //-----------------TEXT-------------------------------------
  if (currentTool === "text") {
    const data = createElementData("text", x, y);
    data.width = 100;
    data.height = 30;
    elements.push(data);

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
    textDiv.contentEditable = true;
    textDiv.focus();
    isEditingText = true;

    canvasWorld.appendChild(textDiv);

    currentElement = textDiv;

    textDiv.addEventListener("blur", () => {
      textDiv.contentEditable = false;
      isEditingText = false;
      const data = getElementData(textDiv);
      if (!data) return;

      data.text = textDiv.innerText;
      data.width = textDiv.offsetWidth;
      data.height = textDiv.offsetHeight;

      renderElement(data);
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
    if (isEditingText) return;
    if (e.target.classList.contains("element")) {
      if (selectedElement) {
        selectedElement.style.outline = "";
        removeResizeHandles();
      }

      selectedElement = e.target;
      selectedElement.style.outline = "2px solid blue";
      addResizeHandles(selectedElement);

      const data = getElementData(selectedElement);
      offsetX = x - data.x;
      offsetY = y - data.y;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      hasMoved = false;
    } else {
      if (selectedElement) {
        selectedElement.style.outline = "";
        removeResizeHandles();
        selectedElement = null;
      }
    }
  }
});

//----------Mouse - Resize(Drag)------------------
canvasViewport.addEventListener("mousemove", (e) => {
  const { x, y } = getWorldPoint(e);

  // ------------- rectangle-------------
  if (isDrawing && currentTool === "rectangle" && currentElement) {
    const data = getElementData(currentElement);

    const dx = Math.abs(e.clientX - dragStart.x);
    const dy = Math.abs(e.clientY - dragStart.y);

    if ((dx > 3 || dy > 3) && selectedElement && !isEditingText) {
      isDrawing = true;
    }

    data.width = Math.abs(x - startX);
    data.height = Math.abs(y - startY);
    data.x = Math.min(x, startX);
    data.y = Math.min(y, startY);

    renderElement(data);
  }

  // ------------------- circle ---------------
  if (isDrawing && currentTool === "circle" && currentElement) {
    const data = getElementData(currentElement);

    data.width = Math.abs(x - startX);
    data.height = Math.abs(y - startY);
    data.x = Math.min(x, startX);
    data.y = Math.min(y, startY);

    renderElement(data);
  }
  // ------------element-----------
  if (isDrawing && currentTool === "select" && selectedElement && !isResizing) {
    const data = getElementData(selectedElement);
    data.x = x - offsetX;
    data.y = y - offsetY;
    renderElement(data);
    isDrawing = false;
  }

  //------------Resize-----------------
  if (isResizing && selectedElement) {
    const data = getElementData(selectedElement);
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
    e.target.contentEditable = true;
    e.target.focus();
    isEditingText = true;
  }
});

// -----------Stop------------------
canvasViewport.addEventListener("mouseup", () => {
  isDrawing = false;
  currentElement = null;
  isResizing = false;
  isPanning = false;
  canvasViewport.style.cursor = isSpacePressed ? "grab" : "default";
});

function addResizeHandles(element) {
  removeResizeHandles();

  const positions = ["nw", "ne", "se", "sw"];
  positions.forEach((pos) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle ${pos}`;
    handle.dataset.dir = pos;
    element.appendChild(handle);
  });

  element.dataset.ratio = element.offsetWidth / element.offsetHeight;
}

function removeResizeHandles() {
  document.querySelectorAll(".resize-handle").forEach((h) => h.remove());
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

updateGrid();
