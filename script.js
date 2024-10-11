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

let land110, currentRotation = projection.rotate(), isDragging = false;
let lastRenderTime = 0;
const renderThreshold = 16;
const rotationSpeed = 0.08;

const regions = [
  { name: "Amérique du Nord", coordinates: [[-170, 20], [-50, 50]] },
  { name: "Europe", coordinates: [[-25, 35], [50, 72]] },
  { name: "Amérique du Sud", coordinates: [[-80, -60], [-35, 10]] },
  { name: "Afrique", coordinates: [[-20, -40], [50, 40]] },
  { name: "Asie", coordinates: [[30, -10], [180, 70]] },
  { name: "Océanie", coordinates: [[110, -50], [180, 10]] },
];

Promise.all([
  d3.json("https://d3js.org/world-110m.v1.json").then(world => {
    land110 = topojson.feature(world, world.objects.countries);
  })
]).then(() => {
  renderStatic(); 
  d3.select(canvas).call(drag(projection));
  animateRotation();
});

function renderStatic() {
  context.clearRect(0, 0, width, height);
  
  
  context.beginPath();
  path(sphere);
  context.fillStyle = "#d3d3d3";
  context.fill();
  

  context.beginPath();
  path(land110);
  context.fillStyle = "#69b3a2"; 
  context.fill();
  
  
  context.beginPath();
  path(land110);
  context.lineWidth = 0.5;
  context.strokeStyle = "#000";  
  context.stroke();
  

  context.beginPath();
  path(sphere);
  context.strokeStyle = "#000"; 
  context.lineWidth = 1;  
  context.stroke();
}

function updateGlobeRotation() {
  context.clearRect(0, 0, width, height);
  renderStatic();
}

function animateRotation() {
  if (!isDragging) {
    
    let rotation = projection.rotate();
    rotation[0] -= rotationSpeed; // Sens de rotation
    projection.rotate(rotation);

  
    updateGlobeRotation();
  }

  requestAnimationFrame(animateRotation);
}

function drag(projection) {
  let v0, q0, r0, a0, l;

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
    isDragging = true;  
    const [x, y] = d3.pointer(event);
    const dx = x - centerX;
    const dy = y - centerY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    if (distanceFromCenter > globeRadius) {
      return;
    }

    v0 = versor.cartesian(projection.invert([event.x, event.y]));
    q0 = versor(r0 = projection.rotate());
  }

  function dragged(event) {
    const [x, y] = d3.pointer(event);
    const dx = x - centerX;
    const dy = y - centerY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    if (distanceFromCenter > globeRadius) {
      return;
    }

    const v1 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]));
    const delta = versor.delta(v0, v1);
    let q1 = versor.multiply(q0, delta);

    projection.rotate(versor.rotation(q1));

    const currentTime = performance.now();
    if (currentTime - lastRenderTime > renderThreshold) {
      lastRenderTime = currentTime;
      requestAnimationFrame(() => updateGlobeRotation());
    }
  }

  function dragended() {
    isDragging = false;
  }

  canvas.addEventListener("click", (event) => {
    const [x, y] = d3.pointer(event);
    const dx = x - centerX;
    const dy = y - centerY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    if (distanceFromCenter > globeRadius) {
      console.log("Clic en dehors du globe.");
      return;
    }

    const coords = projection.invert([x, y]);
    const [longitude, latitude] = coords;

    const clickedRegion = regions.find(region => {
      return longitude >= region.coordinates[0][0] && longitude <= region.coordinates[1][0] &&
             latitude >= region.coordinates[0][1] && latitude <= region.coordinates[1][1];
    });

    if (clickedRegion) {
      alert(`Vous avez cliqué sur : ${clickedRegion.name}`);
      return;
    }

    const clickedCountry = land110.features.find(feature => {
      return d3.geoContains(feature.geometry, [longitude, latitude]);
    });

    if (clickedCountry) {
      alert(`Vous avez cliqué sur : ${clickedCountry.properties.name}`);
    } else {
      console.log("Vous n'avez pas cliqué sur un pays.");
    }
  });

  canvas.addEventListener("mousemove", (event) => {
    const [x, y] = d3.pointer(event);
    const dx = x - centerX;
    const dy = y - centerY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    canvas.style.cursor = distanceFromCenter <= globeRadius ? "grab" : "default";
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
  });

  return d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}
