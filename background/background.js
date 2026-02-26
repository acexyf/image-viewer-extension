// 后台脚本 - 管理扩展状态

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log("图片弹框查看器已安装");

  // 设置默认状态为启用
  chrome.storage.local.set({ extensionEnabled: true });
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面加载完成时
  if (changeInfo.status === "complete" && tab.url) {
    // 获取扩展状态
    chrome.storage.local.get(["extensionEnabled"], (data) => {
      const isEnabled = data.extensionEnabled !== false;

      // 如果扩展被禁用，移除内容脚本添加的样式和事件
      if (!isEnabled) {
        chrome.scripting
          .executeScript({
            target: { tabId: tabId },
            function: disableExtensionOnPage,
          })
          .catch((err) => console.log("无法执行脚本:", err));
      }
    });
  }
});

// 在页面上禁用扩展的函数
function disableExtensionOnPage() {
  // 移除图片查看器模态框
  const modal = document.querySelector(".image-viewer-modal");
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }

  // 移除图片点击效果
  document.querySelectorAll(".image-clickable").forEach((img) => {
    img.classList.remove("image-clickable");
  });
}

// 监听来自popup的状态更新请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'BROADCAST_STATUS_UPDATE') {
    broadcastExtensionStatus(request.enabled);
    sendResponse({ success: true });
  }
  return true; // 保持消息通道开放
});

// 在 background.js 末尾添加以下函数
async function broadcastExtensionStatus(isEnabled) {
  // 获取所有窗口的所有标签页
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    // 过滤掉特殊页面（如 chrome:// 扩展页面）
    if (tab.url && tab.url.startsWith("http")) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "TOGGLE_EXTENSION",
          enabled: isEnabled,
        });
        // console.log(`状态更新已发送到标签页: ${tab.id}`, isEnabled);
      } catch (error) {
        // 如果标签页没有内容脚本（或脚本未加载），忽略错误
        console.log(`无法发送到标签页 ${tab.id}:`, error.message);
      }
    }
  }
}
