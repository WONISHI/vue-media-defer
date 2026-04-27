<template>
  <div class="media-defer-container">
    <div
      ref="containerRef"
      class="media-defer-wrapper"
      :class="containerClass"
      :style="containerStyle"
    >
      <template v-if="loadStatus === 'loaded'">
        <div :class="mediaClass" :style="mediaStyle">
          <slot :type="type" :src="activeSrc" :status="loadStatus">
            <img v-if="type === 'image'" :src="activeSrc" alt="media-content" />
            <video v-else :src="activeSrc" muted preload="auto" />
          </slot>
        </div>

        <div
          v-if="maskPosition === 'inner' && showMask"
          class="mask-layer"
          :class="maskClass"
          :style="maskStyle"
        >
          <slot name="mask" />
        </div>
      </template>

      <div v-else class="status-slot-container">
        <slot :name="loadStatus" :status="loadStatus">
          <div v-if="loadStatus === 'loading'" class="default-loading">
            加载中...
          </div>
          <div v-else-if="loadStatus === 'error'" class="default-error">
            加载失败
          </div>
          <div v-else class="default-placeholder" />
        </slot>
      </div>
    </div>

    <div
      v-if="maskPosition === 'outer' && showMask && loadStatus !== 'loading'"
      class="mask-layer"
      :class="maskClass"
      :style="maskStyle"
    >
      <slot name="mask" />
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  PropType,
} from 'vue-demi';
import { globalObserver } from '../core/observer';
import { MediaType, MaskPosition, LoadStatus } from '../types';

export default defineComponent({
  name: 'MediaDefer',
  props: {
    /** @description 资源链接 */
    src: { type: String, required: true },
    /** @description 资源类型 */
    type: { type: String as PropType<MediaType>, default: 'image' },
    maskPosition: { type: String as PropType<MaskPosition>, default: 'inner' },
    containerClass: String,
    containerStyle: Object,
    mediaClass: String,
    mediaStyle: Object,
    maskClass: String,
    maskStyle: Object,
    showMask: { type: Boolean, default: false },
    observerOptions: {
      type: Object as PropType<IntersectionObserverInit>,
      default: () => ({ rootMargin: '200px 0px', threshold: 0 }),
    },
    delay: { type: Number, default: 0 },
    abortable: { type: Boolean, default: true },
    // 是否在划出视图后回收资源（从 DOM 中移除 img/video 标签并清理 Blob）
    recycle: { type: Boolean, default: false },
  },

  setup(props, { emit }) {
    const loadStatus = ref<LoadStatus>('placeholder');
    const activeSrc = ref('');
    const containerRef = ref<HTMLElement | null>(null);

    let abortController: AbortController | null = null;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let objectUrl: string | null = null;

    const clearObjectUrl = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const cancelRequest = () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      if (loadStatus.value === 'loading') {
        loadStatus.value = 'placeholder';
      }
    };

    /**
     * 核心回收逻辑
     * 中止请求、释放内存中的 Blob 对象、清空地址并将状态置回占位
     */
    const performRecycle = () => {
      cancelRequest();
      clearObjectUrl();
      loadStatus.value = 'placeholder';
      activeSrc.value = '';
      // 注意：recycle 模式下不调用 unobserve，因为还需要监听它再次划入
    };

    const startLoading = async () => {
      if (loadStatus.value === 'loaded' || loadStatus.value === 'loading')
        return;
      loadStatus.value = 'loading';

      try {
        abortController = new AbortController();

        if (props.type === 'image') {
          const res = await fetch(props.src, {
            signal: abortController.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();

          if (loadStatus.value !== 'loading') return;
          clearObjectUrl();
          objectUrl = URL.createObjectURL(blob);
          activeSrc.value = objectUrl;
        } else {
          // 视频目前直接使用原地址，如需更深度回收可考虑清空视频 src
          activeSrc.value = props.src;
        }

        loadStatus.value = 'loaded';
        emit('load', { src: props.src });

        // 如果不开启回收模式，加载完成后即可断开观察以节省性能
        if (!props.recycle) {
          if (containerRef.value) {
            globalObserver.unobserve(containerRef.value, props.observerOptions);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          loadStatus.value = 'placeholder';
        } else {
          loadStatus.value = 'error';
          emit('error', err);
        }
      } finally {
        abortController = null;
      }
    };

    const handleIntersect = (entry: IntersectionObserverEntry) => {
      if (entry.isIntersecting) {
        // 进入视口：触发加载
        if (props.delay > 0) {
          delayTimer = setTimeout(startLoading, props.delay);
        } else {
          startLoading();
        }
      } else {
        // 划出视口：逻辑清理
        if (delayTimer) {
          clearTimeout(delayTimer);
          delayTimer = null;
        }

        // 核心优化：如果开启了 recycle 且已经加载完成，则强制卸载 DOM 资源
        if (props.recycle && loadStatus.value === 'loaded') {
          performRecycle();
        }
        // 如果正在加载中且开启了 abortable，则中止网络请求
        else if (props.abortable && loadStatus.value === 'loading') {
          cancelRequest();
        }
      }
    };

    const reload = () => {
      performRecycle();
      nextTick(() => {
        if (containerRef.value) {
          globalObserver.observe(
            containerRef.value,
            handleIntersect,
            props.observerOptions,
          );
        }
      });
    };

    watch(() => props.src, reload);

    onMounted(() => {
      if (containerRef.value) {
        globalObserver.observe(
          containerRef.value,
          handleIntersect,
          props.observerOptions,
        );
      }
    });

    onBeforeUnmount(() => {
      // 退出组件时必须清理 Observer 引用计数，防止内存泄漏
      if (containerRef.value) {
        globalObserver.unobserve(containerRef.value, props.observerOptions);
      }
      cancelRequest();
      clearObjectUrl();
      if (delayTimer) clearTimeout(delayTimer);
    });

    return { loadStatus, activeSrc, containerRef, reload };
  },
});
</script>

<style>
.media-defer-container {
  width: 100%;
  height: 100%;
}
.media-defer-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.status-slot-container,
.default-placeholder {
  width: 100%;
  min-height: 300px;
  /* 占位高度必不可少，否则在回收模式下由于高度瞬间变 0 导致被 Observer 判定为离开视口从而引发无限循环 */
  min-height: 100px;
  background-color: #f5f5f5;
}
.mask-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
img,
video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.default-loading,
.default-error {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}
</style>
