function onLoad() {
  document.getElementById("tuco-url-txt").value = window.arguments[1].dst;
}

function doOK(){
  window.arguments[1].dst = document.getElementById("tuco-url-txt").value;
  window.arguments[1].title = document.getElementById("tuco-title-txt").value;
  window.arguments[1].tags = document.getElementById("tuco-tags-txt").value;

  return true;
}
function doCancel(){
  return true;
}
