const drinks = [
  "Paulaner Spezi",
  "Holunderschorle",
  "Bananenweizen",
  "Club Mate",
  "Kalter Kaffee mit Vanille",
  "Apfelsaftschorle",
  "Ginger Ale mit Limette",
  "Kirsch-Cola",
  "Himbeerbrause",
  "Kokoswasser"
];

const button = document.getElementById("generateButton");
const result = document.getElementById("result");
const box = document.getElementById("box");

button.addEventListener("click", () => {
  result.classList.add("hidden");
  result.textContent = "";
  box.classList.remove("open");

  // Starte nach 1 Sekunde die Box-Animation und zeige das Getränk
  setTimeout(() => {
    box.classList.add("open");

    const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
    result.textContent = `Dein Getränk: ${randomDrink}`;
    result.classList.remove("hidden");
  }, 1000);
});
