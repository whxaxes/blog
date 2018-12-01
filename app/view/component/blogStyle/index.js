const items = document.querySelectorAll('.item');

// show blog item one by one
show(0);

function show(index) {
  if (index >= items.length) {
    return;
  }

  setTimeout(() => {
    items[index].classList.add('active');
    show(index + 1);
  }, 80);
}
