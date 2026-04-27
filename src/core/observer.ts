export class ObserverManager {
  // 缓存不同配置的 Observer 实例
  private observers = new Map<string, IntersectionObserver>();
  // 存储元素与其对应的回调函数
  private callbackMap = new WeakMap<Element, Function>();
  // 新增：记录每个 Observer 实例当前观察的元素数量，用于内存回收
  private observerReferenceCount = new Map<string, number>();

  /**
   * 生成配置的唯一标识，用于复用相同配置的 Observer 实例
   */
  private getOptionsKey(options?: IntersectionObserverInit): string {
    if (!options) return 'default';
    // 序列化关键配置项作为 Key
    return `${options.rootMargin || '0px'}_${options.threshold || 0}`;
  }

  /**
   * 注册观察目标
   */
  public observe(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
    options?: IntersectionObserverInit,
  ): void {
    const key = this.getOptionsKey(options);
    let observer = this.observers.get(key);

    if (!observer) {
      // 创建新实例
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const cb = this.callbackMap.get(entry.target);
            if (cb) cb(entry);
          });
        },
        options || { rootMargin: '100px 0px 100px 0px', threshold: 0 },
      );

      this.observers.set(key, observer);
      this.observerReferenceCount.set(key, 0);
    }

    // 建立元素与回调的映射
    this.callbackMap.set(element, callback);
    observer.observe(element);

    // 增加引用计数
    const currentCount = this.observerReferenceCount.get(key) || 0;
    this.observerReferenceCount.set(key, currentCount + 1);
  }

  /**
   * 取消观察目标
   */
  public unobserve(element: Element, options?: IntersectionObserverInit): void {
    const key = this.getOptionsKey(options);
    const observer = this.observers.get(key);

    if (observer) {
      observer.unobserve(element);
      this.callbackMap.delete(element);

      // 减少引用计数
      const currentCount = this.observerReferenceCount.get(key) || 1;
      const newCount = currentCount - 1;

      if (newCount <= 0) {
        // 优化：如果没有元素再使用该实例，则彻底销毁它以释放内存
        observer.disconnect();
        this.observers.delete(key);
        this.observerReferenceCount.delete(key);
      } else {
        this.observerReferenceCount.set(key, newCount);
      }
    }
  }
}

export const globalObserver = new ObserverManager();
