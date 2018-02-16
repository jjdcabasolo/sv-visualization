// Author: John Jourish DC. Abasolo
// Description: Implementation of the structural variant visualization using D3.js and jQuery

// GLOBAL CONSTANTS
// - file-related
// const fileDirRefGenome = 'data/IRGSP-1.0_genome.fa';
const fileDirRefGenome = 'data/dummyref.txt';
const fileDirSVDel = 'data/dummysv-del.txt';
// - svg-related
const svg = d3.select('#sv-visualization');
const svgTopMargin = 50; // in px
const svgLeftMargin = 20; // in px
const trackHeight = 10; // in px
const minimumRange = 10; // in bp
const flankingValue = 50; // in bp

// GLOBAL VARIABLES
let referenceGenome = [];
let structuralVariants = {};
let svToDraw = [];
let frequency = {};
let noOfChr = 0;
let noOfClusters = 0;
let startChr = 0; // in bp
let endChr = 0; // in bp
// - svg-related
let maxChrBound = 0;
let rulerInterval = 20; // in px
let showSequence = true;
let nightMode = false;
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
		initializeSetCoordinates();
	}, 'text');

	$.get(fileDirSVDel, function(data) {
		let svArray = [];
		svArray = data.split(/\n/g);

		constructStructuralVariants(svArray);
	}, 'text');
}

