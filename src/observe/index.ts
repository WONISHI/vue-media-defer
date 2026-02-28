export class ObserverManager {
  private observers = new Map<string, IntersectionObserver>();
  private callbackMap = new WeakMap<Element, Function>();
  // 新增：记录每个 Observer 实例下的观察元素数量
  private observerCountMap = new Map<string, number>();

  private getOptionsKey(options?: IntersectionObserverInit) {
    if (!options) return 'default';
    return `${options.rootMargin || '0px'}_${options.threshold || 0}`;
  }

  public observe(
    element: Element,
    callback: Function,
    options?: IntersectionObserverInit,
  ) {
    const key = this.getOptionsKey(options);
    let observer = this.observers.get(key);

    if (!observer) {
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
      this.observerCountMap.set(key, 0);
    }

    this.callbackMap.set(element, callback);
    observer.observe(element);
    this.observerCountMap.set(key, (this.observerCountMap.get(key) || 0) + 1);
  }

  public unobserve(element: Element, options?: IntersectionObserverInit) {
    const key = this.getOptionsKey(options);
    const observer = this.observers.get(key);
    if (observer) {
      observer.unobserve(element);
      this.callbackMap.delete(element);

      // 当计数归零时销毁 Observer 实例
      const newCount = (this.observerCountMap.get(key) || 1) - 1;
      if (newCount <= 0) {
        observer.disconnect();
        this.observers.delete(key);
        this.observerCountMap.delete(key);
      } else {
        this.observerCountMap.set(key, newCount);
      }
    }
  }
}
