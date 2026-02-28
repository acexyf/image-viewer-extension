// content.js - 增强版：图片列表 + 右上角控制栏 + 下载

class ImageViewer {
  constructor() {
    this.modal = null;
    this.imageElement = null;
    this.currentScale = 1;
    this.currentRotation = 0;
    this.isEnabled = true;
    this.imageCount = 0;
    this.pageImages = []; // 存储当前页面的所有图片信息 { src, alt, element }
    this.currentImageIndex = 0; // 当前显示的图片索引

    this.init();
  }

  init() {
    chrome.storage.local.get(["extensionEnabled"], (data) => {
      this.isEnabled = data.extensionEnabled !== false;
      if (this.isEnabled) {
        this.addImageStyles();
        this.setupMutationObserver();
      }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === "TOGGLE_EXTENSION") {
        this.isEnabled = request.enabled;
        if (this.isEnabled) {
          this.addImageStyles();
          this.setupMutationObserver();
        } else {
          this.removeImageStyles();
          if (this.observer) this.observer.disconnect();
        }
        sendResponse({ success: true });
      }
      if (request.type === "GET_IMAGE_COUNT") {
        sendResponse({ count: this.imageCount });
      }
    });

    document.addEventListener("click", this.handleDocumentClick.bind(this));
  }

  handleDocumentClick(e) {
    console.log(this.isEnabled, "handleDocumentClick");
    const target = e.target;
    if (!this.isEnabled) return;
    console.log(
      target.tagName === "IMG",
      target.classList.contains("image-clickable"),
    );
    if (
      target.tagName === "IMG" &&
      target.classList.contains("image-clickable")
    ) {
      if (target.width <= 50 || target.height <= 50 || !this.isVisible(target))
        return;

      e.preventDefault();
      e.stopPropagation();

      // 收集页面所有图片
      this.collectPageImages();

      // 确保当前点击的图片在列表中（可能因尺寸属性为0而被过滤）
      let index = this.pageImages.findIndex((img) => img.element === target);
      if (index === -1) {
        // 手动添加当前图片到列表
        this.pageImages.push({
          src: target.src,
          alt: target.alt || "图片",
          element: target,
        });
        index = this.pageImages.length - 1;
      }
      this.currentImageIndex = index;

      this.showImageViewer(target.src, target.alt || "图片");
    }
  }

  // 收集页面所有符合条件的大图
  collectPageImages() {
    const images = document.querySelectorAll("img");
    this.pageImages = Array.from(images)
      .filter((img) => img.width > 50 && img.height > 50 && this.isVisible(img))
      .map((img) => ({
        src: img.src,
        alt: img.alt || "图片",
        element: img,
      }));
  }

  // 为所有符合条件的图片添加样式类
  addImageStyles() {
    document.querySelectorAll("img").forEach((img) => {
      if (img.width > 50 && img.height > 50 && this.isVisible(img)) {
        img.classList.add("image-clickable");
      }
    });
  }
  // 移除所有图片的样式类
  removeImageStyles() {
    document.querySelectorAll("img.image-clickable").forEach((img) => {
      img.classList.remove("image-clickable");
    });
  }
  // 统计页面图片数量
  countImages() {
    const images = document.querySelectorAll("img");
    this.imageCount = Array.from(images).filter((img) => {
      return img.width > 50 && img.height > 50 && this.isVisible(img);
    }).length;

    return this.imageCount;
  }
  // 检查元素是否可见
  isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }
  // 设置MutationObserver监听DOM变化
  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      // 只有扩展启用时才处理新图片
      if (!this.isEnabled) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查添加的节点本身是否是图片
            if (
              node.tagName === "IMG" &&
              node.width > 50 &&
              node.height > 50 &&
              this.isVisible(node)
            ) {
              node.classList.add("image-clickable");
            }

            // 检查添加的节点内是否包含图片
            node.querySelectorAll &&
              node.querySelectorAll("img").forEach((img) => {
                if (img.width > 50 && img.height > 50 && this.isVisible(img)) {
                  img.classList.add("image-clickable");
                }
              });
          }
        });
      });

      // 重新统计图片数量
      this.countImages();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // 显示图片查看器
  showImageViewer(src, alt) {
    this.createModal();
    this.imageElement.src = src;
    this.imageElement.alt = alt;

    // 重置缩放和旋转（可根据需求调整）
    this.currentScale = 1;
    this.currentRotation = 0;
    this.updateImageTransform();

    // 渲染缩略图列表
    this.renderThumbnails();

    this.modal.classList.add("active");
    this.addKeyboardListeners();
  }

  // 创建模态框（完全重写布局）
  createModal() {
    if (this.modal && this.modal.parentNode) return;

    this.modal = document.createElement("div");
    this.modal.className = "image-viewer-modal";

    // 右上角控制栏容器
    const controlsTop = document.createElement("div");
    controlsTop.className = "image-viewer-controls-top";

    // 创建操作按钮（放大、缩小、顺时针旋转、逆时针旋转、重置、下载）
    const zoomInBtn = this.createControlButton("+", "放大", () =>
      this.zoomIn(),
    );
    const zoomOutBtn = this.createControlButton("-", "缩小", () =>
      this.zoomOut(),
    );
    const rotateCWBtn = this.createControlButton("↻", "顺时针旋转", () =>
      this.rotate(90),
    );
    const rotateCCWBtn = this.createControlButton("↺", "逆时针旋转", () =>
      this.rotate(-90),
    );
    const downloadBtn = this.createControlButton("⬇", "下载图片", () =>
      this.downloadImage(),
    );

    // 左右导航按钮
    const prevBtn = document.createElement("button");
    prevBtn.className = "image-viewer-nav-btn prev";
    prevBtn.innerHTML = "‹";
    prevBtn.title = "上一张";
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止事件冒泡，避免触发模态框关闭
      this.navigatePrev();
    });

    const nextBtn = document.createElement("button");
    nextBtn.className = "image-viewer-nav-btn next";
    nextBtn.innerHTML = "›";
    nextBtn.title = "下一张";
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateNext();
    });

    controlsTop.appendChild(zoomInBtn);
    controlsTop.appendChild(zoomOutBtn);
    controlsTop.appendChild(rotateCWBtn);
    controlsTop.appendChild(rotateCCWBtn);
    controlsTop.appendChild(downloadBtn);
    this.modal.appendChild(prevBtn);
    this.modal.appendChild(nextBtn);

    // 图片容器
    const container = document.createElement("div");
    container.className = "image-viewer-container";

    this.imageElement = document.createElement("img");
    this.imageElement.className = "image-viewer-img";

    container.appendChild(this.imageElement);

    // 底部缩略图容器
    const thumbnailsContainer = document.createElement("div");
    thumbnailsContainer.className = "image-viewer-thumbnails";
    this.thumbnailsContainer = thumbnailsContainer; // 保存引用以便更新

    // 组装
    this.modal.appendChild(controlsTop);
    this.modal.appendChild(container);
    this.modal.appendChild(thumbnailsContainer);

    // 关闭按钮（保留原来的关闭按钮，也可用右上角X，这里保留）
    const closeBtn = document.createElement("button");
    closeBtn.className = "image-viewer-btn-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.hideImageViewer());
    this.modal.appendChild(closeBtn);

    document.body.appendChild(this.modal);

    // 点击背景关闭
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.hideImageViewer();
    });

    // 鼠标滚轮缩放（避开缩略图区域）
    this.modal.addEventListener(
      "wheel",
      (e) => {
        // 如果事件目标在缩略图容器内，则让默认滚动发生（水平滚动缩略图）
        if (
          this.thumbnailsContainer &&
          this.thumbnailsContainer.contains(e.target)
        ) {
          return; // 不执行 preventDefault，让浏览器默认滚动
        }
        e.preventDefault();
        e.deltaY < 0 ? this.zoomIn() : this.zoomOut();
      },
      { passive: false },
    );
  }

  navigatePrev() {
    if (this.pageImages.length === 0) return;
    let newIndex = this.currentImageIndex - 1;
    if (newIndex < 0) newIndex = this.pageImages.length - 1; // 循环到末尾
    this.switchToImage(newIndex);
  }

  navigateNext() {
    if (this.pageImages.length === 0) return;
    let newIndex = this.currentImageIndex + 1;
    if (newIndex >= this.pageImages.length) newIndex = 0; // 循环到开头
    this.switchToImage(newIndex);
  }

  // 渲染缩略图列表
  renderThumbnails() {
    if (!this.thumbnailsContainer) return;

    this.thumbnailsContainer.innerHTML = ""; // 清空

    this.thumbnailsContainer.scrollLeft = 0;

    this.pageImages.forEach((img, index) => {
      const thumb = document.createElement("div");
      thumb.className = "image-viewer-thumbnail";
      if (index === this.currentImageIndex) {
        thumb.classList.add("active");
      }

      const thumbImg = document.createElement("img");
      thumbImg.src = img.src;
      thumbImg.alt = img.alt;
      thumbImg.loading = "lazy";

      thumb.appendChild(thumbImg);
      thumb.addEventListener("click", (e) => {
        e.stopPropagation();
        this.switchToImage(index);
      });

      this.thumbnailsContainer.appendChild(thumb);
    });

    // ===== 新增：动态调整对齐方式 =====
    this.adjustThumbnailsAlignment();
  }

  adjustThumbnailsAlignment() {
    const container = this.thumbnailsContainer;
    if (!container) return;

    // 使用 setTimeout 确保 DOM 已更新
    setTimeout(() => {
      // 检查内容是否超出容器宽度
      if (container.scrollWidth > container.clientWidth) {
        // 超出：左对齐，并设置左内边距保证第一张可见
        container.style.justifyContent = "flex-start";
        container.style.paddingLeft = "20px";
      } else {
        // 未超出：居中，恢复默认内边距
        container.style.justifyContent = "center";
        container.style.paddingLeft = "10px"; // 与原来保持一致
      }
    }, 0);
  }

  // 切换到指定索引的图片
  switchToImage(index) {
    if (index < 0 || index >= this.pageImages.length) return;

    this.currentImageIndex = index;
    const img = this.pageImages[index];

    this.imageElement.src = img.src;
    this.imageElement.alt = img.alt;

    // 重置缩放和旋转（可根据需求选择是否重置）
    this.currentScale = 1;
    this.currentRotation = 0;
    this.updateImageTransform();

    // 更新缩略图高亮
    this.updateThumbnailsActive(index);
  }

  // 更新缩略图高亮
  updateThumbnailsActive(activeIndex) {
    const thumbs = this.thumbnailsContainer.children;
    for (let i = 0; i < thumbs.length; i++) {
      if (i === activeIndex) {
        thumbs[i].classList.add("active");
        // 可选：滚动到可见区域
        thumbs[i].scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      } else {
        thumbs[i].classList.remove("active");
      }
    }
  }

  // 旋转（支持正负角度）
  rotate(angle) {
    this.currentRotation = (this.currentRotation + angle) % 360;
    this.updateImageTransform();
  }

  // 重置旋转角度（缩放保持不变）
  resetRotation() {
    this.currentRotation = 0;
    this.updateImageTransform();
  }

  // 重置所有（可选，保持与之前一致）
  resetAll() {
    this.currentScale = 1;
    this.currentRotation = 0;
    this.updateImageTransform();
  }

  // 下载当前图片
  async downloadImage() {
    const src = this.imageElement.src;
    const alt = this.imageElement.alt || "image";

    try {
      // 使用 fetch 获取图片，注意跨域问题
      const response = await fetch(src, { mode: "cors", credentials: "omit" });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = alt.replace(/[^a-z0-9]/gi, "_") + ".jpg"; // 简单文件名处理
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("下载失败:", error);
      alert("下载失败，可能由于跨域限制。您可以尝试右键图片另存为。");
    }
  }

  // 原有的辅助方法（保持不变）
  createControlButton(text, title, onClick) {
    const btn = document.createElement("button");
    btn.className = "image-viewer-btn";
    btn.title = title;
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  }

  zoomIn() {
    this.currentScale = Math.min(this.currentScale * 1.2, 10);
    this.updateImageTransform();
  }

  zoomOut() {
    this.currentScale = Math.max(this.currentScale / 1.2, 0.1);
    this.updateImageTransform();
  }

  updateImageTransform() {
    if (this.imageElement) {
      this.imageElement.style.transform = `scale(${this.currentScale}) rotate(${this.currentRotation}deg)`;
    }
  }

  addKeyboardListeners() {
    this.keyboardHandler = (e) => {
      switch (e.key) {
        case "Escape":
          this.hideImageViewer();
          break;
        case "+":
        case "=":
          if (e.ctrlKey) {
            e.preventDefault();
            this.zoomIn();
          }
          break;
        case "-":
          if (e.ctrlKey) {
            e.preventDefault();
            this.zoomOut();
          }
          break;
        case "r":
        case "R":
          this.rotate(90);
          break; // 顺时针旋转
        case "l":
        case "L":
          this.rotate(-90);
          break; // 逆时针旋转（可自定义）
        case "0":
          if (e.ctrlKey) {
            e.preventDefault();
            this.resetRotation();
          }
          break;
      }
    };
    document.addEventListener("keydown", this.keyboardHandler);
  }

  removeKeyboardListeners() {
    if (this.keyboardHandler) {
      document.removeEventListener("keydown", this.keyboardHandler);
    }
  }

  hideImageViewer() {
    if (this.modal) {
      this.modal.classList.remove("active");
      setTimeout(() => {
        if (
          this.modal &&
          this.modal.parentNode &&
          !this.modal.classList.contains("active")
        ) {
          this.modal.parentNode.removeChild(this.modal);
          this.modal = null;
          this.thumbnailsContainer = null;
        }
      }, 300);
    }
    this.removeKeyboardListeners();
  }
}

// 初始化（保持不变）
if (!window.imageViewerInstance) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.imageViewerInstance = new ImageViewer();
    });
  } else {
    window.imageViewerInstance = new ImageViewer();
  }
}
