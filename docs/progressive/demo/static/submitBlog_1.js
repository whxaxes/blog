window.submitBlog = function() {
  const title = document.getElementById('title');
  const content = document.getElementById('content');
  if (!title || !content) return alert('数据不能为空');

  // 发个异步请求
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/edit${window.blogId ? `/${window.blogId}` : ''}`);
  // 设置请求数据类型为 json
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      const resp = JSON.parse(xhr.responseText);

      // 提交完成，跳转到详情页
      if (resp.id) location.href = '/detail/' + resp.id;
    }
  };

  // 发送请求
  xhr.send(JSON.stringify({ title: title.value, content: content.value }));
};
