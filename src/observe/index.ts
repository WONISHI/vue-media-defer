export class ObserverManager {
  // 缓存不同配置的 Observer 实例
  private observers = new Map<string, IntersectionObserver>();
  private callbackMap = new WeakMap<Element, Function>();

  // 生成配置的唯一标识
  private getOptionsKey(options?: IntersectionObserverInit) {
    if (!options) return 'default';
    return `${options.rootMargin || '0px'}_${options.threshold || 0}`;
  }

  public observe(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit
  ) {
    const key = this.getOptionsKey(options);
    let observer = this.observers.get(key);

    // 如果该配置的实例不存在，则创建一个新的
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const cb = this.callbackMap.get(entry.target);
          if (cb) cb(entry);
        });
      }, options || { rootMargin: '100px 0px 100px 0px', threshold: 0 });
      this.observers.set(key, observer);
    }

    this.callbackMap.set(element, callback);
    observer.observe(element);
  }

  public unobserve(element: Element, options?: IntersectionObserverInit) {
    this.callbackMap.delete(element);
    const key = this.getOptionsKey(options);
    const observer = this.observers.get(key);
    if (observer) {
      observer.unobserve(element);
    }
  }
}

export const globalObserver = new ObserverManager();