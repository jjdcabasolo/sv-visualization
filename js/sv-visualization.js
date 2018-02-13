// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = 'data/IRGSP-1.0_genome.fa';
const fileDirRefGenome = 'data/dummyref.txt';
// - svg-related
const svg = d3.select('#sv-visualization');
const svgTopMargin = 50; // in px
const svgLeftMargin = 20; // in px
const trackHeight = 10; // in px
const minimumRange = 10; // in bp
const flankingValue = 50; // in bp

// GLOBAL VARIABLES
let referenceGenome = [];
let noOfChr = 0;
let startChr = 0;
let endChr = 0;
// - svg-related
let maxChrBound = 0;
let rulerInterval = 20;
let showSequence = true;
let panZoomSVG = null;
let zoom = true;
let pan = true;
// - ui-related
let showOptions = true;
let isSidebarOpen = true;

// initialization
function initialize(){
	readTextFile();
	initializeActionListeners();
	changeHTMLDOM();
	setupSemantic();
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
		// renderVisualization();
		initializeSetCoordinates();
	}, 'text');
}

// creates the referenceGenome object @ readTextFile()
function constructReferenceGenome(array){
	let chrList = '';

	for(let i = 0; i < noOfChr; i++){
		let chrObj = {};	
		chrObj['num'] = i + 1;
		chrObj['seq'] = array[i];
		chrObj['len'] = array[i].length;
		referenceGenome[i] = chrObj;
		chrList = chrList + '<option value=' + (i+1) + '>chr ' + (i+1) + '</option>';

		if(i == 0) $('#max-count').text(array[i].length); // loads the length to the max-count div at start
	}

	$('#chr-num-select').append(chrList);
}

// draw the visualization on the SVG [D3] @ readTextFile()
function renderVisualization(){
	svg.selectAll('*').remove(); // clear svg
	drawRuler();
	drawReferenceGenome();
	// enablePanAndZoom();
}

