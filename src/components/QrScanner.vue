<template>
  <div class="qr-scanner">
    <!-- 头部 -->
    <div class="scanner-header">
      <div class="header-icon">📷</div>
      <h3>二维码扫描</h3>
      <p class="header-desc">扫描签到码自动生成破解版本</p>
    </div>

    <!-- 主扫描区域 -->
    <div class="scan-area">
      <!-- 摄像头预览 -->
      <div class="camera-box" :class="{ 'scanning': isScanning, 'has-result': scannedResult }">
        <video
          ref="videoRef"
          class="camera-feed"
          autoplay
          playsinline
          muted
        ></video>
        <canvas ref="canvasRef" class="hidden"></canvas>
        
        <!-- 扫描框动画 -->
        <div v-if="isScanning" class="scanner-frame">
          <div class="frame-corner tl"></div>
          <div class="frame-corner tr"></div>
          <div class="frame-corner bl"></div>
          <div class="frame-corner br"></div>
          <div class="scan-laser"></div>
        </div>

        <!-- 初始状态 -->
        <div v-if="!isScanning && !scannedResult && !isLoading" class="camera-placeholder">
          <div class="placeholder-icon">📷</div>
          <button class="btn-primary" @click="startCamera">
            开启摄像头
          </button>
          <p class="hint-text">或点击下方上传图片</p>
        </div>

        <!-- 加载中 -->
        <div v-if="isLoading" class="loading-state">
          <div class="loader"></div>
          <span>{{ videoDebugInfo || '正在启动...' }}</span>
        </div>

        <!-- 扫描成功覆盖层 -->
        <div v-if="scannedResult" class="success-overlay">
          <div class="success-icon">✓</div>
          <span>扫描成功</span>
        </div>
      </div>

      <!-- 扫描中控制条 -->
      <div v-if="isScanning" class="scan-controls">
        <button class="btn-text" @click="stopCamera">
          <span>⏹</span> 停止扫描
        </button>
      </div>
    </div>

    <!-- 设备选择 -->
    <div v-if="videoDevices.length > 1 && !scannedResult" class="device-bar">
      <select v-model="selectedDeviceId" @change="switchDevice" class="device-select">
        <option v-for="device in videoDevices" :key="device.deviceId" :value="device.deviceId">
          {{ getDeviceDisplayName(device) }}
        </option>
      </select>
    </div>

    <!-- 自动打开开关 -->
    <div class="auto-open-toggle">
      <label class="toggle-switch">
        <input type="checkbox" v-model="autoOpenEnabled" :disabled="countdown > 0" />
        <span class="toggle-slider"></span>
        <span class="toggle-label">
          {{ countdown > 0 ? '自动打开已启动' : '扫描成功后自动打开破解链接' }}
        </span>
      </label>
    </div>

    <!-- 结果展示 -->
    <div v-if="scannedResult" class="result-panel">
      <div class="result-tabs">
        <div class="tab-item active">破解结果</div>
      </div>

      <div class="result-content">
        <!-- 原始链接 -->
        <div class="info-row">
          <label>原始链接</label>
          <div class="code-block">{{ scannedResult }}</div>
        </div>

        <!-- 解析信息 -->
        <div v-if="parsedUrl" class="info-row">
          <label>任务信息</label>
          <div class="info-tags">
            <span class="tag">ID: {{ parsedUrl.taskId.slice(0, 8) }}...</span>
            <span v-if="parsedUrl.serverNow" class="tag">已验证</span>
          </div>
        </div>

        <!-- 自动打开倒计时 -->
        <div v-if="parsedUrl && countdown > 0" class="countdown-box">
          <div class="countdown-ring">
            <span class="countdown-num">{{ countdown }}</span>
          </div>
          <p>秒后自动打开破解链接</p>
          <button class="btn-cancel" @click="cancelAutoOpen">取消</button>
        </div>

        <!-- 破解后的二维码 -->
        <div v-if="parsedUrl" class="qr-result">
          <div class="qr-display">
            <qrcode-vue :value="realtimeUrl" :size="180" level="H" />
          </div>
          <p class="qr-hint">⏱ 实时刷新中，可直接扫码</p>
        </div>

        <!-- 无法解析 -->
        <div v-else class="error-notice">
          <span>⚠</span> 无法识别此链接格式
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="result-actions">
        <button class="btn-secondary" @click="copyUrl" v-if="parsedUrl">
          复制链接
        </button>
        <button class="btn-primary" @click="openRealtimeUrl" v-if="parsedUrl">
          立即打开
        </button>
        <button class="btn-secondary" @click="restartScan">
          重新扫描
        </button>
      </div>

      <!-- 微信打开提示 -->
      <div v-if="parsedUrl" class="weixin-hint">
        <div class="hint-header">
          <span>💡</span>
          <strong>微信环境提示</strong>
        </div>
        <p class="hint-text">
          如果需要在微信中打开，请使用以下方式：
        </p>
        <div class="hint-options">
          <button class="hint-btn" @click="tryOpenInWeixin">
            <span>📱</span>
            <span>尝试调起微信</span>
          </button>
          <button class="hint-btn secondary" @click="showWeixinQr = true">
            <span>🔗</span>
            <span>生成微信跳转码</span>
          </button>
        </div>
        <p class="hint-note">
          注：浏览器限制无法直接调起微信，建议复制链接发送给微信好友后打开
        </p>
      </div>

      <!-- 微信跳转二维码弹窗 -->
      <div v-if="showWeixinQr" class="weixin-modal" @click.self="showWeixinQr = false">
        <div class="modal-content">
          <h4>用微信扫描此码打开</h4>
          <div class="weixin-qr-display">
            <qrcode-vue :value="realtimeUrl" :size="200" level="H" />
          </div>
          <p class="modal-tip">截图保存，用微信扫一扫</p>
          <button class="modal-close" @click="showWeixinQr = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 上传区域 -->
    <div v-if="!scannedResult" class="upload-zone">
      <input
        type="file"
        ref="fileInput"
        accept="image/*"
        @change="handleFileUpload"
        class="hidden"
      />
      <button class="btn-upload" @click="fileInput?.click()">
        <span>📁</span>
        <span>上传二维码图片</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="toast-error">
      {{ errorMessage }}
      <button v-if="showRetryButton" @click="startCamera" class="btn-retry">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import QrcodeVue from 'qrcode.vue';