// creates the referenceGenome array @ readTextFile()
function constructReferenceGenome(array){
	let chrList = '';

	for(var i = 0; i < noOfChr; i++){
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

// creates the structural variant object @ readTextFile()
function constructStructuralVariants(array){
	frequency = {'INS':{}, 'DEL':{}, 'INV':{}, 'DUP':{}};
	structuralVariants = {'INS':[], 'DEL':[], 'INV':[], 'DUP':[]};

	for(var i = 0; i < array.length; i++){
		let sv = array[i].split(/\t/g),
				typeLen = sv[3].split(/;/g), // [0] == type, [1] == length
				svObj = {};

		svObj['chrNum'] = Number(sv[0].replace(/chr/g, ''));
		svObj['start'] = Number(sv[1]);
		svObj['end'] = Number(sv[2]);
		svObj['length'] = Number(typeLen[1]);
		svObj['detail'] = sv[4];
		svObj['cluster'] = Number(sv[5]);

		frequency[typeLen[0]][Number(sv[5])] = 1 + (frequency[typeLen[0]][Number(sv[5])] || 0);

		structuralVariants[typeLen[0]][structuralVariants[typeLen[0]].length] = svObj;
	}
}

// draw the visualization on the SVG [D3] @ readTextFile()
function renderVisualization(){
	svg.selectAll('*').remove(); // clear svg
	drawRuler();
	drawReferenceGenome();
	drawStructuralVariants();
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

	chrSequence = setSequenceRange(chrSequence, true);

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
	function setSequenceRange(sequence, replace){
		if(replace){
			$('#max-count').text(maxChrBound/7);
		}

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
		  	.append('g')
		  		.attr('class', 'sequence-text')
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
		.append('g')
			.attr('class', 'reference-genome-line')
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
	function trackMouseOver(){
	  d3.select(this).style('fill', 'url(#diagonalHatch)');
	}

	// returns the previous color of the highlighted track [D3] @ drawReferenceGenome()
	function trackMouseOut(){
	  const color = d3.select(this).attr('color');
	  d3.select(this).style('fill', color);
	}

	// @ drawReferenceGenome()
	function trackDoubleClick(){
		// baka lang may gawin ka pa, like additional modal zzzz
	}

// draws the sv's within the specified range @ renderVisualization()
function drawStructuralVariants(){

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
		let chrNum = Number($('#chr-num-select').val()) - 1,
				currentChr = referenceGenome[chrNum];

		$('#max-count').text(currentChr.len);
	});

	// toggles the sequence text
	$('#toggle-seq-text').on('change', function(){
		svg.selectAll('.sequence-text').remove(); // removes the sequence text

		let chrNum = Number($('#chr-num-select option:selected').val()) - 1,
				currentChr = referenceGenome[chrNum],
				chrSequence = currentChr.seq.toUpperCase();

		console.log('asdf')
		if($('#toggle-seq-text').is(':checked') === true){
			showSequence = false;
		}
		else{
			showSequence = true;	
		}

		addSequenceText(setSequenceRange(chrSequence, false));
	});

	$('#ruler-interval').on('change', function(){
		svg.selectAll('.ruler').remove(); // removes the whole ruler
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

	// toggles app night mode
	$('#toggle-night-mode').on('change', function(){
		nightMode = ($('#toggle-night-mode').is(':checked') ? false : true);

		if(!nightMode){
			$('.night-mode').addClass('inverted');
			$('.ui.toggle.checkbox input:focus:checked~label, .ui.toggle.checkbox input~label')
				.attr('style', 'color: rgba(255,255,255,.9) !important');
			$('.pusher').attr('style', 'background-color: rgba(255,255,255,.15) !important');
		}
		else{
			$('.night-mode').removeClass('inverted');
			$('.ui.toggle.checkbox input:focus:checked~label, .ui.toggle.checkbox input~label')
				.attr('style', 'color: rgba(0,0,0,.87) !important');
			$('.pusher').attr('style', 'background-color: #EEEEEE !important');
		}
		nightMode = !nightMode;
	});
}

// initializes the set coordinates event listener on the button after reading the data @ readTextFile()
function initializeSetCoordinates(){
	$('#min-range').text(minimumRange);

	$('#chr-coordinates').click(function(){
		$('#svg-holder').css('width', '78%'); // adjusts the svg view at start // TODO: responsive width

		let startChr = Number($('#chr-start').val()) - 1,
				endChr = Number($('#chr-end').val()) - 1,
				maxBound = Number($('#max-count').text()),
				errorRange = false, errorSV = false,
				svType = $('input[name=sv-type]:checked').val();
		
		if(maxBound < endChr){
			// checks if the upper bound exceeds the length of the current chromosome
			$('#range-message').text('The end range exceeds the length of the chromosome.');
			errorRange = true;
		}
		if(startChr > endChr){
			// checks if the lower bound is greater than the lower bound
			$('#range-message').text('Start range is larger than end range.');
			errorRange = true;
		}
		if((endChr - startChr) < minimumRange){
			// checks if the ranges is greater than the set minimum range
			$('#range-message').text('Check the range. The minimum range is ' + minimumRange + '.');
			errorRange = true;
		}
		if(startChr == -1){
			// checks if the start range input fields are empty
			$('#range-message').text('Start range has no value.');
			errorRange = true;
		}
		else if(endChr == -1){
			// checks if the end range input fields are empty
			$('#range-message').text('End range has no value.');
			errorRange = true;
		}
		if(svType == null){
			$('#sv-message').text('Pick a structural variant type to visualize.');
			errorSV = true;
		}

		if(errorRange){
			$('#dismissible-error-range').removeClass('hidden').transition('pulse');
		}
		if(errorSV){
			$('#dismissible-error-sv').removeClass('hidden').transition('pulse');
		}

		if(!errorRange && !errorSV){
			$('#dismissible-error-range').addClass('hidden');
			$('#dismissible-error-sv').addClass('hidden');
			if(checkSVExistence()){
				renderVisualization();
			}
		}
	});	
}

	// draws the structural variants inside the queried start and end @ initializeSetCoordinates()
	function checkSVExistence(){
		let startChr = Number($('#chr-start').val()),
				endChr = Number($('#chr-end').val()),
				chrNum = Number($('#chr-num-select').val()),
				svType = $('input[name=sv-type]:checked').val();
		svToDraw = filterSV();

		if(svToDraw.length == 0){
			switch(svType){
	    case 'DEL':
	        svType = 'deletions';
	        break;
	    case 'INV':
	        svType = 'inversions';
	        break;
	    case 'DUP':
	        svType = 'duplications';
	        break;
	    case 'INS':
	        svType = 'insertions';
	        break;
	    default:
	        svType = 'magical SV\'s';
			}

			// sets the message for the error, automatically closes after 10 seconds
			$('#query-header').text('There are no ' + svType + ' found from ' + startChr + 'bp - ' + endChr + 'bp at chromosome number ' + chrNum + '.');
			$('#dismissible-error-query').removeClass('hidden').transition('pulse');
			$('#dismissible-error-query').delay(10000).fadeOut(400);

			return false;
		}	

		return true;
	}

		// collects all the sv's inside the range quried by user @ checkSVExistence()
		function filterSV(){
			let startChr = Number($('#chr-start').val()) - 1,
					endChr = Number($('#chr-end').val()) - 1,
					svType = $('input[name=sv-type]:checked').val(),
					svArray = structuralVariants[svType],
					returnArray = [];
			
			for(var i = 0; i < svArray.length; i++){
				let start = svArray[i]['start'],
						end = svArray[i]['end'];

				if(startChr <= start && endChr >= end){
					returnArray[returnArray.length] = svArray[i];
				}
			}

			return(returnArray);
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
			$('#return-options').css({'-webkit-transform':'translate(0px, -265px)'});
			$('#option-toggle').addClass('sidebar').removeClass('window close').transition({animation: 'flash', duration: '0.4s'});
		}
		else{
			$('#return-options').css({'-webkit-transform':'translate(0px, 0px)'});
			$('#option-toggle').addClass('window close').removeClass('sidebar').transition({animation: 'flash', duration: '0.4s'});
		}
		showOptions = !showOptions;
	});
	
	$('.menu .item').tab(); // enable semantic tab

	$('.ui.dropdown').dropdown(); // enable semantic dropdown

	$('.ui.checkbox').checkbox(); // enable semantic checkbox

	$('.message .close').on('click', function() { $(this).parent().transition('fade'); });
}

initialize();