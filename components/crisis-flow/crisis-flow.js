// components/crisis-flow/crisis-flow.js —— 危机应对流程图展示（可预览/另存）
Component({
  properties: {},
  methods: {
    preview() {
      wx.previewImage({ urls: ['/assets/crisis-flow.png'] });
    }
  }
});