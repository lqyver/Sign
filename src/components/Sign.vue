<template>
  <div class="page-container">
    <h1>动态签到二维码方案对比</h1>
    <p class="page-subtitle">
      下面并排展示了两种生成实时二维码的方案。右侧的“精确复现”方案是基于JS文件逆向分析后的最终版本，成功率最高。
    </p>

    <div class="comparison-grid">
      <!-- =================================================================== -->
      <!--                         方法一：行为模拟 (你的原始代码)                   -->
      <!-- =================================================================== -->
      <div class="sign-container">
        <h2>方法一：行为模拟</h2>
        <p class="subtitle">此方案基于猜测，认为两个时间戳都需要实时生成。</p>

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
        <div class="ribbon"><span>推荐</span></div>
        <h2>方法二：精确复现</h2>
        <p class="subtitle">此方案基于JS文件分析，精确刷新所需的时间戳。</p>

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

    <!-- =================================================================== -->
    <!--                            分析总结                               -->
    <!-- =================================================================== -->
    <div class="summary-box">
      <h3>核心差异分析</h3>
      <p>
        通过分析目标网站的JS文件 <code>SigninOp-Ce7pM04j (1).js</code>，我们发现签到URL <code>.../{ID}/{timestamp}/{server_now_validate}</code> 中的两个时间戳作用不同：
      </p>
      <ul>
        <li><code>timestamp</code> (第一个时间戳): 用于 **前端校验**。脚本会将其与当前设备获取的服务器时间做比较，时间差必须在4.5秒内，所以它必须是实时的。</li>
        <li><code>server_now_validate</code> (第二个时间戳): 用于 **后端校验**。脚本会把它原封不动地编码后提交给服务器。它是一个固定的“令牌”，我们不能修改它。</li>
      </ul>
      <p>
        <strong>结论：</strong> “方法一” 错误地刷新了两个时间戳，可能会导致后端验证失败。“方法二” 精确地只刷新了第一个时间戳，保留了第二个，这与目标脚本的行为完全一致，因此是**正确且可靠的方案**。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import QrcodeVue from 'qrcode.vue';

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
.page-container {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f9fafb;
}

h1 {
  text-align: center;
  color: #111827;
}

.page-subtitle {
  text-align: center;
  max-width: 800px;
  margin: -10px auto 30px auto;
  color: #4b5563;
}

.comparison-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 30px;
}

.sign-container {
  flex: 1;
  min-width: 380px;
  max-width: 480px;
  padding: 30px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  position: relative;
  overflow: hidden;
}

.sign-container.recommended {
  border: 2px solid #10b981;
}

.ribbon {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 110px;
  height: 110px;
  overflow: hidden;
}
.ribbon span {
  position: absolute;
  display: block;
  width: 150px;
  padding: 8px 0;
  background-color: #10b981;
  box-shadow: 0 5px 10px rgba(0,0,0,0.1);
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
  text-transform: uppercase;
  text-align: center;
  right: -32px;
  top: 25px;
  transform: rotate(45deg);
}

.subtitle {
  color: #6c757d;
  margin-top: -10px;
  margin-bottom: 30px;
  font-size: 0.9em;
}

.input-section {
  width: 100%;
  margin-bottom: 25px;
}

.input-section label {
  display: block;
  margin-bottom: 10px;
  font-weight: 600;
  color: #343a40;
  text-align: left;
}

.input-section input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ced4da;
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 1em;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-section input:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.15);
  outline: none;
}

.error-message {
  color: #e63946;
  margin-top: 10px;
  font-size: 0.9em;
  text-align: left;
}

.qr-display {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.qrcode-wrapper {
  margin-top: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  display: inline-block;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.info-box {
  margin-top: 15px;
  text-align: left;
  word-break: break-all;
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  font-size: 0.9em;
}

.info-box p {
  margin: 8px 0;
}

.url-label {
  display: block;
  margin-bottom: 5px;
}

.url-text {
  color: #0056b3;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

.placeholder {
  margin-top: 20px;
  padding: 40px;
  border: 2px dashed #dee2e6;
  border-radius: 10px;
  color: #6c757d;
}

.summary-box {
  max-width: 990px;
  margin: 40px auto 20px auto;
  padding: 25px;
  background-color: #ffffff;
  border-left: 5px solid #007bff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.05);
}
.summary-box h3 {
  margin-top: 0;
}
.summary-box ul {
  padding-left: 20px;
}
.summary-box code {
  background-color: #e9ecef;
  padding: 2px 5px;
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}
</style>