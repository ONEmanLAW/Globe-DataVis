const width = window.innerWidth;
const height = window.innerHeight;
const globeRadius = 350;
const centerX = width / 2;
const centerY = height / 2;

const canvas = d3.select("#globeCanvas")
  .attr("width", width)
  .attr("height", height)
  .node();

canvas.style.cursor = "default";
const context = canvas.getContext("2d");
const projection = d3.geoOrthographic()
  .scale(globeRadius)
  .translate([centerX, centerY])
  .clipAngle(90);
const path = d3.geoPath(projection, context);
const sphere = { type: "Sphere" };

let land110, isDragging = false;
let lastRenderTime = 0;
const renderThreshold = 16;
const rotationSpeed = 0.08;

// Définition des régions
const regions = [
  { name: "Amérique du Nord", coordinates: [[-170, 10], [-50, 75]], color: "#69b3a2" },
  { name: "Europe", coordinates: [[-25, 35], [50, 72]], color: "#ff0000" },
  { name: "Amérique du Sud", coordinates: [[-80, -60], [-35, 15]], color: "#ffcc00" },
  { name: "Afrique", coordinates: [[-20, -40], [50, 40]], color: "#ff7f50" },
  { name: "Asie", coordinates: [[30, -10], [180, 70]], color: "#00bfff" },
  { name: "Océanie", coordinates: [[110, -50], [180, 10]], color: "#32cd32" },
  { name: "Antarctique", coordinates: [[-180, -90], [180, -60]], color: "#a9a9a9" }
];

// Chargement des données géographiques
Promise.all([
  d3.json("https://d3js.org/world-110m.v1.json").then(world => {
    land110 = topojson.feature(world, world.objects.countries);
  })
]).then(() => {
  renderStatic();
  d3.select(canvas).call(drag(projection));
  animateRotation();
});

// Fonction pour dessiner le globe
function renderStatic() {
  context.clearRect(0, 0, width, height);

  // Dessiner l'océan
  context.fillStyle = "#d3d3d3";
  context.beginPath();
  path(sphere);
  context.fill();

  // Dessiner les pays
  land110.features.forEach(feature => {
    const [longitude, latitude] = d3.geoCentroid(feature.geometry);
    const region = regions.find(region =>
      longitude >= region.coordinates[0][0] && longitude <= region.coordinates[1][0] &&
      latitude >= region.coordinates[0][1] && latitude <= region.coordinates[1][1]
    );

    context.fillStyle = region ? region.color : "#ffffff";
    context.beginPath();
    path(feature);
    context.fill();

    // Bordure entre pays
    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.beginPath();
    path(feature);
    context.stroke();
  });

  // Dessiner la sphère (le globe)
  context.strokeStyle = "#000";
  context.lineWidth = 1;
  context.beginPath();
  path(sphere);
  context.stroke();
}

// Mettre à jour la rotation du globe
function updateGlobeRotation() {
  context.clearRect(0, 0, width, height);
  renderStatic();
}

// Animer la rotation du globe
function animateRotation() {
  if (!isDragging) {
    const rotation = projection.rotate();
    rotation[0] -= rotationSpeed;
    projection.rotate(rotation);
    updateGlobeRotation();
  }
  requestAnimationFrame(animateRotation);
}

// Gestion du drag
function drag(projection) {
  let v0, q0, r0, l;

  function pointer(event) {
    const t = d3.pointers(event);
    if (t.length !== l) {
      l = t.length;
      if (l > 1) {
        const [y1, y0] = [t[1][1], t[0][1]];
        const [x1, x0] = [t[1][0], t[0][0]];
        const a0 = Math.atan2(y1 - y0, x1 - x0);
      }
      dragstarted(event);
    }
    return l > 1 ? [d3.mean(t, p => p[0]), d3.mean(t, p => p[1])] : t[0];
  }

  function dragstarted(event) {
    isDragging = true;
    const [x, y] = d3.pointer(event);
    if (isOutOfBounds(x, y)) return;

    v0 = versor.cartesian(projection.invert([event.x, event.y]));
    q0 = versor(r0 = projection.rotate());
  }

  function dragged(event) {
    const [x, y] = d3.pointer(event);
    if (isOutOfBounds(x, y)) return;

    const v1 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]));
    const delta = versor.delta(v0, v1);
    const q1 = versor.multiply(q0, delta);
    projection.rotate(versor.rotation(q1));

    const currentTime = performance.now();
    if (currentTime - lastRenderTime > renderThreshold) {
      lastRenderTime = currentTime;
      updateGlobeRotation();
    }
  }

  function dragended() {
    isDragging = false;
  }

  function isOutOfBounds(x, y) {
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.sqrt(dx * dx + dy * dy) > globeRadius;
  }

  canvas.addEventListener("click", (event) => {
    const [x, y] = d3.pointer(event);
    if (isOutOfBounds(x, y)) return;

    const coords = projection.invert([x, y]);
    handleClick(coords);
  });

  canvas.addEventListener("mousemove", (event) => {
    const [x, y] = d3.pointer(event);
    canvas.style.cursor = isOutOfBounds(x, y) ? "default" : "grab";
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
  });

  return d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

// Fonction pour gérer les clics
function handleClick([longitude, latitude]) {
  const clickedRegion = regions.find(region =>
    longitude >= region.coordinates[0][0] && longitude <= region.coordinates[1][0] &&
    latitude >= region.coordinates[0][1] && latitude <= region.coordinates[1][1]
  );

  if (clickedRegion) {
    alert(`Vous avez cliqué sur : ${clickedRegion.name}`);
    return;
  }

  const clickedCountry = land110.features.find(feature =>
    d3.geoContains(feature.geometry, [longitude, latitude])
  );

  if (clickedCountry) {
    alert(`Vous avez cliqué sur : ${clickedCountry.properties.name}`);
  }
}
