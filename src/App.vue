<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("AI English Tutor - App Launch");
});

onShow(() => {
  console.log("App Show");
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style lang="scss">
/* 全局样式 */
page {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 28rpx;
  color: #333333;
  background-color: #f5f5f5;
  line-height: 1.6;
}

/* 主题色 */
$primary: #4a90d9;
$primary-light: #e8f0fe;
$success: #52c41a;
$warning: #faad14;
$danger: #ff4d4f;
$text-primary: #333333;
$text-secondary: #666666;
$text-hint: #999999;
$border-color: #e8e8e8;
$bg-white: #ffffff;
$bg-page: #f5f5f5;

/* 通用组件样式 */
.card {
  background: $bg-white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.btn-primary {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #ffffff;
  border: none;
  border-radius: 12rpx;
  padding: 20rpx 48rpx;
  font-size: 32rpx;
  font-weight: 500;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.btn-primary:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.safe-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