// draw the ruler at the top [D3] @ renderVisualization()
function drawRuler(){
	var chrNum = Number($('#chr-num-select option:selected').val()) - 1,
			currentChr = referenceGenome[chrNum],
			chrSequence = currentChr.seq.toUpperCase(),
			interval = 0,
			oneIndexingAdjustment = 2;
	maxChrBound = currentChr.len * 7;

	chrSequence = setSequenceRange(chrSequence);

	// draws the horizontal ruler
	svg
		.append('g')
			.attr('class', 'ruler')
		.append('line')
			.attr('x1', 0)
			.attr('x2', maxChrBound + svgLeftMargin + oneIndexingAdjustment)
			.attr('y1', svgTopMargin)
			.attr('y2', svgTopMargin)
			.attr('stroke-width', 2)
			.attr('stroke', 'black');

	addRulerInterval(oneIndexingAdjustment);
	addSequenceText(chrSequence);

	$('#sv-visualization').attr('width', maxChrBound + flankingValue); // adjusts the svg for it to be scrollable
}

	// sets the sequence range to be displayed @ drawRuler()
	function setSequenceRange(sequence){
		$('#max-count').text(maxChrBound/7);

		startChr = Number($('#chr-start').val() - 1);
		endChr = Number($('#chr-end').val() - 1);
		maxChrBound = (endChr - startChr) * 7;

		return sequence.substring(startChr, endChr);
	}

	// adds the ruler interval, can be edited by the user [D3] @ drawRuler()
	function addRulerInterval(oneIndexingAdjustment){
		// update current ruler interval
		rulerInterval = Number($('#ruler-interval').val()); 

		let interval = 0,
				intervalCount = Math.ceil((maxChrBound / 7) / rulerInterval),
				textInterval = Number($('#chr-start').val());

		if((maxChrBound / 7) % rulerInterval == 0){
			intervalCount = intervalCount + 1;
		}

		for(var i = 0; i < intervalCount; i++) {
			// adds the vertical line indicator
			svg
				.append('g')
					.attr('class', 'ruler')
				.append('line')
					.attr('x1', 0 + oneIndexingAdjustment + interval + svgLeftMargin)
					.attr('x2', 0 + oneIndexingAdjustment + interval + svgLeftMargin)
					.attr('y1', svgTopMargin - 10)
					.attr('y2', svgTopMargin)
					.attr('stroke-width', 1)
					.attr('stroke', 'black');

			// adds the interval text
		  svg
				.append('g')
					.attr('class', 'ruler')
		  	.append('text')
			    .attr('x', 2 + oneIndexingAdjustment + interval + svgLeftMargin)
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
	function addSequenceText(chrSequence){
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

// enables pan and zoom for the whole SVG [jQuery plugin] @ renderVisualization()
function enablePanAndZoom(){
	if(!panZoomSVG == null)	panZoomSVG.destroy();
	console.log(panZoomSVG);

	panZoomSVG = svgPanZoom('#sv-visualization', {
		panEnabled: true,
		zoomEnabled: true,
		dblClickZoomEnabled: true,
		mouseWheelZoomEnabled: true,
		preventMouseEventsDefault: true,
		zoomScaleSensitivity: 0.12,
		minZoom: 0.1,
		maxZoom: 5,
		fit: true,
		contain: false,
		center: true
	});

	console.log(panZoomSVG);

	// assign svgpan functions to buttons (zoom and pan buttons)
	$('#reset-svg').on('click', function(){
		panZoomSVG.reset();
	});

	$('#toggle-zoom-svg').on('click', function(){
		if(!zoom){
			panZoomSVG.enableZoom();
			$('#toggle-zoom-svg').html('Zoom enabled');
		}
		else{
			panZoomSVG.disableZoom();
			$('#toggle-zoom-svg').html('Zoom disabled');
		}
		zoom = !zoom;
	});

	$('#zoom-in-svg').on('click', function(){
		if(zoom) panZoomSVG.zoomIn();
	});

	$('#zoom-out-svg').on('click', function(){
		if(zoom) panZoomSVG.zoomOut();
	});

	$('#toggle-pan-svg').on('click', function(){
		if(!pan){
			panZoomSVG.enablePan();
			$('#toggle-pan-svg').html('Pan enabled');
		}
		else{
			panZoomSVG.disablePan();
			$('#toggle-pan-svg').html('Pan disabled');
		}
		pan = !pan;
	});
}

// event listeners for html elements [jQuery] @ initialize()
function initializeActionListeners(){
	// reloads the visualization on chr change
	$('#chr-num-select').on('change', function(){
		var chrNum = Number($('#chr-num-select').val()) - 1,
			currentChr = referenceGenome[chrNum];

		$('#max-count').text(currentChr.len);
	});

	// toggles the sequence text
	$('#toggle-seq-text').on('change', function(){
		// if($('#toggle-seq-text').is(':checked') === true){
		// 	showSequence = false;
		// }
		// else{
		// 	showSequence = true;	
		// }
		// renderVisualization();
	});

	$('#ruler-interval').on('change', function(){
		svg.selectAll('.ruler').remove(); // clear svg
		drawRuler();
	});

	$('#left-sidebar-toggle').on('click', function(){
		isSidebarOpen = !isSidebarOpen;
		if(isSidebarOpen){
			$('#svg-holder').css('width', '78%');  // TODO: responsive width
		}
		else{
			$('#svg-holder').css('width', '98%'); 
		}
	});
}

// initializes the set coordinates event listener on the button after reading the data @ readTextFile()
function initializeSetCoordinates(){
	$('#min-range').text(minimumRange);

	$('#chr-coordinates').click(function(){
		$('#svg-holder').css('width', '78%'); // adjusts the svg view at start // TODO: responsive width

		let startChr = Number($('#chr-start').val()) - 1,
				endChr = Number($('#chr-end').val()) - 1,
				maxBound = Number($('#max-count').text());

		if(maxBound < endChr){
			// checks if the upper bound exceeds the length of the current chromosome
			$('#range-message').text('The end range exceeds the length of the chromosome.');
		}
		else if(startChr > endChr){
			// checks if the lower bound is greater than the lower bound
			$('#range-message').text('Start range is larger than end range.');
		}
		else if((endChr - startChr) < minimumRange){
			// checks if the ranges is greater than the set minimum range
			$('#range-message').text('Check the range. The minimum range is ' + minimumRange + '.');
		}
		else{
			renderVisualization();
		}
	});	
}

// HTML DOM manipulations [jQuery] @ initialize()
function changeHTMLDOM(){	
	// set the initial ruler interval to 20
	$('#ruler-interval').attr('value', '20');

	// set the attributes of the svg
	$('#sv-visualization').attr('height', '500px');
	$('#sv-visualization').attr('width', '100%');
}

// semantic element initializations and enabling [jQuery] @ initialize()
function setupSemantic(){
	// initialize and enable semantic sidebar
	$('.ui.left.sidebar').sidebar({
		dimPage: false,
		transition: 'push',
		exclusive: true,
		closable: false
	});
	$('.ui.left.sidebar').sidebar('attach events', '#left-sidebar-toggle');
	
	// makes the option at the sidebar disappear on sidebar close
	$('#left-sidebar-toggle').on('click', function(){
		if(showOptions){
			$('a#left-sidebar-query').css({'-webkit-transform':'translate(-100px, 0px)'});
			$('a#left-sidebar-settings').css({'-webkit-transform':'translate(-100px, 0px)'});
			$('a#left-sidebar-details').css({'-webkit-transform':'translate(-100px, 0px)'});
			$('#return-options').css({'-webkit-transform':'translate(0px, -265px)'});
		}
		else{
			$('a#left-sidebar-query').css({'-webkit-transform':'translate(0px, 0px)'});
			$('a#left-sidebar-settings').css({'-webkit-transform':'translate(0px, 0px)'});
			$('a#left-sidebar-details').css({'-webkit-transform':'translate(0px, 0px)'});
			$('#return-options').css({'-webkit-transform':'translate(0px, 0px)'});
		}
		showOptions = !showOptions;
	});
	
	$('.menu .item').tab(); // enable semantic tab

	$('.ui.dropdown').dropdown(); // enable semantic dropdown

	$('.ui.checkbox').checkbox(); // enable semantic checkbox

	$('.message .close').on('click', function() { $(this).parent().transition('fade'); });
}

initialize();