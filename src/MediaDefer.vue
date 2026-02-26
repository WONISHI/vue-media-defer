<template>
  <div class="media-defer-contain">
    <div
      ref="wrapperRef"
      class="media-defer-wrapper"
      :class="containerClass"
      :style="containerStyle"
    >
      <template v-if="status === 'loaded'">
        <div :class="mediaClass" :style="mediaStyle">
          <slot :type="type" :src="renderSrc">
            <img v-if="type === 'image'" :src="renderSrc" alt="loaded-media" />
            <video
              v-else-if="type === 'video'"
              :src="renderSrc"
              muted
              preload="auto"
            ></video>
          </slot>
        </div>

        <div
          v-if="maskPosition === 'inner' && status !== 'loading' && layer"
          class="mask-layer"
          :class="maskClass"
          :style="maskStyle"
        >
          <slot name="mask"></slot>
        </div>
      </template>

      <div v-else-if="status === 'loading'" class="slot-box loading-box">
        <slot name="loading"><span class="default-msg">加载中...</span></slot>
      </div>

      <div v-else-if="status === 'error'" class="slot-box error-box">
        <slot name="error"><span class="default-msg">加载失败</span></slot>
      </div>

      <div v-else class="slot-box placeholder-box">
        <slot name="placeholder">
          <div class="default-placeholder-bg"></div>
        </slot>
      </div>
    </div>

    <div
      v-if="maskPosition === 'outer' && status !== 'loading' && layer"
      class="mask-layer"
      :class="maskClass"
      :style="maskStyle"
    >
      <slot name="mask"></slot>
    </div>
  </div>
</template>

