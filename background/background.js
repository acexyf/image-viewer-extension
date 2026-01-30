// 后台脚本 - 管理扩展状态

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('图片弹框查看器已安装');
  
  // 设置默认状态为启用
  chrome.storage.local.set({ extensionEnabled: true });
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面加载完成时
  if (changeInfo.status === 'complete' && tab.url) {
    // 获取扩展状态
    chrome.storage.local.get(['extensionEnabled'], (data) => {
      const isEnabled = data.extensionEnabled !== false;
      
      // 如果扩展被禁用，移除内容脚本添加的样式和事件
      if (!isEnabled) {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: disableExtensionOnPage
        }).catch(err => console.log('无法执行脚本:', err));
      }
    });
  }
});

// 在页面上禁用扩展的函数
function disableExtensionOnPage() {
  // 移除图片查看器模态框
  const modal = document.querySelector('.image-viewer-modal');
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }
  
  // 移除图片点击效果
  document.querySelectorAll('.image-clickable').forEach(img => {
    img.classList.remove('image-clickable');
  });
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_EXTENSION_STATUS') {
    chrome.storage.local.get(['extensionEnabled'], (data) => {
      sendResponse({ enabled: data.extensionEnabled !== false });
    });
    return true; // 保持消息通道开放以进行异步响应
  }
});