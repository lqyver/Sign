<template>
  <div class="page-container">
    <h1>动态签到二维码方案对比</h1>
    <p class="page-subtitle">扫码识别或粘贴链接，自动生成实时签到二维码</p>

    <!-- 二维码扫描功能 -->
    <QrScanner />

    <div class="comparison-grid">
      <!-- =================================================================== -->
      <!--                         方法一：行为模拟 (你的原始代码)                   -->
      <!-- =================================================================== -->
      <div class="sign-container">
        <h2>方法一：行为模拟</h2>

        <div class="input-section">
          <label for="url-input-A">1. 粘贴签到链接:</label>
          <input
            id="url-input-A"
            type="text"
            v-model="sourceUrl_A"
            placeholder="https://.../hwsys/signin_op/课程ID"
          />
          <p v-if="parsingError_A" class="error-message">{{ parsingError_A }}</p>
        </div>

        <div v-if="isValidUrl_A" class="qr-display">
          <h3>2. 扫描下方二维码</h3>
          <div class="qrcode-wrapper">
            <qrcode-vue :value="realtimeUrl_A" :size="220" level="H" />
          </div>
          <div class="info-box">
            <p><strong>课程ID:</strong> {{ courseId_A }}</p>
            <p>
              <strong class="url-label">生成链接 (实时):</strong>
              <span class="url-text">{{ realtimeUrl_A }}</span>
            </p>
          </div>
        </div>
        
        <div v-else class="placeholder">
          <p>粘贴链接后将在此生成二维码。</p>
        </div>
      </div>

      <!-- =================================================================== -->
      <!--                      方法二：精确复现 (推荐)                        -->
      <!-- =================================================================== -->
      <div class="sign-container recommended">
        <span class="badge">推荐</span>
        <h2>方法二：精确复现</h2>

        <div class="input-section">
          <label for="url-input-B">1. 粘贴原始签到链接:</label>
          <input
            id="url-input-B"
            type="text"
            v-model="sourceUrl_B"
            placeholder="https://.../signin_op/ID/时间戳1/时间戳2"
            @input="parseSourceUrl_B"
          />
          <p v-if="parsingError_B" class="error-message">{{ parsingError_B }}</p>
        </div>

        <div v-if="isValidForGeneration_B" class="qr-display">
          <h3>2. 立即扫描此二维码</h3>
          <div class="qrcode-wrapper">
            <qrcode-vue :value="realtimeUrl_B" :size="220" level="H" />
          </div>
          <div class="info-box">
            <p><strong>任务ID:</strong> {{ signintaskId_B }}</p>
            <p><strong>后端验证戳 (固定):</strong> {{ serverNowValidate_B }}</p>
            <p>
              <strong class="url-label">实时链接 (每秒刷新):</strong>
              <span class="url-text">{{ realtimeUrl_B }}</span>
            </p>
          </div>
        </div>
        
        <div v-else class="placeholder">
          <p>粘贴完整链接后将在此生成二维码。</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import QrcodeVue from 'qrcode.vue';
import QrScanner from './QrScanner.vue';

// --- 配置 ---
const REFRESH_INTERVAL_MS = 1000; // 刷新间隔 (1秒)
const TIMESTAMP_OFFSET_MS = 3000; // 方法一使用的时间戳偏移

// ===================================================================
//               方法一 (行为模拟) 的逻辑
// ===================================================================
const sourceUrl_A = ref('');
const baseUrl_A = ref('');
const courseId_A = ref('');
const realtimeUrl_A = ref('');
const parsingError_A = ref('');
let timerId_A: number | null = null;

const isValidUrl_A = computed(() => baseUrl_A.value && courseId_A.value);

const generateRealtimeUrl_A = () => {
  if (!isValidUrl_A.value) return;
  const startTime = Date.now();
  const endTime = startTime + TIMESTAMP_OFFSET_MS;
  realtimeUrl_A.value = `${baseUrl_A.value}/${courseId_A.value}/${endTime}/${startTime}`;
};

const startTimer_A = () => {
  if (timerId_A) clearInterval(timerId_A);
  generateRealtimeUrl_A();
  timerId_A = setInterval(generateRealtimeUrl_A, REFRESH_INTERVAL_MS);
};

const cleanup_A = () => {
  if (timerId_A) clearInterval(timerId_A);
  timerId_A = null;
  baseUrl_A.value = '';
  courseId_A.value = '';
  realtimeUrl_A.value = '';
};

watch(sourceUrl_A, (newUrl) => {
  cleanup_A();
  parsingError_A.value = '';
  if (!newUrl || !newUrl.trim()) return;
  const match = newUrl.match(/(https?:\/\/[^/]+\/hwsys\/signin_op)\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})/i);
  if (match && match[1] && match[2]) {
    baseUrl_A.value = match[1];
    courseId_A.value = match[2];
    startTimer_A();
  } else {
    parsingError_A.value = '链接格式不正确，或不含课程ID。';
  }
}, { immediate: true });


// ===================================================================
//               方法二 (精确复现) 的逻辑
// ===================================================================
const sourceUrl_B = ref('');
const parsingError_B = ref('');
let timerId_B: number | null = null;
const baseUrl_B = ref('');
const signintaskId_B = ref('');
const serverNowValidate_B = ref('');
const realtimeUrl_B = ref('');

const isValidForGeneration_B = computed(() => 
  baseUrl_B.value && signintaskId_B.value && serverNowValidate_B.value
);

const generateRealtimeUrl_B = () => {
  if (!isValidForGeneration_B.value) return;
  const newTimestamp = Date.now();
  realtimeUrl_B.value = `${baseUrl_B.value}/${signintaskId_B.value}/${newTimestamp}/${serverNowValidate_B.value}`;
};

