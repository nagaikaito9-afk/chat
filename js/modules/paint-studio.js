import { state } from '../state.js';
import { showToast } from '../utils/helpers.js';

// Canvas Paint Studio Modal Setup
export function setupPaintModal() {
  const modal = document.getElementById('paint-modal');
  const openBtn = document.getElementById('btn-open-paint');
  const canvas = document.getElementById('paint-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const canvasWrapper = document.getElementById('paint-canvas-wrapper');

  // Controls
  const colorPicker = document.getElementById('paint-color');
  const sizePicker = document.getElementById('paint-size');
  const opacityPicker = document.getElementById('paint-opacity');
  const sizeVal = document.getElementById('paint-size-val');
  const opacityVal = document.getElementById('paint-opacity-val');
  const brushPreview = document.getElementById('paint-brush-preview');

  // Buttons & Inputs
  const undoBtn = document.getElementById('btn-paint-undo');
  const redoBtn = document.getElementById('btn-paint-redo');
  const clearBtn = document.getElementById('btn-clear-paint');
  const submitBtn = document.getElementById('btn-submit-paint');
  const downloadBtn = document.getElementById('btn-download-paint');
  const bgTypeSelect = document.getElementById('paint-bg-type');
  const bgFileInput = document.getElementById('paint-bg-file');

  const shapeOptions = document.getElementById('paint-shape-options');
  const shapeTypeSelect = document.getElementById('paint-shape-type');
  const shapeFillCheck = document.getElementById('paint-shape-fill');
  const stampOptions = document.getElementById('paint-stamp-options');
  const stampTypeSelect = document.getElementById('paint-stamp-type');

  // State Variables
  let currentTool = 'pen';
  let isDrawing = false;
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 30;

  let startPos = { x: 0, y: 0 };
  let lastPos = { x: 0, y: 0 };
  let shapeSnapshot = null;
  let rainbowHue = 0;

  // Initialize Canvas Background
  function initCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgTypeSelect && bgTypeSelect.value === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    undoStack = [];
    redoStack = [];
    saveState();
  }

  function saveState() {
    if (undoStack.length >= MAX_HISTORY) undoStack.shift();
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoStack = [];
    updateUndoRedoBtns();
  }

  function updateUndoRedoBtns() {
    if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function undo() {
    if (undoStack.length <= 1) return;
    redoStack.push(undoStack.pop());
    const prevState = undoStack[undoStack.length - 1];
    ctx.putImageData(prevState, 0, 0);
    updateUndoRedoBtns();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    ctx.putImageData(nextState, 0, 0);
    updateUndoRedoBtns();
  }

  // Brush Preview Update
  function updateBrushPreview() {
    if (!sizePicker || !opacityPicker || !colorPicker) return;
    const size = parseInt(sizePicker.value, 10);
    const opacity = parseInt(opacityPicker.value, 10) / 100;
    const color = colorPicker.value;

    if (sizeVal) sizeVal.textContent = `${size}px`;
    if (opacityVal) opacityVal.textContent = `${Math.round(opacity * 100)}%`;

    if (!brushPreview) return;
    brushPreview.style.width = `${Math.min(32, Math.max(4, size))}px`;
    brushPreview.style.height = `${Math.min(32, Math.max(4, size))}px`;

    if (currentTool === 'eraser') {
      brushPreview.style.backgroundColor = '#ffffff';
      brushPreview.style.border = '2px dashed #ff3366';
      brushPreview.style.boxShadow = 'none';
    } else if (currentTool === 'rainbow') {
      brushPreview.style.background = 'linear-gradient(45deg, red, yellow, green, cyan, blue, magenta)';
      brushPreview.style.border = 'none';
    } else if (currentTool === 'neon') {
      brushPreview.style.backgroundColor = color;
      brushPreview.style.border = 'none';
      brushPreview.style.boxShadow = `0 0 10px ${color}`;
    } else {
      brushPreview.style.backgroundColor = color;
      brushPreview.style.opacity = opacity;
      brushPreview.style.border = 'none';
      brushPreview.style.boxShadow = 'none';
    }
  }

  // Tool Selection Handler
  document.querySelectorAll('.paint-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.paint-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;

      if (shapeOptions) shapeOptions.classList.toggle('hidden', currentTool !== 'shape');
      if (stampOptions) stampOptions.classList.toggle('hidden', currentTool !== 'stamp');

      updateBrushPreview();
    });
  });

  // Color Swatch Handlers
  document.querySelectorAll('.paint-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.paint-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      if (colorPicker) colorPicker.value = swatch.dataset.color;
      updateBrushPreview();
    });
  });

  if (colorPicker) {
    colorPicker.addEventListener('input', () => {
      document.querySelectorAll('.paint-swatch').forEach(s => s.classList.remove('active'));
      updateBrushPreview();
    });
  }

  if (sizePicker) sizePicker.addEventListener('input', updateBrushPreview);
  if (opacityPicker) opacityPicker.addEventListener('input', updateBrushPreview);

  // Background Mode Toggle
  if (bgTypeSelect) {
    bgTypeSelect.addEventListener('change', (e) => {
      const bgMode = e.target.value;
      if (canvasWrapper) canvasWrapper.className = `paint-canvas-wrapper bg-${bgMode}`;
    });
  }

  // Open Modal Listener
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (canvasWrapper && bgTypeSelect) canvasWrapper.className = `paint-canvas-wrapper bg-${bgTypeSelect.value}`;
      initCanvas();
      updateBrushPreview();
      modal.classList.remove('hidden');
    });
  }

  document.querySelectorAll('#paint-modal .modal-close').forEach(b => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });

  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bgTypeSelect && bgTypeSelect.value === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      saveState();
    });
  }

  // Position Calculator
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  // Drawing Handlers
  const startDraw = (e) => {
    const pos = getPos(e);
    isDrawing = true;
    startPos = pos;
    lastPos = pos;

    const size = parseInt(sizePicker.value, 10);
    const opacity = parseInt(opacityPicker.value, 10) / 100;
    const color = colorPicker.value;

    if (currentTool === 'eyedropper') {
      const pixel = ctx.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data;
      if (pixel[3] > 0) {
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join('');
        colorPicker.value = hex;
        document.querySelectorAll('.paint-swatch').forEach(s => {
          s.classList.toggle('active', s.dataset.color.toLowerCase() === hex.toLowerCase());
        });
        showToast(`色を取得しました: ${hex}`, 'info');
      }
      const penBtn = document.querySelector('.paint-tool-btn[data-tool="pen"]');
      if (penBtn) penBtn.click();
      isDrawing = false;
      return;
    }

    if (currentTool === 'bucket') {
      floodFill(pos.x, pos.y, color, opacity);
      saveState();
      isDrawing = false;
      return;
    }

    if (currentTool === 'shape') {
      shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return;
    }

    if (currentTool === 'stamp') {
      drawStamp(pos.x, pos.y, stampTypeSelect.value, color, size, opacity);
      return;
    }

    if (currentTool === 'blur') {
      applyBlurAt(pos.x, pos.y, size);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const size = parseInt(sizePicker.value, 10);
    const opacity = parseInt(opacityPicker.value, 10) / 100;
    const color = colorPicker.value;

    if (currentTool === 'shape') {
      if (shapeSnapshot) {
        ctx.putImageData(shapeSnapshot, 0, 0);
        drawShape(startPos, pos, shapeTypeSelect.value, shapeFillCheck.checked, color, size, opacity);
      }
      return;
    }

    if (currentTool === 'blur') {
      applyBlurAt(pos.x, pos.y, size);
      return;
    }

    if (currentTool === 'stamp') {
      const dist = Math.hypot(pos.x - lastPos.x, pos.y - lastPos.y);
      if (dist > size * 1.5) {
        drawStamp(pos.x, pos.y, stampTypeSelect.value, color, size, opacity);
        lastPos = pos;
      }
      return;
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = size * 1.2;
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (currentTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity * 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 2;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (currentTool === 'neon') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 2;
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (currentTool === 'rainbow') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity;
      rainbowHue = (rainbowHue + 5) % 360;
      ctx.strokeStyle = `hsl(${rainbowHue}, 100%, 50%)`;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    ctx.restore();
    lastPos = pos;
  };

  const stopDraw = () => {
    if (!isDrawing) return;
    isDrawing = false;
    shapeSnapshot = null;
    ctx.restore();
    saveState();
  };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); });
  canvas.addEventListener('touchend', stopDraw);

  if (bgFileInput) {
    bgFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          const hRatio = canvas.width / img.width;
          const vRatio = canvas.height / img.height;
          const ratio = Math.min(hRatio, vRatio);
          const centerShiftX = (canvas.width - img.width * ratio) / 2;
          const centerShiftY = (canvas.height - img.height * ratio) / 2;

          ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
          saveState();
          showToast('背景画像を読み込みました！', 'info');
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
      bgFileInput.value = '';
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const dataUrl = getExportDataUrl();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `illustration_${Date.now()}.png`;
      a.click();
      showToast('イラストを保存しました！', 'success');
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const dataUrl = getExportDataUrl();
      modal.classList.add('hidden');
      if (typeof window.sendSpecialMessageWithMedia === 'function') {
        window.sendSpecialMessageWithMedia('image', '🎨 手書きイラスト', dataUrl);
      }
      showToast('イラストを投稿しました！', 'success');
    });
  }

  function getExportDataUrl() {
    const bgMode = bgTypeSelect ? bgTypeSelect.value : 'white';
    if (bgMode === 'transparent') {
      return canvas.toDataURL('image/png');
    }
    const temp = document.createElement('canvas');
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext('2d');

    if (bgMode === 'white') {
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, temp.width, temp.height);
    } else if (bgMode === 'black') {
      tctx.fillStyle = '#111827';
      tctx.fillRect(0, 0, temp.width, temp.height);
    } else if (bgMode === 'grid') {
      tctx.fillStyle = '#f8fafc';
      tctx.fillRect(0, 0, temp.width, temp.height);
      tctx.strokeStyle = '#cbd5e1';
      tctx.lineWidth = 1;
      for (let x = 0; x < temp.width; x += 16) {
        tctx.beginPath(); tctx.moveTo(x, 0); tctx.lineTo(x, temp.height); tctx.stroke();
      }
      for (let y = 0; y < temp.height; y += 16) {
        tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(temp.width, y); tctx.stroke();
      }
    }
    tctx.drawImage(canvas, 0, 0);
    return temp.toDataURL('image/png');
  }

  function floodFill(startX, startY, hexColor, opacity) {
    startX = Math.floor(startX);
    startY = Math.floor(startY);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const startIdx = (startY * w + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const targetA = data[startIdx + 3];

    const fillR = parseInt(hexColor.slice(1, 3), 16);
    const fillG = parseInt(hexColor.slice(3, 5), 16);
    const fillB = parseInt(hexColor.slice(5, 7), 16);
    const fillA = Math.round(opacity * 255);

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

    const queue = [startX, startY];
    const visited = new Uint8Array(w * h);

    while (queue.length > 0) {
      const y = queue.pop();
      const x = queue.pop();
      const pos = y * w + x;
      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      if (Math.abs(data[idx] - targetR) > 32 ||
          Math.abs(data[idx + 1] - targetG) > 32 ||
          Math.abs(data[idx + 2] - targetB) > 32 ||
          Math.abs(data[idx + 3] - targetA) > 32) {
        continue;
      }

      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      if (x > 0) queue.push(x - 1, y);
      if (x < w - 1) queue.push(x + 1, y);
      if (y > 0) queue.push(x, y - 1);
      if (y < h - 1) queue.push(x, y + 1);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function applyBlurAt(x, y, radius) {
    const r = Math.max(3, Math.floor(radius));
    const startX = Math.max(0, Math.floor(x - r));
    const startY = Math.max(0, Math.floor(y - r));
    const bw = Math.min(canvas.width - startX, r * 2);
    const bh = Math.min(canvas.height - startY, r * 2);
    if (bw <= 2 || bh <= 2) return;

    const imgData = ctx.getImageData(startX, startY, bw, bh);
    const data = imgData.data;
    const copy = new Uint8ClampedArray(data);

    for (let py = 1; py < bh - 1; py++) {
      for (let px = 1; px < bw - 1; px++) {
        let red = 0, green = 0, blue = 0, alpha = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const cidx = ((py + dy) * bw + (px + dx)) * 4;
            red += copy[cidx];
            green += copy[cidx + 1];
            blue += copy[cidx + 2];
            alpha += copy[cidx + 3];
            count++;
          }
        }
        const tidx = (py * bw + px) * 4;
        data[tidx] = red / count;
        data[tidx + 1] = green / count;
        data[tidx + 2] = blue / count;
        data[tidx + 3] = alpha / count;
      }
    }
    ctx.putImageData(imgData, startX, startY);
  }

  function drawShape(from, to, type, isFill, color, size, opacity) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (type === 'line') {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else if (type === 'rect') {
      const w = to.x - from.x;
      const h = to.y - from.y;
      if (isFill) ctx.fillRect(from.x, from.y, w, h);
      else ctx.strokeRect(from.x, from.y, w, h);
    } else if (type === 'circle') {
      const rx = Math.abs(to.x - from.x) / 2;
      const ry = Math.abs(to.y - from.y) / 2;
      const cx = (from.x + to.x) / 2;
      const cy = (from.y + to.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (isFill) ctx.fill(); else ctx.stroke();
    } else if (type === 'arrow') {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const headLen = Math.max(12, size * 2.5);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStamp(x, y, type, color, size, opacity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.font = `${Math.max(16, size * 2.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let symbol = '★';
    if (type === 'heart') symbol = '♥';
    if (type === 'sparkle') symbol = '✨';
    if (type === 'note') symbol = '🎵';
    ctx.fillText(symbol, 0, 0);
    ctx.restore();
  }

  window.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    }
  });
}
