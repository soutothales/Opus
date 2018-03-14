
// D3 Constants
let NODES_OBJ = {};
let LINKS_OBJ = {};
let CHOSEN_ARR = [];
let nodes = [];
let links = [];
let point = [0, 0];
let ARTIST_INFO = {};
let listeners = [];
let clickedIds = {};

// D3 View Setup
var svg = d3.select("svg"),
  width = +svg.attr("width"),
  height = +svg.attr("height"),
  color = d3.scaleOrdinal(d3.schemeCategory20);

// Zoom setup
var zoom = d3.zoom()
    .on("zoom", zoomed);

let rect = svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("pointer-events", "all")
    .call(zoom);

function zoomed() {
  g.attr("transform", d3.event.transform);
}

// D3 Component Setup
let g = svg.append("g"),
  link = g.append("g").attr("stroke", color(d => d.group)).attr("stroke-width", 3).selectAll(".link"), //função color para colorir com outras cores
  node = g.append("g").attr('id', 'node-step').selectAll(".node"),
  text = g.append("g").selectAll(".text"),
  image = g.append("g").attr('id', 'image-step').selectAll(".image");

// D3 Render Function
function update() {
  let nodesArray = Object.values(NODES_OBJ);
  let linksArray = Object.values(LINKS_OBJ);

  // Update nodes. Circular objects for borders and layout.
  node = node.data(nodesArray, function(d) { return d.id; } );
  node.exit().remove();
  node = node.enter()
    .append("circle")
    .attr('class', 'node')
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
    .attr("r", 40)
    .attr('fill', '#f9f9f9')
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended))
    .merge(node);

  node.filter(function(d) { return clickedIds[d.id];} )
    .attr("fill", "#ff9d00")
    .attr("r", 48);

  // Conditional rendering for chosen nodes. Gold border vs. black
  node.filter(function(d, i) { return d.chosen;} )
    .attr('fill', '#ff9d00')
    .attr('r', 53);

  // Artist Images.
  image = image.data(nodesArray, function(d) { return d.id; } );
  image.exit().remove();
  image = image.enter()
    .append('g')
    .attr('class', 'image')
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
    // .attr("transition", "transform 0.1s ease-out")
    .style("cursor", "grab")
    .on("mouseover", mouseover)
    .on("mouseout", mouseout)
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended))
    .merge(image);

  // For circular images instead of rectangular
  image.append("clipPath")
    .attr('id', function(d) {return (`clipCircle${d.id}`);})
    .attr('class', 'clipPath')
    .append('circle')
    .attr('fill', '#222326')
    .attr("stroke", "#fff")
    .attr("stroke-width", 50)
    .attr('r', 40);

  // Image append and resize
  image.append('image')
    .attr('xlink:href', function(d) {
      if (d.images[2]) {
        return d.images[2].url;
      } else {
        return 'https://s3-us-west-2.amazonaws.com/opus-pro/opus-logo.png';
      }
    })
    .attr('width', (d) => setWidth(d))
    .attr('height', (d) => setHeight(d))
    .attr('y', '-40px')
    .attr("clip-path", function(d) {return (`url(#clipCircle${d.id})`);})
    .attr('x', '-40px');

  // Links between nodes
  link = link.data(linksArray, function(d) { return d.source.id + "-" + d.target.id; });
  link.exit().remove();
  link = link.enter()
    .append("line")
    .attr('class', 'link')
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
    .merge(link);

  // Highlight chosen links
  link.filter(function(d) {
    return (d.chosen || clickedIds[d.target] && clickedIds[d.source]);
  }).style("stroke", "#D60C1D");


  // Artist name text
  text = text.data(nodesArray, function(d) { return d.id; } );
  text.exit().remove();
  text = text.enter()
    .append("text")
    .attr('class', 'text')
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
    .attr("dx", 48)
    .attr("dy", 3)
    .style("fill", "#000")
    .style("font-size", 16)
    .style('text-shadow', '0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff')
    .text(function(d) { return d.name; })
    .merge(text);

  // Reheat/restart simulation to put new nodes in proper place.
  simulation.nodes(nodesArray);
  simulation.force("link").links(linksArray)
            .distance(forceProperties.link.distance);
  simulation.alpha(0.5).restart();
}

function setSelected(root) {
  clickedIds[root.id] = true;
  let rootNode = node.filter(function(d) {
    return root.id === d.id;
  });

  let rootLinks = link.filter(function(d) {
    return root.id === d.target.id || root.id === d.source.id;
  });

	rootNode.style("fill", "#ff9d00").attr("r", 40);
	rootLinks.style("stroke", "#D60C1D");
}

function resetZoom() {
  if (node.nodes().length > 0) {
    let xVals = d3.extent(node.nodes(), function(d) { return d.cx.baseVal.value;});
    let yVals = d3.extent(node.nodes(), function(d) { return d.cy.baseVal.value;});

    let scale = d3.min([700 / (xVals[1] - xVals[0]), 700 / (yVals[1] - yVals[0])]);
    let translateX = (width / height) * 500 *  (1 - scale);
    let translateY = 500 *  (1 - scale);

    rect.transition()
     .duration(750)
     .call(zoom.transform,
       d3.zoomIdentity
       .translate(translateX, translateY)
       .scale(scale)
    );
  } else {
    rect.transition()
     .duration(750)
     .call(zoom.transform,
       d3.zoomIdentity
       .translate(0, 0)
       .scale(1)
    );
  }
}

function setWidth(node, base = 120) {
  let artistImage = node.images[2];
  if (!artistImage) {
    return base;
  } else if (artistImage.width > artistImage.height) {
    return base * (artistImage.width / artistImage.height);
  } else {
    return base;
  }
}

function setHeight(node, base = 120) {
  let artistImage2 = node.images[2];
  if (!artistImage2) {
    return base;
  } else if (artistImage2.height > artistImage2.width) {
    return base * (artistImage2.height / artistImage2.width);
  } else {
    return base;
  }
}

function mouseover() {
  d3.select(this).select("image")
    .attr('transform', 'scale(1.05)');
}

function mouseout() {
  d3.select(this).select("image")
    .attr('transform', 'scale(1.0)');
}

$('.center-zoom-button').click(resetZoom);
