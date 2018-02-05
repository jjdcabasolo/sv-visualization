// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = 'data/IRGSP-1.0_genome.fa';
const fileDirRefGenome = 'data/dummydata.txt';
// - svg-related
const svg = d3.select('#sv-visualization');
const svgTopMargin = 50; // in px
const svgLeftMargin = 20; // in px
const trackHeight = 10;

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
	changeHTMLDOM();
}

// local file reading [jQuery] taken from https://stackoverflow.com/a/10112551
function readTextFile(){
	$.get(fileDirRefGenome, function(data) {
		let referenceGenomeArray = [];
		data = data.replace(/[\n\s]/g, '');
		referenceGenomeArray = data.split(/>chr\d*/g);
		referenceGenomeArray.shift();
		noOfChr = referenceGenomeArray.length;

		constructReferenceGenome(referenceGenomeArray);
		renderVisualization();
	}, 'text');
}

// creates the referenceGenome object @ readTextFile()
function constructReferenceGenome(array){
	for(let i = 0; i < noOfChr; i++){
		let chrObj = {};	
		chrObj['num'] = i + 1;
		chrObj['seq'] = array[i];
		chrObj['len'] = array[i].length;
		referenceGenome[i] = chrObj;
	}
}

// draw the visualization on the SVG [D3] @ readTextFile()
function renderVisualization(){
	svg.selectAll('*').remove(); // clear svg
	drawRuler();
	drawReferenceGenome();
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
		.attr('x2', maxChrBound + svgLeftMargin)
		.attr('y1', svgTopMargin)
		.attr('y2', svgTopMargin)
		.attr('stroke-width', 2)
		.attr('stroke', 'black');

	addRulerInterval();
	addSequenceText();
}

	// adds the ruler interval, can be edited by the user [D3] @ drawRuler()
	function addRulerInterval(){
		// update current ruler interval
		rulerInterval = Number($('#ruler-interval').val()); 

		let interval = 0
				intervalCount = Math.round((maxChrBound / 7) / rulerInterval)
				textInterval = 0;

		for(var i = 0; i < intervalCount; i++) {
			// adds the vertical line indicator
			svg
				.append('line')
					.attr('x1', 0 + interval + svgLeftMargin)
					.attr('x2', 0 + interval + svgLeftMargin)
					.attr('y1', svgTopMargin - 10)
					.attr('y2', svgTopMargin)
					.attr('stroke-width', 1)
					.attr('stroke', 'black');

			// adds the interval text
		  svg
		  	.append('text')
			    .attr('x', 2 + interval + svgLeftMargin)
			    .attr('y', svgTopMargin - 3)
			    .attr('font-family', 'Courier, "Lucida Console", monospace')
			    .attr('font-size', '12px')
			    .attr('fill', 'black')
		    .text(textInterval)
		    .style('pointer-events', 'none');		

			interval = interval + (rulerInterval * 7);
			textInterval = textInterval + rulerInterval;
		}
	}

	// adds the sequence text, can be toggled [D3] @ drawRuler()
	function addSequenceText(){
		// draws the sequence text
		if(showSequence){
		  svg
		  	.append('text')
					.attr('x', 0 + svgLeftMargin)
					.attr('y', svgTopMargin + 25)
					.attr('font-family', 'Courier, "Lucida Console", monospace')
					.attr('font-size', '12px')
					.attr('fill', 'black')
				.text(chrSequence)
				.style('pointer-events', 'none');  
		}
	}

// draws the reference genome line [D3] @drawRuler()
function drawReferenceGenome(){
	// pattern on mmouse hover, code taken from: http://jsfiddle.net/yduKG/3/
	svg
	  .append('defs')
	  .append('pattern')
	    .attr('id', 'diagonalHatch')
	    .attr('patternUnits', 'userSpaceOnUse')
	    .attr('width', 4)
	    .attr('height', 4)
	  .append('path')
	    .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
	    .attr('stroke', '#000000')
	    .attr('stroke-width', 1);

	// the reference genome line
	svg
		.append('rect')
			.attr('x', 0 + svgLeftMargin)
			.attr('y', svgTopMargin + 30)
			.attr('width', maxChrBound)
			.attr('height', trackHeight + 10)
			.attr('trackID', 'reference-genome')
			.attr('color', '#d9d9d9')
		.style('fill', '#d9d9d9')
		.on('mouseover', trackMouseOver)
    .on('mouseout', trackMouseOut)
    .on('dblclick', trackDoubleClick);
}

// highlight effect on hover [D3] @ drawReferenceGenome()
function trackMouseOver() {
  d3.select(this).style('fill', 'url(#diagonalHatch)');
}

// returns the previous color of the highlighted track [D3] @ drawReferenceGenome()
function trackMouseOut() {
  const color = d3.select(this).attr('color');
  d3.select(this).style('fill', color);
}

function trackDoubleClick() {
	// baka lang may gawin ka pa, like additional modal zzzz
}

// enables pan and zoom for the whole SVG [D3] @ renderVisualization()
function adjustPanSVG(){
  // enable pan and zoom
  const zoom = d3.zoom().scaleExtent([0.5, 5]).on('zoom', () => {
    svg.attr('transform', d3.event.transform);
  });
  svgZoomed = svg.call(zoom).on('dblclick.zoom', null).append('g');
}

// event listeners for html elements [jQuery] @ initialize()
function initializeActionListeners(){
	// reloads the visualization on chr change
	$('#chr-num-select').on('change', function(){
		renderVisualization();
	})

	// toggles the sequence text
	$('#toggle-seq-text').on('change', function(){
		if($('#toggle-seq-text').is(':checked') === true){
			showSequence = false;
		}
		else{
			showSequence = true;	
		}
		renderVisualization();
	})

	$('#ruler-interval').on('change', function(){
		renderVisualization();
	})
	
}

// HTML DOM manipulations [jQuery] @ initialize()
function changeHTMLDOM(){	
	$('#ruler-interval').attr('value', '20');
}

initialize();