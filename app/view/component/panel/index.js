const panel = document.querySelector('.panel');

document.querySelector('.toggle-btn').onclick = () => {
  panel.classList.toggle('expand');
};

window.addEventListener('click', e => {
  if (
    traverseParentNode(e.target, dom => dom === panel) ||
    !panel.classList.contains('expand') ||
    e.target.tagName === 'A'
  ) {
    return;
  }

  panel.classList.remove('expand');
});

function traverseParentNode(dom, cb) {
  let d = dom;
  while (d && d !== document.body) {
    const result = cb(d);
    if (result) {
      return d;
    }
    d = d.parentNode;
  }
}
