// content.js - 使用事件委托 + Flag控制

class ImageViewer {
  constructor() {
    this.modal = null;
    this.imageElement = null;
    this.currentScale = 1;
    this.currentRotation = 0;
    this.isEnabled = true; // Flag控制：扩展是否启用
    this.imageCount = 0;
    
    this.init();
  }
  
  init() {
    // 从存储加载设置
    chrome.storage.local.get(['extensionEnabled'], (data) => {
      this.isEnabled = data.extensionEnabled !== false; // 默认启用
      if (this.isEnabled) {
        this.addImageStyles();
        this.setupMutationObserver();
      }
    });
    
    // 监听来自popup和background的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TOGGLE_EXTENSION') {
        console.log('收到状态更新:', request.enabled ? '启用' : '禁用');
        this.isEnabled = request.enabled;
        
        if (this.isEnabled) {
          this.addImageStyles();
          this.setupMutationObserver();
        } else {
          this.removeImageStyles();
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
        }
        
        sendResponse({ success: true });
      }
      
      if (request.type === 'GET_IMAGE_COUNT') {
        sendResponse({ count: this.imageCount });
      }
    });
    
    // 使用事件委托监听整个文档的点击事件
    document.addEventListener('click', this.handleDocumentClick.bind(this));
  }
  
  // 处理文档点击事件（事件委托）
  handleDocumentClick(e) {
    const target = e.target;
    
    // 检查是否启用了扩展
    if (!this.isEnabled) {
      return; // 扩展禁用，忽略所有点击
    }
    
    // 检查点击的是否是图片且具有可点击样式
    if (target.tagName === 'IMG' && target.classList.contains('image-clickable')) {
      // 额外检查：过滤小图标
      if (target.width <= 50 || target.height <= 50 || !this.isVisible(target)) {
        return;
      }
      
      console.log('事件委托捕获到图片点击，扩展已启用，显示查看器');
      e.preventDefault();
      e.stopPropagation();
      this.showImageViewer(target.src, target.alt || '图片');
    }
  }
  
  // 为所有符合条件的图片添加样式类
  addImageStyles() {
    document.querySelectorAll('img').forEach(img => {
      if (img.width > 50 && img.height > 50 && this.isVisible(img)) {
        img.classList.add('image-clickable');
      }
    });
  }
  
  // 移除所有图片的样式类
  removeImageStyles() {
    document.querySelectorAll('img.image-clickable').forEach(img => {
      img.classList.remove('image-clickable');
    });
  }
  
  // 统计页面图片数量
  countImages() {
    const images = document.querySelectorAll('img');
    this.imageCount = Array.from(images).filter(img => {
      return img.width > 50 && img.height > 50 && this.isVisible(img);
    }).length;
    
    return this.imageCount;
  }
  
  // 检查元素是否可见
  isVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
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
            if (node.tagName === 'IMG' && 
                node.width > 50 && node.height > 50 && 
                this.isVisible(node)) {
              node.classList.add('image-clickable');
            }
            
            // 检查添加的节点内是否包含图片
            node.querySelectorAll && node.querySelectorAll('img').forEach(img => {
              if (img.width > 50 && img.height > 50 && this.isVisible(img)) {
                img.classList.add('image-clickable');
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
      subtree: true
    });
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
    this.modal.classList.add('active');
    
    // 添加键盘事件监听
    this.addKeyboardListeners();
  }
  
  // 创建模态框
  createModal() {
    if (this.modal && this.modal.parentNode) {
      return;
    }
    
    // 创建模态框元素
    this.modal = document.createElement('div');
    this.modal.className = 'image-viewer-modal';
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'image-viewer-btn-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.hideImageViewer());
    
    // 创建图片容器
    const container = document.createElement('div');
    container.className = 'image-viewer-container';
    
    // 创建图片元素
    this.imageElement = document.createElement('img');
    this.imageElement.className = 'image-viewer-img';
    
    // 创建控制按钮容器
    const controls = document.createElement('div');
    controls.className = 'image-viewer-controls';
    
    // 创建控制按钮
    const zoomInBtn = this.createControlButton('+', '放大', () => this.zoomIn());
    const zoomOutBtn = this.createControlButton('-', '缩小', () => this.zoomOut());
    const rotateBtn = this.createControlButton('↻', '旋转', () => this.rotate());
    const resetBtn = this.createControlButton('↺', '重置', () => this.reset());
    
    // 添加到控制栏
    controls.appendChild(zoomInBtn);
    controls.appendChild(zoomOutBtn);
    controls.appendChild(rotateBtn);
    controls.appendChild(resetBtn);
    
    // 创建信息显示
    const info = document.createElement('div');
    info.className = 'image-viewer-info';
    info.textContent = '使用鼠标滚轮可以缩放图片，ESC键关闭';
    
    // 组装模态框
    container.appendChild(this.imageElement);
    container.appendChild(controls);
    this.modal.appendChild(closeBtn);
    this.modal.appendChild(container);
    this.modal.appendChild(info);
    
    // 添加到文档
    document.body.appendChild(this.modal);
    
    // 点击背景关闭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideImageViewer();
      }
    });
    
    // 添加鼠标滚轮缩放支持
    this.modal.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }, { passive: false });
  }
  
  // 创建控制按钮
  createControlButton(text, title, onClick) {
    const button = document.createElement('button');
    button.className = 'image-viewer-btn';
    button.title = title;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }
  
  // 添加键盘事件监听
  addKeyboardListeners() {
    this.keyboardHandler = (e) => {
      switch(e.key) {
        case 'Escape':
          this.hideImageViewer();
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.zoomOut();
          }
          break;
        case 'r':
        case 'R':
          this.rotate();
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.reset();
          }
          break;
      }
    };
    
    document.addEventListener('keydown', this.keyboardHandler);
  }
  
  // 移除键盘事件监听
  removeKeyboardListeners() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
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
      this.modal.classList.remove('active');
      
      // 延迟移除DOM以便动画完成
      setTimeout(() => {
        if (this.modal && this.modal.parentNode && !this.modal.classList.contains('active')) {
          this.modal.parentNode.removeChild(this.modal);
          this.modal = null;
        }
      }, 300);
    }
    
    // 移除键盘监听
    this.removeKeyboardListeners();
  }
}

// 初始化图片查看器
let imageViewer;

// 确保只初始化一次
if (!window.imageViewerInstance) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.imageViewerInstance = new ImageViewer();
    });
  } else {
    window.imageViewerInstance = new ImageViewer();
  }
}