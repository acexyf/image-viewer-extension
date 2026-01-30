// 扩展主要功能实现

class ImageViewer {
  constructor() {
    this.modal = null;
    this.imageElement = null;
    this.currentScale = 1;
    this.currentRotation = 0;
    this.isEnabled = true;
    this.imageCount = 0;

    this.init();
  }

  init() {
    // 从存储加载设置
    chrome.storage.local.get(["extensionEnabled"], (data) => {
      this.isEnabled = data.extensionEnabled !== false; // 默认启用
      if (this.isEnabled) {
        this.attachEventListeners();
        this.countImages();
      }
    });

    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === "TOGGLE_EXTENSION") {
        this.isEnabled = request.enabled;
        if (this.isEnabled) {
          this.attachEventListeners();
          this.countImages();
        } else {
          this.removeEventListeners();
        }
        sendResponse({ success: true });
      }

      if (request.type === "GET_IMAGE_COUNT") {
        sendResponse({ count: this.imageCount });
      }
    });
  }

  // 统计页面图片数量
  countImages() {
    const images = document.querySelectorAll("img");
    this.imageCount = images.length;

    // 过滤掉太小的图片（可能是图标）
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

  // 为图片添加点击事件
  attachEventListeners() {
    // 移除现有监听器（避免重复添加）
    this.removeEventListeners();

    // 为现有图片添加点击事件
    document.querySelectorAll("img").forEach((img) => {
      if (img.width > 50 && img.height > 50 && this.isVisible(img)) {
        this.addImageClickListener(img);
      }
    });

    // 监听DOM变化，为新添加的图片添加事件
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查添加的节点本身是否是图片
            if (node.tagName === "IMG") {
              this.addImageClickListener(node);
            }

            // 检查添加的节点内是否包含图片
            node.querySelectorAll &&
              node.querySelectorAll("img").forEach((img) => {
                this.addImageClickListener(img);
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

  // 移除事件监听器
  removeEventListeners() {
    document.querySelectorAll("img").forEach((img) => {
      img.removeEventListener("click", this.handleImageClick);
      img.classList.remove("image-clickable");
    });

    if (this.observer) {
      this.observer.disconnect();
    }
  }

  // 为单个图片添加点击事件
  addImageClickListener(img) {
    // 避免重复添加
    if (img.classList.contains("image-clickable")) return;

    img.classList.add("image-clickable");
    img.addEventListener("click", this.handleImageClick.bind(this));
    // 移除鼠标悬停效果，保留点击交互
  }

  // 处理图片点击事件
  handleImageClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const img = e.target;
    this.showImageViewer(img.src, img.alt || "图片");
  }

  // 显示图片查看器
  showImageViewer(src, alt) {
    // 创建模态框
    this.createModal();

    // 设置图片
    this.imageElement.src = src;
    this.imageElement.alt = alt;

    // 重置缩放和旋转
    this.currentScale = 1;
    this.currentRotation = 0;
    this.updateImageTransform();

    // 显示模态框
    this.modal.classList.add("active");

    // 添加键盘事件监听
    this.addKeyboardListeners();
  }

  // 创建模态框
  createModal() {
    if (this.modal) {
      document.body.appendChild(this.modal);
      return;
    }

    // 创建模态框元素
    this.modal = document.createElement("div");
    this.modal.className = "image-viewer-modal";

    // 创建关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.className = "image-viewer-btn-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.hideImageViewer());

    // 创建图片容器
    const container = document.createElement("div");
    container.className = "image-viewer-container";

    // 创建图片元素
    this.imageElement = document.createElement("img");
    this.imageElement.className = "image-viewer-img";

    // 创建控制按钮容器
    const controls = document.createElement("div");
    controls.className = "image-viewer-controls";

    // 创建控制按钮
    const zoomInBtn = this.createControlButton("+", "放大", () =>
      this.zoomIn(),
    );
    const zoomOutBtn = this.createControlButton("-", "缩小", () =>
      this.zoomOut(),
    );
    const rotateBtn = this.createControlButton("↻", "旋转", () =>
      this.rotate(),
    );
    const resetBtn = this.createControlButton("↺", "重置", () => this.reset());

    // 添加到控制栏
    controls.appendChild(zoomInBtn);
    controls.appendChild(zoomOutBtn);
    controls.appendChild(rotateBtn);
    controls.appendChild(resetBtn);

    // 创建信息显示
    const info = document.createElement("div");
    info.className = "image-viewer-info";
    info.textContent = "使用鼠标滚轮可以缩放图片，ESC键关闭";

    // 组装模态框
    container.appendChild(this.imageElement);
    container.appendChild(controls);
    this.modal.appendChild(closeBtn);
    this.modal.appendChild(container);
    this.modal.appendChild(info);

    // 添加到文档
    document.body.appendChild(this.modal);

    // 点击背景关闭
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.hideImageViewer();
      }
    });

    // 添加鼠标滚轮缩放支持
    this.modal.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn();
        } else {
          this.zoomOut();
        }
      },
      { passive: false },
    );
  }

  // 创建控制按钮
  createControlButton(text, title, onClick) {
    const button = document.createElement("button");
    button.className = "image-viewer-btn";
    button.title = title;
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  // 添加键盘事件监听
  addKeyboardListeners() {
    this.keyboardHandler = (e) => {
      switch (e.key) {
        case "Escape":
          this.hideImageViewer();
          break;
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoomIn();
          }
          break;
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoomOut();
          }
          break;
        case "r":
        case "R":
          this.rotate();
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.reset();
          }
          break;
      }
    };

    document.addEventListener("keydown", this.keyboardHandler);
  }

  // 移除键盘事件监听
  removeKeyboardListeners() {
    if (this.keyboardHandler) {
      document.removeEventListener("keydown", this.keyboardHandler);
    }
  }

  // 放大图片
  zoomIn() {
    this.currentScale = Math.min(this.currentScale * 1.2, 10);
    this.updateImageTransform();
  }

  // 缩小图片
  zoomOut() {
    this.currentScale = Math.max(this.currentScale / 1.2, 0.1);
    this.updateImageTransform();
  }

  // 旋转图片
  rotate() {
    this.currentRotation += 90;
    if (this.currentRotation >= 360) {
      this.currentRotation = 0;
    }
    this.updateImageTransform();
  }

  // 重置图片
  reset() {
    this.currentScale = 1;
    this.currentRotation = 0;
    this.updateImageTransform();
  }

  // 更新图片变换
  updateImageTransform() {
    if (this.imageElement) {
      this.imageElement.style.transform = `scale(${this.currentScale}) rotate(${this.currentRotation}deg)`;
    }
  }

  // 隐藏图片查看器
  hideImageViewer() {
    if (this.modal) {
      this.modal.classList.remove("active");

      // 延迟移除DOM以便动画完成
      setTimeout(() => {
        if (
          this.modal &&
          this.modal.parentNode &&
          !this.modal.classList.contains("active")
        ) {
          this.modal.parentNode.removeChild(this.modal);
        }
      }, 300);
    }

    // 移除键盘监听
    this.removeKeyboardListeners();
  }
}

// 初始化图片查看器
let imageViewer;

// 当页面加载完成后初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    imageViewer = new ImageViewer();
  });
} else {
  imageViewer = new ImageViewer();
}
