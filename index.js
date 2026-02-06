import { install } from "vue-demi";
import MediaDefer from "./src/MediaDefer.vue";

MediaDefer.install = function (Vue) {
  Vue.component(MediaDefer.name, MediaDefer);
};

export default MediaDefer;