const startTimer_B = () => {
  stopTimer_B();
  generateRealtimeUrl_B();
  timerId_B = setInterval(generateRealtimeUrl_B, REFRESH_INTERVAL_MS);
};

const stopTimer_B = () => {
  if (timerId_B) {
    clearInterval(timerId_B);
    timerId_B = null;
  }
};

const parseSourceUrl_B = () => {
  stopTimer_B();
  parsingError_B.value = '';
  baseUrl_B.value = '';
  signintaskId_B.value = '';
  serverNowValidate_B.value = '';
  realtimeUrl_B.value = '';

  const url = sourceUrl_B.value.trim();
  if (!url) return;

  const match = url.match(/(https?:\/\/.+\/signin_op)\/([^/]+)\/(\d+)\/(\d+)/);
  if (match && match[1] && match[2] && match[4]) {
    baseUrl_B.value = match[1];
    signintaskId_B.value = match[2];
    serverNowValidate_B.value = match[4];
    startTimer_B();
  } else {
    parsingError_B.value = '链接格式不匹配。请确保包含ID和两个时间戳。';
  }
};

// --- 生命周期钩子 ---
onBeforeUnmount(() => {
  cleanup_A();
  stopTimer_B();
});
</script>

<style scoped>
/* 适合液态玻璃的背景 */
.page-container {
  min-height: 100vh;
  padding: 40px 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: 
    radial-gradient(ellipse at 20% 30%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(118, 75, 162, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 60%),
    linear-gradient(135deg, #f0f4f8 0%, #e8eef4 50%, #f5f7fa 100%);
  background-attachment: fixed;
}

h1 {
  text-align: center;
  color: #1a1a2e;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.5px;
  margin-bottom: 12px;
}

.page-subtitle {
  text-align: center;
  max-width: 600px;
  margin: 0 auto 40px auto;
  color: #6b7280;
  font-size: 15px;
  line-height: 1.6;
}

.comparison-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 苹果液态玻璃效果 - 增强版 */
.sign-container {
  flex: 1;
  min-width: 360px;
  max-width: 440px;
  padding: 32px;
  border-radius: 32px;
  text-align: center;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(50px) saturate(200%);
  -webkit-backdrop-filter: blur(50px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    inset 0 1.5px 0 rgba(255, 255, 255, 0.6),
    inset 0 -1px 0 rgba(255, 255, 255, 0.15),
    0 4px 24px rgba(0, 0, 0, 0.04),
    0 16px 48px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

/* 强光泽层 - 模拟玻璃反光 */
.sign-container::before {
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
.sign-container::after {
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
.sign-container > * {
  position: relative;
  z-index: 1;
}

.sign-container:hover {
  transform: translateY(-4px) scale(1.005);
  box-shadow: 
    inset 0 1.5px 0 rgba(255, 255, 255, 0.6),
    inset 0 -1px 0 rgba(255, 255, 255, 0.15),
    0 8px 32px rgba(0, 0, 0, 0.06),
    0 24px 64px rgba(0, 0, 0, 0.12);
}

.sign-container.recommended {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

/* 简约推荐标签 */
.badge {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 6px 14px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: 20px;
}

/* 标题样式 */
.sign-container h2 {
  color: #1f2937;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  letter-spacing: -0.3px;
}

.sign-container h3 {
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
}

/* 输入区域 - 液态玻璃内嵌效果 */
.input-section {
  width: 100%;
  margin-bottom: 24px;
}

.input-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #4b5563;
  text-align: left;
  font-size: 13px;
  letter-spacing: 0.3px;
}

.input-section input {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  box-sizing: border-box;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.03);
  backdrop-filter: blur(10px);
  color: #1f2937;
  transition: all 0.25s ease;
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.04),
    inset 0 -1px 0 rgba(255, 255, 255, 0.5);
}

.input-section input::placeholder {
  color: #9ca3af;
}

.input-section input:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.input-section input:focus {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(16, 185, 129, 0.35);
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.03),
    0 0 0 3px rgba(16, 185, 129, 0.08);
  outline: none;
}

.error-message {
  color: #ef4444;
  margin-top: 8px;
  font-size: 13px;
  text-align: left;
  padding-left: 4px;
}

/* 二维码展示区 */
.qr-display {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.qrcode-wrapper {
  margin: 20px auto;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  display: inline-block;
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 8px 20px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

/* 信息框 - 毛玻璃 */
.info-box {
  margin-top: 20px;
  text-align: left;
  word-break: break-all;
  background: rgba(248, 250, 252, 0.6);
  backdrop-filter: blur(10px);
  padding: 18px;
  border-radius: 16px;
  font-size: 13px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.info-box p {
  margin: 10px 0;
  color: #4b5563;
  line-height: 1.5;
}

.info-box strong {
  color: #1f2937;
  font-weight: 600;
}

.url-label {
  display: block;
  margin-bottom: 6px;
  color: #6b7280;
}

.url-text {
  color: #059669;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  background: rgba(16, 185, 129, 0.08);
  padding: 8px 12px;
  border-radius: 8px;
  display: block;
  margin-top: 6px;
}

/* 占位符 - 简约风格 */
.placeholder {
  margin-top: 24px;
  padding: 48px 32px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  border: 2px dashed rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  color: #9ca3af;
  font-size: 14px;
}

/* 实时刷新指示器 */
.qr-display h3::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  margin-left: 8px;
  animation: pulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

/* 响应式优化 */
@media (max-width: 768px) {
  .page-container {
    padding: 24px 16px;
  }
  
  h1 {
    font-size: 24px;
  }
  
  .sign-container {
    min-width: auto;
    width: 100%;
    padding: 24px;
    border-radius: 20px;
  }
  
  .comparison-grid {
    gap: 16px;
  }
}
</style>