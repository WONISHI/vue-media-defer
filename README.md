# Vue Media Defer

[![npm version](https://img.shields.io/npm/v/vue-media-defer.svg)](https://www.npmjs.com/package/vue-media-defer)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

🔥 一个高性能、支持 Vue 2 & Vue 3 的媒体（图片/视频）懒加载组件。

基于 `IntersectionObserver` 结合单例模式优化，并在滑出可视区域时利用 `AbortController` 彻底中断底层网络请求，极大节省网络带宽和内存消耗。

## 特性

- ⚡️ **跨版本兼容**：基于 `vue-demi`，无缝支持 Vue 2.6+ 和 Vue 3。
- 🚀 **极致性能**：全局单例 Observer 管理，渲染 1000+ 节点不卡顿。
- 🛑 **请求中断**：滑出可视区域自动中止图片和视频的后台 HTTP 下载。
- 🎨 **多状态插槽**：支持 `loading`、`error`、`placeholder` 状态的高度自定义。
- 🛠 **遮罩支持**：内置内外遮罩层逻辑，满足复杂 UI 需求。

## 安装

```bash
npm install vue-media-defer
# or
yarn add vue-media-defer
# or
pnpm add vue-media-defer

注意 (Vue 2 用户):
如果在 Vue 2 环境下使用，请确保已安装 @vue/composition-api 并引入源码：
import MediaDefer from 'vue-media-defer/src/MediaDefer.vue'
```

## 基础使用

```vue
<template>
  <div style="width: 100%; height: 300px;">
    <MediaDefer
      src="[https://example.com/image.jpg](https://example.com/image.jpg)"
      type="image"
    >
      <template #loading>
        <span>努力加载中...</span>
      </template>

      <template #error>
        <span>图片丢了~</span>
      </template>
    </MediaDefer>
  </div>
</template>

<script setup>
import { MediaDefer } from 'vue-media-defer';
import 'vue-media-defer/dist/vue-media-defer.css';
</script>
```

## Props 参数

| 参数名         | 类型    | 默认值                                                | 说明                                    |
| -------------- | ------- | ----------------------------------------------------- | --------------------------------------- |
| src            | String  | -                                                     | **(必填)** 媒体资源地址                 |
| type           | String  | `'image'`                                             | 资源类型，可选 `'image'` 或 `'video'`   |
| maskPosition   | String  | `'inner'`                                             | 遮罩层位置，可选 `'inner'` 或 `'outer'` |
| containerClass | String  | `''`                                                  | 媒体外部包裹容器的类名                  |
| mediaClass     | String  | `''`                                                  | `img` 或 `video` 标签本身的类名         |
| options        | Object  | `{ rootMargin: '100px 0px 100px 0px', threshold: 0 }` | `IntersectionObserver` 的原生配置项     |
| delay          | Number  | `0`                                                   | 延迟加载时间（毫秒），防抖作用          |
| abortable      | Boolean | `true`                                                | 滑出可视区域时是否允许中断请求          |

## 事件 Events

| 事件名 | 参数            | 说明                               |
| ------ | --------------- | ---------------------------------- |
| @load  | `{ type, src }` | 媒体资源加载成功后触发             |
| @error | `Error`         | 媒体资源加载失败或被手动中断时触发 |
