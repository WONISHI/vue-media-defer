import { DefineComponent } from 'vue-demi';

export type LoadStatus = 'placeholder' | 'loading' | 'loaded' | 'error';
export type MediaType = 'image' | 'video';
export type MaskPosition = 'inner' | 'outer';

export interface MediaDeferProps {
  src: string;
  type?: MediaType;
  maskPosition?: MaskPosition;
  containerClass?: string;
  containerStyle?: Record<string, any>;
  mediaClass?: string;
  mediaStyle?: Record<string, any>;
  maskClass?: string;
  maskStyle?: Record<string, any>;
  showMask?: boolean; // 语义化调整：layer -> showMask
  observerOptions?: IntersectionObserverInit; // 语义化调整：options -> observerOptions
  delay?: number;
  abortable?: boolean;
  recycle?: boolean; // 新增：滑出视口时是否回收媒体资源
}

export interface MediaDeferExpose {
  reload: () => void; // 语义化调整：reset -> reload
}

export type MediaDeferComponent = DefineComponent<
  MediaDeferProps,
  MediaDeferExpose
>;