import jsQR from 'jsqr';

const REFRESH_INTERVAL_MS = 1000;

// DOM 引用
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

// 状态
const isScanning = ref(false);
const isLoading = ref(false);
const scannedResult = ref('');
const errorMessage = ref('');
const showRetryButton = ref(false);
const videoDevices = ref<MediaDeviceInfo[]>([]);
const selectedDeviceId = ref('');
const videoDebugInfo = ref('');
const blockedDeviceIds = ref<Set<string>>(new Set());
const autoOpenEnabled = ref(false); // 自动打开链接开关
const countdown = ref(0); // 倒计时
const showWeixinQr = ref(false); // 显示微信二维码弹窗
let stream: MediaStream | null = null;
let scanInterval: number | null = null;
let refreshTimer: number | null = null;
let countdownTimer: number | null = null;

// 解析后的URL信息
const parsedUrl = ref<{
  baseUrl: string;
  taskId: string;
  serverNow: string;
} | null>(null);

const realtimeUrl = ref('');

const isValidParsedUrl = computed(() => 
  parsedUrl.value && parsedUrl.value.baseUrl && parsedUrl.value.taskId
);

// 判断设备是否为远程/虚拟设备
const isRemoteDevice = (device: MediaDeviceInfo): boolean => {
  if (!device.label) return false;
  const label = device.label.toLowerCase();
  return ['remote', 'scrcpy', 'virtual', 'obs', 'camo', 'ivcam', 
          'droidcam', 'epoccam', 'sndcpy', 'vysor'].some(k => label.includes(k));
};

