const width = window.innerWidth;
const height = window.innerHeight;

const canvas = d3.select("#globeCanvas")
  .attr("width", width)
  .attr("height", height)
  .node();

const context = canvas.getContext("2d");


const projection = d3.geoOrthographic()
  .scale(250)
  .translate([width / 2, height / 2])
  .clipAngle(90);

const path = d3.geoPath(projection, context);
const sphere = { type: "Sphere" };

let land50, land110;

// Charger les données du monde
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

    projection.rotate(versor.rotation(q1));

    const currentTime = performance.now();
    if (currentTime - lastRenderTime > renderThreshold) {
      lastRenderTime = currentTime;
      requestAnimationFrame(() => render(land110));
    }
  }

  return d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged);
}
