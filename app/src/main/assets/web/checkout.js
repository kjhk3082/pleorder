(function (root, factory) {
  const value = factory();
  if (typeof module === "object") module.exports = value;
  else root.PleorderCheckout = value;
})(globalThis, () => {
  class SlideConfirmation {
    constructor(confirm) {
      this.confirm = confirm;
      this.progress = 0;
      this.completed = false;
      this.dragging = false;
    }
    begin(x, width) {
      if (this.completed) return;
      this.start = x;
      this.width = Math.max(1, width);
      this.progress = 0;
      this.dragging = true;
    }
    move(x) {
      if (!this.dragging || this.completed) return this.progress;
      return (this.progress = Math.max(
        0,
        Math.min(1, (x - this.start) / this.width),
      ));
    }
    release() {
      if (!this.dragging || this.completed) return false;
      this.dragging = false;
      if (this.progress >= 0.94) {
        this.completed = true;
        this.confirm();
        return true;
      }
      this.progress = 0;
      return false;
    }
    cancel() {
      this.dragging = false;
      this.progress = 0;
    }
  }
  return { SlideConfirmation };
});