// 获取设备显示名称
const getDeviceDisplayName = (device: MediaDeviceInfo): string => {
  const label = device.label || `摄像头 ${videoDevices.value.indexOf(device) + 1}`;
  return isRemoteDevice(device) ? `${label} (远程)` : label;
};

// 生成实时URL
const generateRealtimeUrl = () => {
  if (!isValidParsedUrl.value) return;
  const newTimestamp = Date.now();
  const { baseUrl, taskId, serverNow } = parsedUrl.value!;
  if (serverNow) {
    realtimeUrl.value = `${baseUrl}/${taskId}/${newTimestamp}/${serverNow}`;
  } else {
    realtimeUrl.value = `${baseUrl}/${taskId}/${newTimestamp}/${newTimestamp}`;
  }
};

// 启动刷新定时器
const startRefreshTimer = () => {
  stopRefreshTimer();
  generateRealtimeUrl();
  refreshTimer = window.setInterval(generateRealtimeUrl, REFRESH_INTERVAL_MS);
};

// 停止刷新定时器
const stopRefreshTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

// 播放成功反馈（振动 + 音效）
const playSuccessFeedback = () => {
  // 振动反馈（移动端支持）
  if (navigator.vibrate) {
    navigator.vibrate([50, 100, 50]);
  }
  
  // 清脆音效
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 清脆的高音
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1800, audioContext.currentTime + 0.1);
    
    // 音量包络：快速 attack，短 sustain，快速 decay
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    
    oscillator.type = 'sine';
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    console.log('音效播放失败:', e);
  }
};

// 解析扫描到的URL
const parseScannedUrl = (url: string, source: 'camera' | 'upload' = 'camera') => {
  console.log(`[ParseScannedUrl] 解析URL，来源: ${source}`);
  
  const fullMatch = url.match(/(https?:\/\/.+\/signin_op)\/([^/]+)\/(\d+)\/(\d+)/);
  if (fullMatch) {
    parsedUrl.value = {
      baseUrl: fullMatch[1],
      taskId: fullMatch[2],
      serverNow: fullMatch[4]
    };
    startRefreshTimer();
    // 播放成功反馈
    playSuccessFeedback();
    // 如果开启了自动打开，启动倒计时
    if (autoOpenEnabled.value) {
      startAutoOpen(source);
    }
    return;
  }

  const simpleMatch = url.match(/(https?:\/\/[^/]+\/hwsys\/signin_op)\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})/i);
  if (simpleMatch) {
    parsedUrl.value = {
      baseUrl: simpleMatch[1],
      taskId: simpleMatch[2],
      serverNow: ''
    };
    startRefreshTimer();
    // 播放成功反馈
    playSuccessFeedback();
    // 如果开启了自动打开，启动倒计时
    if (autoOpenEnabled.value) {
      startAutoOpen(source);
    }
    return;
  }

  parsedUrl.value = null;
};

// 自动打开链接倒计时
const startAutoOpen = (source: 'camera' | 'upload' = 'camera') => {
  // 清除之前的倒计时
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  
  console.log(`[AutoOpen] 启动倒计时，来源: ${source}, 开关状态: ${autoOpenEnabled.value}`);
  
  countdown.value = 3; // 3秒倒计时
  countdownTimer = window.setInterval(() => {
    countdown.value--;
    console.log(`[AutoOpen] 倒计时: ${countdown.value}`);
    
    if (countdown.value <= 0) {
      clearInterval(countdownTimer!);
      countdownTimer = null;
      // 打开链接
      console.log('[AutoOpen] 倒计时结束，尝试打开链接');
      const opened = openRealtimeUrl();
      
      // 如果是上传方式且被拦截，提示用户
      if (!opened && source === 'upload') {
        errorMessage.value = '浏览器阻止了自动打开，请点击"立即打开"按钮';
        setTimeout(() => errorMessage.value = '', 5000);
      }
    }
  }, 1000);
};

