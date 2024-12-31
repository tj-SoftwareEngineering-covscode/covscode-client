export class PendingPromise {
    promise: Promise<void>;
  
    // 提供给外部的 resolve 和 reject 方法
    resolve: () => void = () => {};
    reject: () => void = () => {};
  
    constructor() {
      // 创建一个新的 Promise，传入 resolve 和 reject 的处理函数
      this.promise = new Promise<void>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      });
    }
  }
  