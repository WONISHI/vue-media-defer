<template>
  <div class="lazy-media-contain">
    <div
      ref="wrapperRef"
      class="lazy-media-wrapper"
      :class="containerClass"
      :style="containerStyle"
    >
      <template v-if="status === 'loaded'">
        <img
          v-if="type === 'image'"
          :src="renderSrc"
          :class="mediaClass"
          :style="mediaStyle"
          alt="loaded-media"
        />
        <video
          v-else-if="type === 'video'"
          :src="renderSrc"
          :class="mediaClass"
          :style="mediaStyle"
          muted
          preload="auto"
        ></video>

        <slot></slot>

        <div
          v-if="maskPosition === 'inner' && status !== 'loading'"
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
      v-if="maskPosition === 'outer' && status !== 'loading'"
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
} from "vue-demi";

export default defineComponent({
  name: "DemandLoader",
  props: {
    src: { type: String, required: true },
    type: {
      type: String,
      default: "image",
      validator: (v) => ["image", "video"].includes(v),
    },
    maskPosition: {
      type: String,
      default: "inner",
      validator: (v) => ["outer", "inner"].includes(v),
    },
    containerClass: { type: String, default: "" },
    containerStyle: { type: Object, default: () => ({}) },
    mediaClass: { type: String, default: "" },
    mediaStyle: { type: Object, default: () => ({}) },
    maskClass: { type: String, default: "" },
    maskStyle: { type: Object, default: () => ({}) },
    options: {
      type: Object,
      default: () => ({
        root: null,
        rootMargin: "100px 0px 100px 0px",
        threshold: 0,
      }),
    },
    delay: { type: Number, default: 0 },
    abortable: { type: Boolean, default: true },
  },

  setup(props) {
    // 2. 使用 ref 定义响应式数据
    const status = ref("placeholder");
    const renderSrc = ref("");
    const wrapperRef = ref(null); // 对应 template 中的 ref="wrapperRef"

    // 非响应式变量 (相当于 created 中的 this.xxx)
    let observer = null;
    let abortController = null;
    let delayTimer = null;
    let objectUrl = null;

    // --- 方法定义 ---

    const revokeUrl = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const stopObserve = () => {
      if (observer) {
        if (wrapperRef.value) observer.unobserve(wrapperRef.value);
        observer.disconnect();
        observer = null;
      }
    };

    const abortRequest = () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      if (status.value === "loading") {
        status.value = "placeholder";
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
      if (status.value === "loaded" || status.value === "loading") return;
      status.value = "loading";

      try {
        if (props.type === "image") {
          if (typeof window !== "undefined" && window.AbortController) {
            abortController = new AbortController();
          }
          const fetchOptions = abortController
            ? { signal: abortController.signal }
            : {};

          const response = await fetch(props.src, fetchOptions);
          if (!response.ok)
            throw new Error(`Network error: ${response.status}`);

          const blob = await response.blob();
          if (status.value !== "loading") return;

          revokeUrl();
          objectUrl = URL.createObjectURL(blob);
          renderSrc.value = objectUrl;
          status.value = "loaded";
          stopObserve();
        } else {
          const tempVideo = document.createElement("video");
          tempVideo.src = props.src;
          tempVideo.preload = "metadata";

          await new Promise((resolve, reject) => {
            tempVideo.onloadeddata = () => resolve();
            tempVideo.onerror = (e) => reject(e);
          });

          if (status.value !== "loading") {
            tempVideo.src = "";
            return;
          }
          renderSrc.value = props.src;
          status.value = "loaded";
          stopObserve();
          tempVideo.src = "";
        }
      } catch (error) {
        if (error.name === "AbortError") {
          status.value = "placeholder";
        } else {
          console.error("[DemandLoader] Error:", error);
          status.value = "error";
        }
      } finally {
        abortController = null;
      }
    };

    const handleIntersect = (entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        if (status.value === "loaded" || status.value === "loading") return;
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
        if (props.abortable && status.value === "loading") {
          abortRequest();
        }
      }
    };

    const initObserver = () => {
      if (observer) return;
      if (
        typeof window === "undefined" ||
        !("IntersectionObserver" in window)
      ) {
        loadResource();
        return;
      }
      observer = new IntersectionObserver(handleIntersect, props.options);
      if (wrapperRef.value) {
        observer.observe(wrapperRef.value);
      }
    };

    const reset = () => {
      abortRequest();
      revokeUrl();
      status.value = "placeholder";
      renderSrc.value = "";
    };

    // --- 生命周期 & Watcher ---

    // 监听 src 变化
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
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          initObserver();
        });
      }
    });

    // Vue-demi 让这个钩子同时在 Vue 2 和 Vue 3 生效
    onBeforeUnmount(() => {
      cleanup();
    });

    // 必须返回给模板使用
    return {
      status,
      renderSrc,
      wrapperRef,
      // 导出给父组件调用的方法(如果需要)或者模板内部方法
      reset,
    };
  },
});
</script>

<style scoped>
.lazy-media-contain {
  overflow: hidden;
  width: 100%;
  height: 100%;
}
.lazy-media-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
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