<script>
import {
  defineComponent,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from 'vue-demi';

import { globalObserver } from './observe/index';

export default defineComponent({
  name: 'MediaDefer',
  props: {
    src: { type: String, required: true },
    type: {
      type: String,
      default: 'image',
      validator: (v) => ['image', 'video'].includes(v),
    },
    maskPosition: {
      type: String,
      default: 'inner',
      validator: (v) => ['outer', 'inner'].includes(v),
    },
    containerClass: { type: String, default: '' },
    containerStyle: { type: Object, default: () => ({}) },
    mediaClass: { type: String, default: '' },
    mediaStyle: { type: Object, default: () => ({}) },
    maskClass: { type: String, default: '' },
    maskStyle: { type: Object, default: () => ({}) },
    layer: {
      type: Boolean,
      default: false,
    },
    options: {
      type: Object,
      default: () => ({
        root: null,
        rootMargin: '100px 0px 100px 0px',
        threshold: 0,
      }),
    },
    delay: { type: Number, default: 0 },
    abortable: { type: Boolean, default: true },
  },

  setup(props) {
    const status = ref('placeholder');
    const renderSrc = ref('');
    const wrapperRef = ref(null);

    let abortController = null;
    let delayTimer = null;
    let objectUrl = null;

    const revokeUrl = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const stopObserve = () => {
      if (wrapperRef.value) {
        // 使用全局单例解绑
        globalObserver.unobserve(wrapperRef.value);
      }
    };

    const abortRequest = () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      if (status.value === 'loading') {
        status.value = 'placeholder';
      }
    };

    const cleanup = () => {
      stopObserve();
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      if (delayTimer) {
        clearTimeout(delayTimer);
        delayTimer = null;
      }
      revokeUrl();
    };

    const loadResource = async () => {
      if (status.value === 'loaded' || status.value === 'loading') return;
      status.value = 'loading';

      try {
        // 1. 提取到外部：无论是图片还是视频，都先创建一个中断控制器
        if (typeof window !== 'undefined' && window.AbortController) {
          abortController = new AbortController();
        }

        if (props.type === 'image') {
          const fetchOptions = abortController
            ? { signal: abortController.signal }
            : {};

          const response = await fetch(props.src, fetchOptions);
          if (!response.ok)
            throw new Error(`Network error: ${response.status}`);

          const blob = await response.blob();
          if (status.value !== 'loading') return;

          revokeUrl();
          objectUrl = URL.createObjectURL(blob);
          renderSrc.value = objectUrl;
          status.value = 'loaded';
          stopObserve(); // 加载成功后解绑观察
        } else {
          // ========= 重点重构的视频解析逻辑 =========
          const tempVideo = document.createElement('video');
          tempVideo.src = props.src;
          tempVideo.preload = 'metadata';

          await new Promise((resolve, reject) => {
            // 定义清理事件绑定的辅助函数，防止内存泄漏
            const cleanupEvents = () => {
              tempVideo.onloadeddata = null;
              tempVideo.onerror = null;
              if (abortController) {
                abortController.signal.removeEventListener(
                  'abort',
                  handleAbort,
                );
              }
            };

            // 定义中断逻辑
            const handleAbort = () => {
              cleanupEvents();
              // 关键黑科技：彻底中断浏览器对视频发起的后台 HTTP 请求
              tempVideo.removeAttribute('src');
              tempVideo.load();

              const error = new Error('Aborted');
              error.name = 'AbortError';
              reject(error);
            };

            // 成功解析
            tempVideo.onloadeddata = () => {
              cleanupEvents();
              resolve();
            };

            // 解析失败
            tempVideo.onerror = (e) => {
              cleanupEvents();
              reject(e);
            };

            // 监听我们的 abortController 触发的中断信号
            if (abortController) {
              abortController.signal.addEventListener('abort', handleAbort);
            }
          });

          // 如果因为其他原因状态已经不是 loading，直接跳过渲染
          if (status.value !== 'loading') {
            return;
          }

          renderSrc.value = props.src;
          status.value = 'loaded';
          stopObserve();

          // 渲染完成后，也顺手销毁临时视频对象
          tempVideo.removeAttribute('src');
          tempVideo.load();
        }
      } catch (error) {
        // 捕获到中止异常时，优雅地退回占位符状态
        if (error.name === 'AbortError') {
          status.value = 'placeholder';
        } else {
          console.error('[MediaDefer] Error:', error);
          status.value = 'error';
        }
      } finally {
        abortController = null;
      }
    };

    // 接收全局单例传来的单个 entry
    const handleIntersect = (entry) => {
      if (entry && entry.isIntersecting) {
        if (status.value === 'loaded' || status.value === 'loading') return;
        if (props.delay > 0) {
          delayTimer = setTimeout(() => {
            loadResource();
          }, props.delay);
        } else {
          loadResource();
        }
      } else {
        if (delayTimer) {
          clearTimeout(delayTimer);
          delayTimer = null;
        }
        if (props.abortable && status.value === 'loading') {
          abortRequest();
        }
      }
    };

    const initObserver = () => {
      if (
        typeof window === 'undefined' ||
        !('IntersectionObserver' in window)
      ) {
        loadResource();
        return;
      }
      if (wrapperRef.value) {
        // 注册到全局单例进行统一观察
        globalObserver.observe(
          wrapperRef.value,
          handleIntersect,
          props.options,
        );
      }
    };

    const reset = () => {
      abortRequest();
      revokeUrl();
      status.value = 'placeholder';
      renderSrc.value = '';
    };

    watch(
      () => props.src,
      (newVal, oldVal) => {
        if (newVal !== oldVal) {
          reset();
          nextTick(() => {
            initObserver();
          });
        }
      },
    );

    onMounted(() => {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          initObserver();
        });
      }
    });

    onBeforeUnmount(() => {
      cleanup();
    });

    return {
      status,
      renderSrc,
      wrapperRef,
      reset,
    };
  },
});
</script>

<style scoped>
.media-defer-contain {
  overflow: hidden;
  width: 100%;
  height: 100px;
}
.media-defer-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100px;
}
.slot-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
}
:where(.slot-box) {
  min-height: 100px;
}
.mask-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
}
.default-msg {
  color: #999;
  font-size: 12px;
}
.default-placeholder-bg {
  width: 100%;
  height: 100%;
  background-color: #eee;
}
img,
video {
  display: block;
  object-fit: contain;
  width: 100%;
  height: 100%;
}
</style>
