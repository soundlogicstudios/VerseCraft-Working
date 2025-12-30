console.log("VerseCraft App.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("BtnRefreshStories")?.addEventListener("click", () => {
    alert("Refresh clicked — wiring confirmed");
  });

  document.getElementById("BtnStartSelected")?.addEventListener("click", () => {
    alert("Start clicked — UI alive");
  });
});
