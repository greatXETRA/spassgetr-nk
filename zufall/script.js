const drinks = [
  "Paulaner Spezi",
  "Holunderschorle",
  "Kirsch-Banane",
  "Club Mate",
  "Apfelschorle",
  "Skiwasser",
  "Ginger Ale",
  "Kirsch-Cola",
  "Ahoj-Brause",
  "Kokoswasser"
];

const button = document.getElementById("generateButton");
const result = document.getElementById("result");

button.addEventListener("click", () => {
  result.classList.add("hidden");
  result.textContent = "Zufall wird generiert...";

  setTimeout(() => {
    const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
    result.textContent = `Dein Getränk: ${randomDrink}`;
    result.classList.remove("hidden");
  }, 1000); // 1 Sekunde
});
