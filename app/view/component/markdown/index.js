// highlight
const codeList = document.querySelectorAll('.markdown-body pre code');
codeList.forEach(dom => {
  if (dom.className.includes('language-')) {
    hljs.highlightBlock(dom);
  }
});
