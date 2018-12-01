const clipboard = new ClipboardJS('.copy-btn');
const btn = document.querySelector('.copy-btn');
let tick;
clipboard.on('success', e => {
  e.clearSelection();
  btn.classList.add('success');
  clearTimeout(tick);
  tick = setTimeout(() => btn.classList.remove('success'), 3000);
});
