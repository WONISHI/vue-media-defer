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
          <slot :type="type" :src="renderSrc" :status="status">
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
        <slot name="loading" :status="status">
          <span class="default-msg">加载中...</span>
        </slot>
      </div>

      <div v-else-if="status === 'error'" class="slot-box error-box">
        <slot name="error" :status="status">
          <span class="default-msg">加载失败</span>
        </slot>
      </div>

      <div v-else class="slot-box placeholder-box">
        <slot name="placeholder" :status="status">
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
    layer: { type: Boolean, default: false },
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

  setup(props, { emit }) {
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
        globalObserver.unobserve(wrapperRef.value, props.options);
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

    const loadResource = async () => {
      if (status.value === 'loaded' || status.value === 'loading') return;
      status.value = 'loading';

      try {
        if (typeof window !== 'undefined' && window.AbortController) {
          abortController = new AbortController();
        }

        if (props.type === 'image') {
          const fetchOptions = abortController
            ? { signal: abortController.signal }
            : {};
          const response = await fetch(props.src, fetchOptions);
          if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);

          const blob = await response.blob();
          if (status.value !== 'loading') return;

          revokeUrl();
          objectUrl = URL.createObjectURL(blob);
          renderSrc.value = objectUrl;
          status.value = 'loaded';
          emit('load', { type: 'image', src: props.src });
          stopObserve();
        } else {
          const tempVideo = document.createElement('video');
          tempVideo.src = props.src;
          tempVideo.preload = 'metadata';

          await new Promise((resolve, reject) => {
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

            const handleAbort = () => {
              cleanupEvents();
              tempVideo.removeAttribute('src');
              tempVideo.load();
              reject({ name: 'AbortError' });
            };

            tempVideo.onloadeddata = () => {
              cleanupEvents();
              resolve();
            };

            tempVideo.onerror = (e) => {
              cleanupEvents();
              reject(e);
            };

            if (abortController) {
              abortController.signal.addEventListener('abort', handleAbort);
            }
          });

          if (status.value !== 'loading') return;

          renderSrc.value = props.src;
          status.value = 'loaded';
          emit('load', { type: 'video', src: props.src });
          stopObserve();
          tempVideo.removeAttribute('src');
          tempVideo.load();
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          status.value = 'placeholder';
        } else {
          console.error('[MediaDefer] Error:', error);
          status.value = 'error';
          emit('error', error);
        }
      } finally {
        abortController = null;
      }
    };

    const handleIntersect = (entry) => {
      if (entry && entry.isIntersecting) {
        if (status.value === 'loaded' || status.value === 'loading') return;
        if (props.delay > 0) {
          delayTimer = setTimeout(() => loadResource(), props.delay);
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
          nextTick(() => initObserver());
        }
      },
    );

    onMounted(() => {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => initObserver());
      }
    });

    onBeforeUnmount(() => {
      stopObserve();
      abortRequest();
      if (delayTimer) clearTimeout(delayTimer);
      revokeUrl();
    });

    return { status, renderSrc, wrapperRef, reset };
  },
});
</script>

<style scoped>
.media-defer-contain,
.media-defer-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 100px;
}
.media-defer-wrapper {
  position: relative;
}
.slot-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #f5f7fa;
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
