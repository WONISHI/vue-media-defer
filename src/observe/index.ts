export class ObserverManager {
  private observer: IntersectionObserver | null = null;
  // 使用 WeakMap 关联 DOM 节点和对应的回调函数，防止内存泄漏
  private callbackMap = new WeakMap<Element, Function>();

  constructor() {}

  // 懒汉式初始化 Observer，保证全局只实例化一次
  private initObserver(options: IntersectionObserverInit) {
    if (this.observer) return;

    this.observer = new IntersectionObserver((entries) => {
      // 遍历所有发生交叉变化的元素
      entries.forEach((entry) => {
        // 从 Map 中找到该元素对应的回调函数并执行
        const callback = this.callbackMap.get(entry.target);
        if (callback) {
          callback(entry); // 直接把当前 entry 传过去
        }
      });
    }, options);
  }

  /**
   * 添加观察
   * @param element 需要观察的 DOM 元素
   * @param callback 交叉时的回调函数
   * @param options 观察配置（只在第一次初始化时生效）
   */
  public observe(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit,
  ) {
    if (!this.observer) {
      // 默认提供一个较好的提前加载边距
      this.initObserver(
        options || { rootMargin: '100px 0px 100px 0px', threshold: 0 },
      );
    }
    // 将 DOM 和它的专属回调绑定
    this.callbackMap.set(element, callback);
    this.observer?.observe(element);
  }

  /**
   * 取消观察
   * @param element 需要取消观察的 DOM 元素
   */
  public unobserve(element: Element) {
    this.callbackMap.delete(element);
    if (this.observer) {
      this.observer.unobserve(element);
    }
  }
}

// 导出一个全局单例实例
export const globalObserver = new ObserverManager();
