// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = "data/IRGSP-1.0_genome.fa";
const fileDirRefGenome = "data/dummydata.txt";
// - svg-related
const svg = d3.select("#sv-visualization");
const svgTopMargin = 50; // in px

// GLOBAL VARIABLES
let referenceGenome = [];
let noOfChr = 0;
// - svg-related
let maxChrBound = 0;
let rulerInterval = 20;
let showSequence = true;

// initialization
function initialize(){
	readTextFile();
	initializeActionListeners();
}

// local file reading [jQuery] taken from https://stackoverflow.com/a/10112551
function readTextFile(){
	$.get(fileDirRefGenome, function(data) {
		let referenceGenomeArray = [];
		data = data.replace(/[\n\s]/g, "");
		referenceGenomeArray = data.split(/>chr\d*/g);
		referenceGenomeArray.shift();
		noOfChr = referenceGenomeArray.length;

		constructReferenceGenome(referenceGenomeArray);
		renderVisualization();
	}, "text");
}

// creates the referenceGenome object @ readTextFile()
function constructReferenceGenome(array){
	for(let i = 0; i < noOfChr; i++){
		let chrObj = {};	
		chrObj["num"] = i + 1;
		chrObj["seq"] = array[i];
		chrObj["len"] = array[i].length;
		referenceGenome[i] = chrObj;
	}
}

// draw the visualization on the SVG [D3] @ readTextFile()
function renderVisualization(){
	svg.selectAll('*').remove(); // clear svg
	drawRuler();
	adjustPanSVG();
}

// draw the ruler at the top [D3] @ renderVisualization()
function drawRuler(){
	var chrNum = Number($('#chr-num-select option:selected').val()) - 1,
			currentChr = referenceGenome[chrNum]
			chrSequence = currentChr.seq.toUpperCase()
			interval = 0;
	maxChrBound = currentChr.len*7;

	// draws the horizontal ruler
	svg.append('line')
		.attr('x1', 0)
		.attr('x2', maxChrBound)
		.attr('y1', svgTopMargin)
		.attr('y2', svgTopMargin)
		.attr('stroke-width', 2)
		.attr('stroke', 'black');

	addRulerInterval();
	addSequenceText();
}

// adds the ruler interval, can be edited by the user [D3] @ drawRuler()
function addRulerInterval(){
	let interval = 0
			intervalCount = Math.round((maxChrBound / 7) / rulerInterval) + 1
			textInterval = 0;

	for (var i = 0; i < intervalCount; i++) {
		// adds the vertical line indicator
		svg.append('line')
			.attr('x1', 0 + interval)
			.attr('x2', 0 + interval)
			.attr('y1', svgTopMargin - 10)
			.attr('y2', svgTopMargin)
			.attr('stroke-width', 1)
			.attr('stroke', 'black');

		// adds the interval text
	  svg.append('text')
	    .attr('x', 2 + interval)
	    .attr('y', svgTopMargin - 3)
	    .text(textInterval)
	    .attr('font-family', 'Courier, "Lucida Console", monospace')
	    .attr('font-size', '12px')
	    .attr('fill', 'black')
	    .style('pointer-events', 'none');		

		interval = interval + (rulerInterval * 7);
		textInterval = textInterval + rulerInterval;
	}
}

// adds the sequence text, can be toggled [D3] @ drawRuler()
function addSequenceText(){
	// draws the sequence text
	if(showSequence){
	  svg.append('text')
	    .attr('x', 0)
	    .attr('y', svgTopMargin + 10)
	    .text(chrSequence)
	    .attr('font-family', 'Courier, "Lucida Console", monospace')
	    .attr('font-size', '12px')
	    .attr('fill', 'black')
	    .style('pointer-events', 'none');  
	}
}

// enables pan and zoom for the whole SVG [D3] @ renderVisualization()
function adjustPanSVG(){
  // enable pan and zoom
  const zoom = d3.zoom().scaleExtent([0.1, 5]).on('zoom', () => {
    svg.attr('transform', d3.event.transform);
  });
  svgZoomed = svg.call(zoom).on('dblclick.zoom', null).append('g');

  // translate so that top of drawing is visible
  // zoom.translate([0, -svgTopMargin + 25]);
  // zoom.event(svgZoomed);

  // // resize svg depending on drawing size
  // const svg2 = d3.select(svg);
  // svg2.attr('height', svgTopMargin + 50);
  // svg2.attr('width', Math.max(maxChrBound, $(svg).parent().width()));
}

// event listeners for html elements [jQuery] @ initialize()
function initializeActionListeners(){
	// reloads the visualization on chr change
	$('#chr-num-select').on('change', function(){
		renderVisualization();
	})

	// toggles the sequence text
	$('#toggle-seq-text').on('change', function(){
		if($("#toggle-seq-text").is(':checked') === true){
			showSequence = false;
		}
		else{
			showSequence = true;	
		}
		renderVisualization();
	})
}

initialize();