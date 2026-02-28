/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue-demi';

  interface MediaDeferProps {
    src: string;
    type?: 'image' | 'video';
    maskPosition?: 'inner' | 'outer';
    containerClass?: string;
    containerStyle?: Record<string, any>;
    mediaClass?: string;
    mediaStyle?: Record<string, any>;
    maskClass?: string;
    maskStyle?: Record<string, any>;
    layer?: boolean;
    options?: IntersectionObserverInit;
    delay?: number;
    abortable?: boolean;
  }

  interface MediaDeferPublicInstance {
    reset: () => void;
  }

  const component: DefineComponent<MediaDeferProps, MediaDeferPublicInstance>;
  export default component;
}