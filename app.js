const pageListEl = document.querySelector("#pageList");
const newPageButton = document.querySelector("#newPageButton");
const titleInput = document.querySelector("#titleInput");
const contentInput = document.querySelector("#contentInput");
const saveStatus = document.querySelector("#saveStatus");

function renderPageList() {
  pageListEl.innerHTML = "";
}

newPageButton.addEventListener("click", () => {
  saveStatus.textContent = "待实现";
});

renderPageList();