// 取消自动打开
const cancelAutoOpen = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdown.value = 0;
  }
};

// 打开实时链接
const openRealtimeUrl = (): boolean => {
  if (!realtimeUrl.value) return false;
  
  try {
    const newWindow = window.open(realtimeUrl.value, '_blank');
    // 检查是否被拦截
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      console.log('[AutoOpen] 弹窗被浏览器拦截');
      return false;
    }
    console.log('[AutoOpen] 弹窗成功打开');
    return true;
  } catch (e) {
    console.log('[AutoOpen] 打开链接失败:', e);
    return false;
  }
};

// 尝试在微信中打开
const tryOpenInWeixin = () => {
  if (!realtimeUrl.value) return;
  
  // 方法1：尝试使用微信 URL Scheme（仅在已安装微信的移动端有效）
  const weixinUrl = `weixin://dl/business/?t=${encodeURIComponent(realtimeUrl.value)}`;
  
  // 复制到剪贴板并提示用户
  navigator.clipboard.writeText(realtimeUrl.value).then(() => {
    errorMessage.value = '链接已复制，请手动粘贴到微信中打开';
    setTimeout(() => errorMessage.value = '', 3000);
  });
  
  // 尝试打开（可能会失败，取决于浏览器和设备）
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    // 移动端尝试调起
    window.location.href = weixinUrl;
    // 如果3秒后还在当前页面，说明调起失败
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        // 显示二维码方式
        showWeixinQr.value = true;
      }
    }, 3000);
  } else {
    // PC端直接显示二维码
    showWeixinQr.value = true;
  }
};

// 获取可用的摄像头设备
const getVideoDevices = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices.value = devices.filter(d => 
      d.kind === 'videoinput' && !blockedDeviceIds.value.has(d.deviceId) && !isRemoteDevice(d)
    );
    
    if (videoDevices.value.length > 0 && !selectedDeviceId.value) {
      selectedDeviceId.value = videoDevices.value[0].deviceId;
    }
    
    return videoDevices.value;
  } catch (err) {
    console.error('获取设备列表失败:', err);
    return [];
  }
};

// 启动摄像头
const startCamera = async () => {
  errorMessage.value = '';
  showRetryButton.value = false;
  scannedResult.value = '';
  isLoading.value = true;
  videoDebugInfo.value = '检测设备...';
  
  try {
    await getVideoDevices();
    
    if (videoDevices.value.length === 0) {
      throw new Error('未找到本地摄像头，请检查设备或上传图片');
    }
    
    videoDebugInfo.value = '启动中...';
    
    const constraints = {
      video: {
        deviceId: selectedDeviceId.value ? { exact: selectedDeviceId.value } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      isScanning.value = true;
      isLoading.value = false;
      
      videoRef.value.onloadeddata = () => {
        videoRef.value?.play();
        startScanning();
      };
    }
  } catch (err: any) {
    isLoading.value = false;
    isScanning.value = false;
    showRetryButton.value = true;
    errorMessage.value = err.message || '摄像头启动失败';
    console.error('Camera error:', err);
  }
};

// 开始扫描
const startScanning = () => {
  if (!videoRef.value || !canvasRef.value) return;
  
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  scanInterval = window.setInterval(() => {
    if (!videoRef.value || !canvasRef.value) return;
    
    const video = videoRef.value;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });
    
    if (code) {
      scannedResult.value = code.data;
      parseScannedUrl(code.data, 'camera');
      stopCamera();
    }
  }, 200);
};

// 停止摄像头
const stopCamera = () => {
  isScanning.value = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
};

// 切换设备
const switchDevice = () => {
  if (isScanning.value) {
    stopCamera();
    setTimeout(startCamera, 300);
  }
};

// 重新扫描
const restartScan = () => {
  scannedResult.value = '';
  parsedUrl.value = null;
  stopRefreshTimer();
  cancelAutoOpen();
  showWeixinQr.value = false;
  realtimeUrl.value = '';
};

