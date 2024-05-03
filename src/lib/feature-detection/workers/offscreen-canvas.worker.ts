
self.onmessage = ({ data }) => {
    const { canvas } = data;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 2, 2);
    requestAnimationFrame(() => {
        self.postMessage({});
    });
}
