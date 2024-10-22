const width = window.innerWidth;
const height = window.innerHeight;
const globeRadius = 350;
const centerX = width / 2;
const centerY = height / 2;

const canvas = d3.select("#globeCanvas")
  .attr("width", width)
  .attr("height", height)
  .node();

const context = canvas.getContext("2d");
const projection = d3.geoOrthographic()
  .scale(globeRadius)
  .translate([centerX, centerY])
  .clipAngle(90);
const path = d3.geoPath(projection, context);
const sphere = { type: "Sphere" };

let continent, continentData, isDragging = false;
let lastRenderTime = 0;
const renderThreshold = 16;
const rotationSpeed = 0.08;

Promise.all([
  d3.json("continents.topojson").then(topo => {
    console.log("TopoJSON chargé :", topo);
    
    if (topo.objects && topo.objects.continent) {
      continent = topojson.feature(topo, topo.objects.continent);
      console.log("Géométries extraites :", continent);
    } else {
      console.error("L'objet continent n'existe pas dans le TopoJSON.");
    }
  }).catch(error => {
    console.error("Erreur lors du chargement du TopoJSON :", error);
  }),

  d3.json("data.json").then(data => {
    console.log("Données supplémentaires chargées :", data);
    continentData = data.continent;
  }).catch(error => {
    console.error("Erreur lors du chargement des données supplémentaires :", error);
  })
]).then(() => {
  if (continent && continentData) {
    renderStatic();
    d3.select(canvas).call(drag(projection));
    animateRotation();
  } else {
    console.error("Les données nécessaires n'ont pas été chargées correctement.");
  }
});

function renderStatic() {
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#d3d3d3";
  context.beginPath();
  path(sphere);
  context.fill();

  continent.features.forEach(feature => {
    context.fillStyle = getColorForContinent(feature.properties.continent);
    context.beginPath();
    path(feature);
    context.fill();
    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.beginPath();
    path(feature);
    context.stroke();
  });

  context.strokeStyle = "#000";
  context.lineWidth = 1;
  context.beginPath();
  path(sphere);
  context.stroke();
}

function getColorForContinent(name) {
  switch (name) {
    case "South America": return "#ffcc00";
    case "North America": return "#69b3a2";
    case "Europe": return "#ff0000";
    case "Africa": return "#ff7f50";
    case "Asia": return "#00bfff";
    case "Oceania": return "#32cd32";
    case "Antarctica": return "#a9a9a9";
    default: return "#ffffff";
  }
}

function updateGlobeRotation() {
  renderStatic();
}

function animateRotation() {
  if (!isDragging) {
    const rotation = projection.rotate();
    rotation[0] -= rotationSpeed;
    projection.rotate(rotation);
    updateGlobeRotation();
  }
  requestAnimationFrame(animateRotation);
}

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

function handleClick([longitude, latitude]) {
  const clickedContinent = continent.features.find(feature =>
    d3.geoContains(feature.geometry, [longitude, latitude])
  );

  if (clickedContinent) {
    const continentName = clickedContinent.properties.continent;
    const continentInfo = continentData.find(continent => continent.name === continentName);
    
    if (continentInfo) {
      alert(`Vous avez cliqué sur : ${continentName}\nPopulation: ${continentInfo.population}\nPIB: ${continentInfo.gdp}`);
    }
  }
}
