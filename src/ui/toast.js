export function createToast(element) {
  let timer;
  return message => {
    clearTimeout(timer);
    element.textContent = message;
    element.hidden = false;
    timer = setTimeout(() => { element.hidden = true; }, 1900);
  };
}