// 复制链接
const copyUrl = () => {
  navigator.clipboard.writeText(realtimeUrl.value);
  errorMessage.value = '已复制到剪贴板';
  setTimeout(() => errorMessage.value = '', 2000);
};

// 图像预处理：灰度化
const grayscale = (imageData: ImageData): ImageData => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  return imageData;
};

// 图像预处理：对比度增强
const enhanceContrast = (imageData: ImageData, factor: number = 1.5): ImageData => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
  }
  return imageData;
};

// 图像预处理：二值化
const binarize = (imageData: ImageData, threshold: number = 128): ImageData => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const value = gray > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  return imageData;
};

// 尝试不同缩放比例识别二维码
const tryDecodeQR = (canvas: HTMLCanvasElement, _ctx: CanvasRenderingContext2D, scale: number): string | null => {
  const scaledCanvas = document.createElement('canvas');
  const scaledCtx = scaledCanvas.getContext('2d');
  if (!scaledCtx) return null;

  scaledCanvas.width = canvas.width * scale;
  scaledCanvas.height = canvas.height * scale;
  
  // 使用平滑缩放
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  const imageData = scaledCtx.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth'
  });

  return code?.data || null;
};

// 处理文件上传
const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  errorMessage.value = '正在识别...';
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        errorMessage.value = '浏览器不支持';
        return;
      }

      // 设置画布尺寸（限制最大尺寸避免性能问题）
      const maxSize = 2000;
      let width = img.width;
      let height = img.height;
      
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let result: string | null = null;
      
      // 策略1：原始尺寸识别
      if (!result) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });
        result = code?.data || null;
      }
      
      // 策略2：放大识别（小二维码适用）
      if (!result) {
        const scales = [1.5, 2, 2.5, 3];
        for (const scale of scales) {
          result = tryDecodeQR(canvas, ctx, scale);
          if (result) break;
        }
      }
      
      // 策略3：灰度化后识别
      if (!result) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        grayscale(imageData);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });
        result = code?.data || null;
      }
      
      // 策略4：对比度增强后识别
      if (!result) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        enhanceContrast(imageData, 1.8);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });
        result = code?.data || null;
      }
      
      // 策略5：二值化后识别
      if (!result) {
        const thresholds = [100, 128, 150, 180];
        for (const threshold of thresholds) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          grayscale(imageData);
          binarize(imageData, threshold);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });
          if (code?.data) {
            result = code.data;
            break;
          }
        }
      }
      
      // 策略6：缩小后识别（超大二维码适用）
      if (!result && (canvas.width > 1000 || canvas.height > 1000)) {
        const smallCanvas = document.createElement('canvas');
        const smallCtx = smallCanvas.getContext('2d');
        if (smallCtx) {
          smallCanvas.width = canvas.width * 0.5;
          smallCanvas.height = canvas.height * 0.5;
          smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
          const imageData = smallCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });
          result = code?.data || null;
        }
      }

      if (result) {
        scannedResult.value = result;
        parseScannedUrl(result, 'upload');
        errorMessage.value = '';
      } else {
        errorMessage.value = '无法识别图片中的二维码，请尝试：1.裁剪二维码区域 2.提高图片清晰度 3.使用摄像头直接扫描';
      }
    };
    img.onerror = () => {
      errorMessage.value = '图片加载失败';
    };
    img.src = e.target?.result as string;
  };
  reader.onerror = () => {
    errorMessage.value = '文件读取失败';
  };
  reader.readAsDataURL(file);
  target.value = '';
};

// 生命周期
onBeforeUnmount(() => {
  stopCamera();
  stopRefreshTimer();
  cancelAutoOpen();
});
</script>

