const width = window.innerWidth;
const height = window.innerHeight;
const globeRadius = 300;
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

let continent, continentData;
let isDragging = false, isMouseDown = false, inGlobe = false;
let lastRenderTime = 0;
const renderThreshold = 16; // ms
const rotationSpeed = 0.08; // degrees per frame

Promise.all([
  d3.json("continents.topojson").then(topo => {
    continent = topojson.feature(topo, topo.objects.continent);
  }),
  d3.json("data.json").then(data => {
    continentData = data.continent;
  })
]).then(() => {
  if (continent && continentData) {
    renderStatic();
    d3.select(canvas).call(drag(projection));
    animateRotation();
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
  const colors = {
    "South America": "#ffcc00",
    "North America": "#69b3a2",
    "Europe": "#ff0000",
    "Africa": "#ff7f50",
    "Asia": "#00bfff",
    "Oceania": "#32cd32",
    "Antarctica": "#a9a9a9",
    "default": "#ffffff"
  };
  return colors[name] || colors.default;
}

function updateGlobeRotation() {
  context.clearRect(0, 0, width, height);
  renderStatic();
}

function animateRotation() {
  if (!isDragging && !isMouseDown) {
    const rotation = projection.rotate();
    rotation[0] -= rotationSpeed;
    projection.rotate(rotation);
    updateGlobeRotation();
  }
  requestAnimationFrame(animateRotation);
}

function drag(projection) {
  let v0, q0, r0;

  function isInsideGlobe(x, y) {
    const dx = x - centerX;
    const dy = y - centerY;
    return Math.sqrt(dx * dx + dy * dy) <= globeRadius;
  }

  function dragstarted(event) {
    const [x, y] = d3.pointer(event);
    if (isInsideGlobe(x, y)) {
      canvas.style.cursor = "grab";
      isDragging = true;
      isMouseDown = true;
      inGlobe = true;
      v0 = versor.cartesian(projection.invert([event.x, event.y]));
      q0 = versor(r0 = projection.rotate());
    }
  }

  function dragged(event) {
    if (!inGlobe) return;

    const [x, y] = d3.pointer(event);
    if (!isInsideGlobe(x, y)) {
      dragended();
      return;
    }

    canvas.style.cursor = "grabbing";
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
    if (inGlobe) {
      isMouseDown = false;
      isDragging = false;
      inGlobe = false;
      canvas.style.cursor = "default";
    }
  }

  canvas.addEventListener("click", (event) => {
    const [x, y] = d3.pointer(event);
    if (isInsideGlobe(x, y)) {
      const coords = projection.invert([x, y]);
      handleClick(coords);
    }
  });

  canvas.addEventListener("mousedown", (event) => {
    const [x, y] = d3.pointer(event);
    if (isInsideGlobe(x, y)) {
      isMouseDown = true;
      canvas.style.cursor = "grab";
    }
  });

  canvas.addEventListener("mouseup", () => {
    isMouseDown = false;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("mousemove", (event) => {
    const [x, y] = d3.pointer(event);
    canvas.style.cursor = isMouseDown && inGlobe ? "grabbing" : "default";
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
      document.getElementById("continentName").textContent = `Vous avez cliqué sur : ${continentName}`;
      document.getElementById("continentPopulation").textContent = `Population: ${continentInfo.population}`;
      document.getElementById("continentGDP").textContent = `PIB: ${continentInfo.gdp}`;
    }
  }
}
