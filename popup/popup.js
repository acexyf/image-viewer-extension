document.addEventListener("DOMContentLoaded", function () {
  const toggleExtension = document.getElementById("toggleExtension");
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const toggleLabel = document.getElementById("toggleLabel");
  const imageCount = document.getElementById("imageCount");

  // 从存储中加载扩展状态
  chrome.storage.local.get(
    ["extensionEnabled", "currentTabImages"],
    function (data) {
      const isEnabled = data.extensionEnabled !== false; // 默认启用
      toggleExtension.checked = isEnabled;
      updateStatusUI(isEnabled);

      // 获取当前标签页的图片数量
      if (data.currentTabImages) {
        imageCount.textContent = data.currentTabImages;
      }
    },
  );

  // 切换扩展状态
  toggleExtension.addEventListener("change", function () {
    const isEnabled = this.checked;

    // 保存状态到存储
    chrome.storage.local.set({ extensionEnabled: isEnabled });

    // 更新UI
    updateStatusUI(isEnabled);

    // 向后台脚本发送广播请求
    chrome.runtime.sendMessage(
      {
        type: "BROADCAST_STATUS_UPDATE",
        enabled: isEnabled,
      },
      function (response) {
        if (response && response.success) {
          console.log("状态更新已广播到所有标签页");
        }
      },
    );
  });

  // 更新状态UI
  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusIndicator.className = "status-indicator active";
      statusText.textContent = "状态: 已启用";
      toggleLabel.textContent = "开启图片点击查看功能";
    } else {
      statusIndicator.className = "status-indicator inactive";
      statusText.textContent = "状态: 已禁用";
      toggleLabel.textContent = "开启图片点击查看功能";
    }
  }

  // 从当前标签页获取图片数量（修复后的版本）
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0].id) {
      // 使用setTimeout确保内容脚本有足够时间加载
      setTimeout(() => {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "GET_IMAGE_COUNT" },
          function (response) {
            // 检查运行时错误
            if (chrome.runtime.lastError) {
              // 内容脚本未加载或页面不支持内容脚本（如chrome://页面）
              // console.log(
              //   "无法获取图片数量:",
              //   chrome.runtime.lastError.message,
              // );
              imageCount.textContent = "N/A";
            } else if (response && response.count !== undefined) {
              imageCount.textContent = response.count;
              // 保存到存储以便下次使用
              chrome.storage.local.set({ currentTabImages: response.count });
            } else {
              imageCount.textContent = "0";
            }
          },
        );
      }, 100); // 100ms延迟，确保内容脚本已加载
    }
  });
});