<style scoped>
/* 苹果液态玻璃效果 (Liquid Glass) - 增强版 */
.qr-scanner {
  position: relative;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(50px) saturate(200%);
  -webkit-backdrop-filter: blur(50px) saturate(200%);
  border-radius: 32px;
  padding: 28px;
  margin: 24px auto;
  max-width: 420px;
  color: #1f2937;
  box-shadow: 
    inset 0 1.5px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(255, 255, 255, 0.12),
    0 4px 24px rgba(0, 0, 0, 0.04),
    0 16px 48px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.5);
  overflow: hidden;
}

/* 强光泽层 - 模拟玻璃反光 */
.qr-scanner::before {
  content: '';
  position: absolute;
  top: 0;
  left: -50%;
  right: -50%;
  height: 70%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.7) 0%,
    rgba(255, 255, 255, 0.3) 30%,
    rgba(255, 255, 255, 0.05) 60%,
    transparent 100%
  );
  transform: skewX(-15deg);
  pointer-events: none;
}

/* 底部反光晕 */
.qr-scanner::after {
  content: '';
  position: absolute;
  bottom: -20%;
  left: 0;
  right: 0;
  height: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.25) 0%,
    transparent 60%
  );
  pointer-events: none;
}

/* 确保内容在光泽层之上 */
.qr-scanner > * {
  position: relative;
  z-index: 1;
}

/* 头部 */
.scanner-header {
  text-align: center;
  margin-bottom: 20px;
}

.header-icon {
  font-size: 40px;
  margin-bottom: 8px;
  opacity: 0.8;
}

.scanner-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  letter-spacing: -0.3px;
}

.header-desc {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
}

/* 扫描区域 */
.scan-area {
  background: rgba(243, 244, 246, 0.6);
  border-radius: 20px;
  padding: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.camera-box {
  position: relative;
  aspect-ratio: 1;
  background: #111827;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}

.camera-feed {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
}

.placeholder-icon {
  font-size: 56px;
  opacity: 0.4;
}

.hint-text {
  font-size: 13px;
  color: #9ca3af;
}

/* 扫描框 */
.scanner-frame {
  position: absolute;
  inset: 20px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 40px;
  height: 40px;
  border: 4px solid #10b981;
}

.frame-corner.tl {
  top: 0;
  left: 0;
  border-right: 0;
  border-bottom: 0;
  border-radius: 12px 0 0 0;
}

.frame-corner.tr {
  top: 0;
  right: 0;
  border-left: 0;
  border-bottom: 0;
  border-radius: 0 12px 0 0;
}

.frame-corner.bl {
  bottom: 0;
  left: 0;
  border-right: 0;
  border-top: 0;
  border-radius: 0 0 0 12px;
}

.frame-corner.br {
  bottom: 0;
  right: 0;
  border-left: 0;
  border-top: 0;
  border-radius: 0 0 12px 0;
}

.scan-laser {
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 3px;
  background: linear-gradient(90deg, transparent, #10b981, transparent);
  box-shadow: 0 0 10px #10b981;
  animation: laser 2s ease-in-out infinite;
}

@keyframes laser {
  0%, 100% { top: 10%; opacity: 0; }
  50% { top: 90%; opacity: 1; }
}

/* 加载状态 */
.loading-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.8);
}

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 成功覆盖层 */
.success-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(16, 185, 129, 0.9);
  animation: fadeIn 0.3s ease;
}

