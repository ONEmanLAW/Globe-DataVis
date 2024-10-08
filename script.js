const width = window.innerWidth;
const height = window.innerHeight;

// Créer un contexte 2D pour le canvas principal
const canvas = d3.select("#globeCanvas")
  .attr("width", width)
  .attr("height", height)
  .node();

const context = canvas.getContext("2d");

// Projection orthographique
const projection = d3.geoOrthographic()
  .scale(250)
  .translate([width / 2, height / 2])
  .clipAngle(90);

// Initialiser les chemins
const path = d3.geoPath(projection, context);
const sphere = { type: "Sphere" };

let land50, land110;

// Définir les régions
const regions = [
  { name: "Amérique du Nord", coordinates: [[-170, 20], [-50, 50]] },
  { name: "Europe", coordinates: [[-25, 35], [50, 72]] },
  { name: "Amérique du Sud", coordinates: [[-80, -60], [-35, 10]] },
  { name: "Afrique", coordinates: [[-20, -40], [50, 40]] },
  { name: "Asie", coordinates: [[30, -10], [180, 70]] },
  { name: "Océanie", coordinates: [[110, -50], [180, 10]] },
];

// Chargement des données du monde
Promise.all([
  d3.json("https://d3js.org/world-110m.v1.json").then(world => {
    land110 = topojson.feature(world, world.objects.countries);
  }),
  d3.json("https://d3js.org/world-50m.v1.json").then(world => {
    land50 = topojson.feature(world, world.objects.countries);
  })
]).then(() => {
  render(land50);
  d3.select(canvas).call(drag(projection));
});

// Fonction de rendu du globe
function render(land) {
  context.clearRect(0, 0, width, height);
  context.beginPath();
  path(sphere);
  context.fillStyle = "#d3d3d3"; // Couleur de l'océan
  context.fill();

  context.beginPath();
  path(land);
  context.fillStyle = "#69b3a2"; // Couleur des terres
  context.fill();

  context.beginPath();
  path(sphere);
  context.strokeStyle = "#fff"; // Couleur de la ligne de la sphère
  context.stroke();
}

// Fonction de gestion du glisser
function drag(projection) {
  let v0, q0, r0, a0, l;
  let lastRenderTime = 0;
  const renderThreshold = 10; // Seuil de temps entre les rendus (ms)

  function pointer(event) {
    const t = d3.pointers(event);
    if (t.length !== l) {
      l = t.length;
      if (l > 1) a0 = Math.atan2(t[1][1] - t[0][1], t[1][0] - t[0][0]);
      dragstarted.apply(this, [event]);
    }
    if (l > 1) {
      const x = d3.mean(t, p => p[0]);
      const y = d3.mean(t, p => p[1]);
      return [x, y];
    }
    return t[0];
  }

  function dragstarted(event) {
    v0 = versor.cartesian(projection.invert([event.x, event.y]));
    q0 = versor(r0 = projection.rotate());
  }

  function dragged(event) {
    const v1 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]));
    const delta = versor.delta(v0, v1);
    let q1 = versor.multiply(q0, delta);

    // Pour multitouch, composer avec une rotation autour de l'axe
    const p = pointer(event);
    if (p[2]) {
      const d = (p[2] - a0) / 2;
      const s = -Math.sin(d);
      const c = Math.sign(Math.cos(d));
      q1 = versor.multiply([Math.sqrt(1 - s * s), 0, 0, c * s], q1);
    }

    // Mettre à jour la projection
    projection.rotate(versor.rotation(q1));

    // Optimisation : Render seulement si assez de temps s'est écoulé
    const currentTime = performance.now();
    if (currentTime - lastRenderTime > renderThreshold) {
      lastRenderTime = currentTime; // Mettre à jour le temps du dernier rendu
      requestAnimationFrame(() => render(land110)); // Utilisation de requestAnimationFrame pour la fluidité
    }
  }

  // Événement de clic pour détecter la région ou le pays
  canvas.addEventListener("click", (event) => {
    const [x, y] = d3.pointer(event);
    const coords = projection.invert([x, y]); // Obtenir les coordonnées géographiques
    const [longitude, latitude] = coords;

    // Vérifier si on a cliqué sur une région
    const clickedRegion = regions.find(region => {
      return longitude >= region.coordinates[0][0] && longitude <= region.coordinates[1][0] &&
             latitude >= region.coordinates[0][1] && latitude <= region.coordinates[1][1];
    });

    if (clickedRegion) {
      console.log(`Vous avez cliqué sur : ${clickedRegion.name}`);
      alert(`Vous avez cliqué sur : ${clickedRegion.name}`);
      return; // Sortir si une région a été cliquée
    }

    // Vérifier si on a cliqué sur un pays
    const clickedCountry = land110.features.find(feature => {
      return d3.geoContains(feature.geometry, [longitude, latitude]);
    });

    if (clickedCountry) {
      console.log(`Vous avez cliqué sur : ${clickedCountry.properties.name}`);
      alert(`Vous avez cliqué sur : ${clickedCountry.properties.name}`);
    } else {
      console.log("Vous n'avez pas cliqué sur un pays.");
      alert("Vous n'avez pas cliqué sur un pays.");
    }
  });

  return d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged);
}
