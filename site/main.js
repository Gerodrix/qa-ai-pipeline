// site/main.js
//
// Just tab switching — show the panel matching the clicked button's
// data-tab, hide the rest. Nothing here needs a framework.

const tabButtons = document.querySelectorAll('.tab-button');
const tabPanels = document.querySelectorAll('.tab-panel');

for (const button of tabButtons) {
  button.addEventListener('click', () => {
    const targetId = button.dataset.tab;

    for (const otherButton of tabButtons) {
      otherButton.classList.toggle('active', otherButton === button);
    }
    for (const panel of tabPanels) {
      panel.classList.toggle('active', panel.id === targetId);
    }
  });
}
