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

button.addEventListener("click", () => {
  result.classList.add("hidden");
  result.textContent = "Zufall wird generiert...";
  
  setTimeout(() => {
    const randomDrink = drinks[Math.floor(Math.random() * drinks.length)];
    result.textContent = `Heute trinkst du: ${randomDrink}!`;
    result.classList.remove("hidden");
  }, 3000);
});