.success-icon {
  width: 60px;
  height: 60px;
  border: 4px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* 控制条 */
.scan-controls {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.btn-text {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 20px;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-text:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #1f2937;
}

/* 设备选择 */
.device-bar {
  margin-top: 12px;
}

.device-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.device-select option {
  background: #f9fafb;
  color: #1f2937;
}

/* 按钮 */
.btn-primary {
  padding: 12px 28px;
  background: #111827;
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #1f2937;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-secondary {
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  color: #4b5563;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1f2937;
}

/* 结果面板 */
.result-panel {
  margin-top: 16px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-tabs {
  display: flex;
  background: #f3f4f6;
}

.tab-item {
  flex: 1;
  padding: 12px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
}

.tab-item.active {
  background: white;
  color: #111827;
}

.result-content {
  padding: 16px;
}

.info-row {
  margin-bottom: 14px;
}

.info-row label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-block {
  padding: 10px 12px;
  background: #f3f4f6;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  color: #374151;
  word-break: break-all;
}

.info-tags {
  display: flex;
  gap: 8px;
}

.tag {
  padding: 4px 10px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* 二维码结果 */
.qr-result {
  text-align: center;
  padding: 16px 0;
}

.qr-display {
  display: inline-block;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.qr-hint {
  margin-top: 12px;
  font-size: 13px;
  color: #10b981;
}

.error-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 8px;
  font-size: 14px;
}

/* 操作按钮 */
.result-actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid #e5e7eb;
}

.result-actions .btn-primary,
.result-actions .btn-secondary {
  flex: 1;
}

.result-actions .btn-primary {
  background: #111827;
}

.result-actions .btn-primary:hover {
  background: #1f2937;
}

.result-actions .btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: none;
}

.result-actions .btn-secondary:hover {
  background: #e5e7eb;
}

/* 上传区域 */
.upload-zone {
  margin-top: 12px;
}

.btn-upload {
  width: 100%;
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.5);
  border: 2px dashed rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  color: #4b5563;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.2);
  color: #1f2937;
}

/* 自动打开开关 */
.auto-open-toggle {
  margin-top: 12px;
  padding: 14px 18px;
  background: rgba(243, 244, 246, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  transition: background 0.3s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s;
}

.toggle-switch input:checked + .toggle-slider {
  background: #10b981;
}

.toggle-switch input:checked + .toggle-slider::after {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 13px;
  color: #4b5563;
}

/* 倒计时 */
.countdown-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 16px;
  margin-bottom: 14px;
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.15);
}

.countdown-ring {
  width: 56px;
  height: 56px;
  border: 3px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: spin 1s linear infinite;
}

.countdown-num {
  font-size: 22px;
  font-weight: 600;
  animation: none;
  color: #059669;
}

.countdown-box p {
  margin: 12px 0 8px;
  font-size: 14px;
  color: #374151;
}

.btn-cancel {
  padding: 8px 16px;
  background: rgba(16, 185, 129, 0.15);
  border: none;
  border-radius: 8px;
  color: #059669;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: rgba(16, 185, 129, 0.25);
}

/* 错误提示 */
.toast-error {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  background: #ef4444;
  color: white;
  border-radius: 25px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
  z-index: 100;
}

.btn-retry {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.hidden {
  display: none;
}

/* 微信打开提示 */
.weixin-hint {
  margin-top: 16px;
  padding: 18px;
  background: rgba(7, 193, 96, 0.08);
  border-radius: 16px;
  border: 1px solid rgba(7, 193, 96, 0.12);
}

.hint-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 10px;
  color: #059669;
  font-weight: 500;
}

.hint-text {
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 12px;
}

.hint-options {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.hint-btn {
  flex: 1;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: white;
  border: 1px solid rgba(7, 193, 96, 0.2);
  border-radius: 10px;
  color: #07c160;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.hint-btn:hover {
  background: rgba(7, 193, 96, 0.05);
  border-color: rgba(7, 193, 96, 0.3);
}

.hint-btn.secondary {
  background: rgba(7, 193, 96, 0.1);
  border-color: transparent;
  color: #059669;
}

.hint-note {
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
}

/* 微信二维码弹窗 */
.weixin-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  max-width: 280px;
  animation: scaleIn 0.2s ease;
}

.modal-content h4 {
  margin: 0 0 16px 0;
  color: #111827;
  font-size: 16px;
}

.weixin-qr-display {
  display: inline-block;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 12px;
  margin-bottom: 12px;
}

.modal-tip {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 16px 0;
}

.modal-close {
  width: 100%;
  padding: 10px;
  background: #07c160;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.modal-close:hover {
  background: #05a050;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
