// add index for every heading
const headings = document.querySelectorAll('.markdown-body .markdown-head');
const tocTree = [];
let parent;
let tocHtml = '';
headings.forEach(head => {
  const level = +head.tagName[1];
  const text = head.innerText;

  // add # to before
  const dom = document.createElement('a');
  dom.href = `#${text}`;
  dom.innerHTML = '';
  dom.classList.add('toc-link');
  head.insertBefore(dom, head.childNodes[0]);

  // create toc
  if (level === 1) {
    tocHtml += `<div class="toc-block toc-block-2"><a href="#${text}" class="toc-link">标题</a>`
    return;
  };

  while (parent && parent.level >= level) {
    tocHtml += '</div>\n';
    parent = parent.parent;
  }

  const arr = parent ? parent.children : tocTree;
  tocHtml += `<div class="toc-block toc-block-${level}"><a href="#${text}" class="toc-link">${text}</a>`;
  arr.push(parent = { level, text, parent, children: [] });
});
tocHtml += '</div>';

// add html to tocIndex
const tocDiv = document.querySelector('.toc-index');
const content = document.querySelector('.content');
const floatMod = document.querySelector('.float-mod');
tocDiv.innerHTML = tocHtml;

// listen scroll event
let initTop;
const links = tocDiv.querySelectorAll('.toc-link');
const onScroll = () => {
  if (initTop === undefined) {
    initTop = getAbsoluteTop(floatMod);
  }

  // update position
  const scrollTop = document.body.scrollTop + document.documentElement.scrollTop;
  let translate = scrollTop - initTop;
  if (translate > 0) {
    floatMod.classList.add('fixed');
    const rect = content.getBoundingClientRect();
    floatMod.style.left = `${rect.left + rect.width}px`;
  } else {
    floatMod.classList.remove('fixed');
    floatMod.style.left = '100%';
  }

  // change active toc with scrolling
  let i = 0;
  const addLink = index => {
    tocDiv.querySelectorAll('.active').forEach(link => link.classList.remove('active'));
    links[index].classList.add('active');
  };
  for (;i < headings.length; i++) {
    const top = getAbsoluteTop(headings[i]);
    if ((top - 50 < scrollTop)) {
      addLink(i)
    } else {
      if (!i) addLink(i);
      break;
    }
  }
}

onScroll();
window.addEventListener('scroll', onScroll);
window.addEventListener('resize', onScroll);

// auto attach to toc
function gotoHash() {
  const hash = location.hash.substring(1);
  const dom = hash && document.getElementById(`heading-${decodeURIComponent(hash)}`);
  if (!dom) return;
  window.scrollTo(0, getAbsoluteTop(dom) - 20);
}
setTimeout(gotoHash, 500);
window.addEventListener('hashchange', gotoHash);

// get offset top
function getAbsoluteTop(dom) {
  return dom.getBoundingClientRect().top + document.body.scrollTop + document.documentElement.scrollTop;
}
